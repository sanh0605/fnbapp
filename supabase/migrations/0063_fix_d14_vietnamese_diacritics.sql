-- Plan D D14 follow-up: fix missing Vietnamese diacritics in 0062. Found by
-- the owner reading the stored note on STK-006's own reversal:
-- "Huy phien kiem ke STK-006 -- Test", plain ASCII, next to the original
-- line's "Kiểm kê định kỳ 2026-08-09", which has full diacritics -- the
-- mismatch was visible to him immediately, since he is the one who reads
-- these notes. 0062 is already live in production (pushed 2026-08-09,
-- before this was noticed), so the fix is a new migration, not an edit to
-- an already-applied file.
--
-- Scope widened from the one note the owner pointed at to every
-- Vietnamese-language string in both functions: the same plain-ASCII
-- mistake also affects every raised exception message a user can see in
-- the UI (Alert component surfaces error.message directly), not only the
-- text stored in stock_issues/stock_ledger. Every other migration on this
-- plan writes Vietnamese business-facing text with full diacritics
-- (reverse_manual_issue_atomic, 0058, is the direct precedent this should
-- have matched from the start). English structural-validation messages
-- ("p_session_id is required" and similar, matching that same precedent's
-- own split) are left as they are -- not in scope, not what was flagged.
--
-- No logic changed anywhere in either function -- string literals only.
-- Re-verified: no live query available this session either (same
-- limitation noted in 0062's own header); nothing here writes to a new
-- table or column, so the trigger surface is identical to 0062's, already
-- documented there.
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
  if v_reason is null then raise exception 'Lý do huỷ phiên kiểm kê là bắt buộc'; end if;
  if v_reversed_by_id is null then raise exception 'p_reversed_by_id is required'; end if;
  if v_reversed_by_name is null then raise exception 'p_reversed_by_name is required'; end if;

  select status into v_status from public.stocktake_sessions where id = v_session_id for update;
  if v_status is null then raise exception 'Unknown stocktake session: %', v_session_id; end if;
  if v_status <> 'CONFIRMED' then
    raise exception 'Phiên % không ở trạng thái đã áp dụng (status=%), không thể huỷ', v_session_id, v_status;
  end if;

  select exists (select 1 from public.stocktake_sessions where status = 'OPEN')
  into v_any_open;
  if v_any_open then
    raise exception 'Đang có một phiên kiểm kê đang mở -- xử lý xong phiên đó trước khi huỷ phiên đã áp dụng';
  end if;

  select id into v_most_recent_confirmed_id
  from public.stocktake_sessions
  where status = 'CONFIRMED'
  order by confirmed_at desc
  limit 1;
  if v_most_recent_confirmed_id <> v_session_id then
    raise exception 'Chỉ phiên đã áp dụng gần nhất (%) mới được huỷ, không phải %', v_most_recent_confirmed_id, v_session_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';
  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0)
  into v_next_ledger_number
  from public.stock_ledger where id ~ '^STK-[0-9]+$';

  v_note := 'Huỷ phiên kiểm kê ' || v_session_id || ' -- ' || v_reason;

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
  if v_reason is null then raise exception 'Lý do huỷ phiếu là bắt buộc'; end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;

  if not exists (select 1 from public.issue_slips where id = v_slip_id) then
    raise exception 'Không tìm thấy phiếu xuất kho: %', v_slip_id;
  end if;

  v_note := 'Huỷ cả phiếu ' || v_slip_id || ' -- ' || v_reason;

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

  if v_count = 0 then
    raise exception 'Phiếu % không còn dòng nào để huỷ -- có thể đã được đảo toàn bộ trước đó', v_slip_id;
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
