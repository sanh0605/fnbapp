-- Plan D D7b: reversing a mistaken manual issue slip (I7). Design:
-- docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md section 5
-- "I7 in full", decision recorded in BR-INV-009.
--
-- Triggers on the two tables this migration writes to, checked live
-- immediately before writing this file (supabase db query --linked), same
-- result as before D7a: stock_ledger carries only
-- trg_stock_ledger_inventory_balances (detect_backdated_ledger_entry was
-- retired by Plan C Task 6); stock_issues has none.
--
-- BR-INV-009: a reversal is mechanically the same event BR-INV-008 already
-- built -- a negative stock_issues row, valued by computeIssueCosting's
-- existing found-stock branch at today's live average, not the original
-- slip's rate and not backdated to the original moment. This migration adds
-- only the link (reverses_issue_id) and the write path; no new engine math.
--
-- Deliberately no on-hand check here (unlike create_manual_issue_atomic's
-- I4/I5): a reversal only ever returns the exact quantity a real prior
-- issue removed, so it can never exceed what is on hand -- there is nothing
-- to refuse.
alter table public.stock_issues
  add column if not exists reverses_issue_id text references public.stock_issues(id);
create index if not exists idx_stock_issues_reverses on public.stock_issues(reverses_issue_id);

create or replace function public.reverse_manual_issue_atomic(
  p_issue_id text,
  p_note text,
  p_created_by_id text,
  p_created_by_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue_id text := nullif(btrim(coalesce(p_issue_id, '')), '');
  v_note text := coalesce(p_note, '');
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_original record;
  v_already_reversed_by text;
  v_item_name text;
  v_base_ingredient_id text;
  v_now timestamptz := now();
  v_next_issue_number integer;
  v_next_ledger_number integer;
  v_reversal_id text;
  v_ledger_id text;
begin
  if v_issue_id is null then raise exception 'p_issue_id is required'; end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));

  select * into v_original from public.stock_issues where id = v_issue_id for update;
  if v_original.id is null then raise exception 'Không tìm thấy phiếu xuất: %', v_issue_id; end if;
  if v_original.source <> 'MANUAL' then
    raise exception 'Chỉ đảo được phiếu xuất thủ công -- % có nguồn %, không phải MANUAL',
      v_issue_id, v_original.source;
  end if;

  select id into v_already_reversed_by
  from public.stock_issues where reverses_issue_id = v_issue_id;
  if v_already_reversed_by is not null then
    raise exception 'Phiếu % đã được đảo bởi % trước đó, không đảo hai lần', v_issue_id, v_already_reversed_by;
  end if;

  select name, base_ingredient_id into v_item_name, v_base_ingredient_id
  from public.purchased_items where id = v_original.purchased_item_id;
  if v_base_ingredient_id is null then
    raise exception 'Mặt hàng % chưa gắn với nguyên liệu gốc, không thể đảo phiếu',
      coalesce(v_item_name, v_original.purchased_item_id);
  end if;

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0) + 1
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';
  v_reversal_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');

  -- BR-INV-009: negative base_quantity, dated now -- the same shape as a
  -- BR-INV-008 found-stock row. reverses_issue_id is the link; the original
  -- row is never updated (kept exactly as posted).
  insert into public.stock_issues (
    id, purchased_item_id, issued_at, base_quantity, source, session_id, note, reverses_issue_id
  ) values (
    v_reversal_id, v_original.purchased_item_id, v_now, -v_original.base_quantity, 'MANUAL', null,
    'Đảo phiếu ' || v_issue_id || ' (ghi nhầm)' || coalesce(' -- ' || nullif(btrim(v_note), ''), ''),
    v_issue_id
  );

  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0) + 1
  into v_next_ledger_number
  from public.stock_ledger where id ~ '^STK-[0-9]+$';
  v_ledger_id := 'STK-' || lpad(v_next_ledger_number::text, 3, '0');

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change, unit_cost, created_at, notes
  ) values (
    v_ledger_id, 'STOCK_ADJUST', v_reversal_id, v_base_ingredient_id, v_original.base_quantity, 0, v_now,
    'Đảo phiếu xuất thủ công ' || v_issue_id
  );

  return jsonb_build_object(
    'reversal_issue_id', v_reversal_id,
    'ledger_id', v_ledger_id,
    'reverses_issue_id', v_issue_id,
    'purchased_item_id', v_original.purchased_item_id,
    'base_ingredient_id', v_base_ingredient_id,
    'base_quantity', -v_original.base_quantity,
    'issued_at', v_now,
    'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name
  );
end;
$$;

revoke all on function public.reverse_manual_issue_atomic(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reverse_manual_issue_atomic(text, text, text, text)
  to service_role;
