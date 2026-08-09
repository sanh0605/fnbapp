-- Plan D D14: undo a confirmed stocktake session, and cancel a whole issue
-- slip. Design: docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md
-- section 5 "Undoing a confirmed count or a whole issue slip" (U1-U13),
-- section 8 D14.
--
-- Owner's reason: "khong co gi chac chan nhan vien dung 100% ca. Neu sai thi
-- phai huy phieu cu tao phieu moi chu." A confirmed stocktake session has no
-- undo today.
--
-- Trigger check: no live query was available to re-run this time (no Docker
-- for `supabase db dump --linked`, no direct Postgres driver in this repo).
-- Reconstructed instead from every migration ever applied, by grepping every
-- `create trigger` / `drop trigger` touching the four tables this migration
-- writes to -- migrations are the source of truth for what is live, and this
-- matches what every prior migration on this plan already found live:
--   stock_ledger: trg_stock_ledger_inventory_balances only (0038; the only
--     other trigger it ever had, detect_backdated_ledger_entry, was dropped
--     by Plan C Task 6, 0054). AFTER INSERT OR DELETE OR UPDATE OF
--     item_reference, quantity_change -- an INSERT here (the compensating
--     ledger rows below) correctly adds to inventory_balances.
--   stock_issues: no triggers, ever (0052). Purchased-item on-hand is summed
--     at read time (lib/purchased-item-onhand.ts), not trigger-maintained --
--     a compensating row restores it by construction, nothing to fire.
--   stocktake_sessions: trg_stocktake_sessions_touch only (0036), BEFORE
--     UPDATE, sets updated_at. Harmless, fires for this migration's own
--     status update same as every other update on this table.
--   issue_slips: no triggers, ever (0060). This migration never writes to it
--     directly -- cancel_issue_slip_atomic only reads it, to check the slip
--     exists.
--
-- ============================================================
-- stocktake_sessions: a reversed-after-apply session needs its own status.
-- CANCELLED already means "abandoned before apply" and D12
-- (cancel_stocktake_session_atomic, 0061) deletes those when blank -- folding
-- a reversed CONFIRMED session into CANCELLED would put real reversal
-- history in the path of that delete. REVERSED is new, D12 never touches it
-- (D12's own guard only ever operates on status = 'OPEN').
-- ============================================================
alter table public.stocktake_sessions
  drop constraint stocktake_sessions_status_check;
alter table public.stocktake_sessions
  add constraint stocktake_sessions_status_check
  check (status in ('OPEN', 'CONFIRMED', 'CANCELLED', 'REVERSED'));

alter table public.stocktake_sessions
  add column if not exists reversed_by_id text,
  add column if not exists reversed_by_name text,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_reason text;

-- ============================================================
-- reverse_stocktake_session_atomic
--
-- U1-U8: reverses exactly the rows this session's own apply wrote --
-- stock_issues filtered by session_id, stock_ledger STOCK_ADJUST filtered by
-- reference_id -- with a compensating row per original row, dated now,
-- negated quantity. Never edits or deletes an original row. BR-INV-009's
-- mechanism exactly (today's running average, not the original moment's
-- rate) -- not a new valuation rule, see lib/issue-costing.ts, which reads
-- only the sign of base_quantity and does not special-case source.
--
-- U2: only the most recently CONFIRMED session may be reversed -- a later
-- confirmed count means reality already moved on.
-- U4: refused while any session is OPEN -- an in-progress count's
-- theoretical_at_count snapshots are taken from the ledger as it stands when
-- each line is saved; reversing an older session under it would move the
-- ground mid-count. See the plan's own critique note for U4.
-- U5: reason required.
-- U6 is enforced by the caller (lib/auth.ts's new requireOwner) -- this
-- function does not check role itself, matching every other RPC on this
-- plan (the service-role EXECUTE grant is the enforcement boundary, per
-- ACCESS-MODEL.md's own documented design; Server Actions gate on top).
create or replace function public.reverse_stocktake_session_atomic(
  p_session_id text,
  p_reason text,
  p_reversed_by_id text,
  p_reversed_by_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_reversed_by_id text := nullif(btrim(coalesce(p_reversed_by_id, '')), '');
  v_reversed_by_name text := nullif(btrim(coalesce(p_reversed_by_name, '')), '');
  v_status text;
  v_most_recent_confirmed_id text;
  v_any_open boolean;
  v_now timestamptz := now();
  v_next_issue_number integer;
  v_next_ledger_number integer;
  v_issue_row record;
  v_ledger_row record;
  v_reversal_issue_id text;
  v_reversal_ledger_id text;
  v_note text;
  v_issue_ids jsonb := '[]'::jsonb;
  v_ledger_ids jsonb := '[]'::jsonb;
  v_issue_count integer := 0;
  v_ledger_count integer := 0;
begin
  if v_session_id is null then raise exception 'p_session_id is required'; end if;
  if v_reason is null then raise exception 'Ly do huy phien kiem ke la bat buoc'; end if;
  if v_reversed_by_id is null then raise exception 'p_reversed_by_id is required'; end if;
  if v_reversed_by_name is null then raise exception 'p_reversed_by_name is required'; end if;

  select status into v_status from public.stocktake_sessions where id = v_session_id for update;
  if v_status is null then raise exception 'Unknown stocktake session: %', v_session_id; end if;
  if v_status <> 'CONFIRMED' then
    raise exception 'Phien % khong o trang thai da ap dung (status=%), khong the huy', v_session_id, v_status;
  end if;

  select exists (select 1 from public.stocktake_sessions where status = 'OPEN')
  into v_any_open;
  if v_any_open then
    raise exception 'Dang co mot phien kiem ke dang mo -- xu ly xong phien do truoc khi huy phien da ap dung';
  end if;

  select id into v_most_recent_confirmed_id
  from public.stocktake_sessions
  where status = 'CONFIRMED'
  order by confirmed_at desc
  limit 1;
  if v_most_recent_confirmed_id <> v_session_id then
    raise exception 'Chi phien da ap dung gan nhat (%) moi duoc huy, khong phai %', v_most_recent_confirmed_id, v_session_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';
  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0)
  into v_next_ledger_number
  from public.stock_ledger where id ~ '^STK-[0-9]+$';

  v_note := 'Huy phien kiem ke ' || v_session_id || ' -- ' || v_reason;

  -- U1/U7: compensating stock_issues row per purchased-item line this
  -- session wrote. Same shape as a BR-INV-008 found-stock event -- negative
  -- base_quantity, dated now, source STOCKTAKE (reverse_manual_issue_atomic
  -- only accepts source = MANUAL, so these can never be individually
  -- re-reversed through that path -- no double-reversal route exists).
  for v_issue_row in
    select * from public.stock_issues where session_id = v_session_id order by id
  loop
    v_next_issue_number := v_next_issue_number + 1;
    v_reversal_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');
    insert into public.stock_issues (
      id, purchased_item_id, issued_at, base_quantity, source, session_id, note, reverses_issue_id
    ) values (
      v_reversal_issue_id, v_issue_row.purchased_item_id, v_now, -v_issue_row.base_quantity,
      'STOCKTAKE', v_session_id, v_note, v_issue_row.id
    );
    v_issue_ids := v_issue_ids || jsonb_build_array(v_reversal_issue_id);
    v_issue_count := v_issue_count + 1;
  end loop;

  -- U1/U8: compensating stock_ledger row per ingredient correction this
  -- session wrote. trg_stock_ledger_inventory_balances restores
  -- inventory_balances on insert, same mechanism Plan C Task 5 already
  -- relied on for a delete.
  for v_ledger_row in
    select * from public.stock_ledger
    where transaction_type = 'STOCK_ADJUST' and reference_id = v_session_id
    order by id
  loop
    v_next_ledger_number := v_next_ledger_number + 1;
    v_reversal_ledger_id := 'STK-' || lpad(v_next_ledger_number::text, 3, '0');
    insert into public.stock_ledger (
      id, transaction_type, reference_id, item_reference, quantity_change, unit_cost, created_at, notes
    ) values (
      v_reversal_ledger_id, 'STOCK_ADJUST', v_session_id, v_ledger_row.item_reference,
      -v_ledger_row.quantity_change, 0, v_now, v_note
    );
    v_ledger_ids := v_ledger_ids || jsonb_build_array(v_reversal_ledger_id);
    v_ledger_count := v_ledger_count + 1;
  end loop;

  update public.stocktake_sessions set
    status = 'REVERSED',
    reversed_by_id = v_reversed_by_id,
    reversed_by_name = v_reversed_by_name,
    reversed_at = v_now,
    reversed_reason = v_reason
  where id = v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'status', 'REVERSED',
    'reason', v_reason,
    'reversed_by_id', v_reversed_by_id,
    'reversed_by_name', v_reversed_by_name,
    'reversed_at', v_now,
    'issue_count', v_issue_count,
    'ledger_count', v_ledger_count,
    'issue_ids', v_issue_ids,
    'ledger_ids', v_ledger_ids
  );
end;
$$;

revoke all on function public.reverse_stocktake_session_atomic(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reverse_stocktake_session_atomic(text, text, text, text)
  to service_role;

-- ============================================================
-- cancel_issue_slip_atomic
--
-- U9-U11: reverses every line of a slip not already individually reversed,
-- in one call, one reason -- settles I11's "whole slip" side beside the
-- existing per-line reverse_manual_issue_atomic (D7b), which is unchanged
-- and stays available for a single wrong line. Composes
-- reverse_manual_issue_atomic per eligible row rather than duplicating its
-- logic (same already-reversed guard, same compensating-row shape, same
-- BR-INV-009 valuation) -- one mechanism, not two that could drift apart.
create or replace function public.cancel_issue_slip_atomic(
  p_slip_id text,
  p_reason text,
  p_created_by_id text,
  p_created_by_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip_id text := nullif(btrim(coalesce(p_slip_id, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_note text;
  v_row record;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  if v_slip_id is null then raise exception 'p_slip_id is required'; end if;
  if v_reason is null then raise exception 'Ly do huy phieu la bat buoc'; end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;

  if not exists (select 1 from public.issue_slips where id = v_slip_id) then
    raise exception 'Khong tim thay phieu xuat kho: %', v_slip_id;
  end if;

  v_note := 'Huy ca phieu ' || v_slip_id || ' -- ' || v_reason;

  -- U9/U10: only rows this slip wrote (issue_slip_id = v_slip_id always
  -- means an original MANUAL line, never a reversal -- reverse_manual_
  -- issue_atomic's own compensating insert never sets issue_slip_id) that
  -- are not already reversed by another row.
  for v_row in
    select si.id
    from public.stock_issues si
    where si.issue_slip_id = v_slip_id
      and not exists (select 1 from public.stock_issues r where r.reverses_issue_id = si.id)
    order by si.id
  loop
    v_result := public.reverse_manual_issue_atomic(v_row.id, v_note, v_created_by_id, v_created_by_name);
    v_results := v_results || jsonb_build_array(v_result);
    v_count := v_count + 1;
  end loop;

  -- U11: an explicit refusal, not a silent no-op, when there is nothing left.
  if v_count = 0 then
    raise exception 'Phieu % khong con dong nao de huy -- co the da duoc dao toan bo truoc do', v_slip_id;
  end if;

  return jsonb_build_object(
    'slip_id', v_slip_id,
    'reason', v_reason,
    'reversed_count', v_count,
    'reversals', v_results
  );
end;
$$;

revoke all on function public.cancel_issue_slip_atomic(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cancel_issue_slip_atomic(text, text, text, text)
  to service_role;
