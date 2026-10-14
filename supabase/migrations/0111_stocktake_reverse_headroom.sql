-- supabase/migrations/0111_stocktake_reverse_headroom.sql
-- Undoing a stocktake may not push an item below zero (2026-10-14 audit, A1;
-- plan docs/superpowers/plans/2026-10-14-soat-toan-bo.md, wave 1).
--
-- The 0082 body wrote a reverse row for every stock_issues row of the session
-- and never looked at the balance. A reverse row of a "found at the count" line
-- (negative base_quantity) is positive, i.e. it takes the goods out of stock
-- again; when they were issued or used since, stock goes below zero and the
-- cost engine throws (Lãi lỗ, Hàng đã xuất, Phiếu xuất stop opening).
-- Fix: after the reverse rows are written, every item that loses stock is
-- checked with issue_stock_headroom (0106) at the reversal instant; one item
-- under zero refuses the whole undo (the transaction rolls back).
--
-- Triggers, read from migration text (supabase/CLAUDE.md: no session here can
-- query pg_catalog; grep of every `create trigger` / `drop trigger`):
--   stock_issues: none, ever (0052 onward; 0062, 0104 and 0106 say the same).
--     The reverse rows fire nothing.
--   stocktake_sessions: trg_stocktake_sessions_touch (0036, BEFORE UPDATE, row
--     level, sets updated_at). Fires once on the status update, as before.
--
-- Signature and return shape are unchanged (plain create or replace), so the
-- TypeScript caller (lib/stock/stocktake-transaction.ts) needs no change; a
-- refusal arrives as an ordinary Vietnamese error message.
--
-- Deploy order: no code change depends on this file; it can run any time
-- after the owner approves. Not applied by the author.

create or replace function public.reverse_stocktake_session_atomic(p_session_id text, p_reason text, p_reversed_by_id text, p_reversed_by_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_issue_row record;
  v_reversal_issue_id text;
  v_note text;
  v_issue_ids jsonb := '[]'::jsonb;
  v_issue_count integer := 0;
  v_check record;
  v_low numeric;
  v_unit_name text;
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

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';

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

  -- 0111: a found-at-count line (negative base_quantity) is reversed by a
  -- positive row that takes the goods out again. Checked once per item after
  -- every reverse row is written, so a loss line of the same item (which puts
  -- goods back) counts in the balance and the row order cannot matter.
  for v_check in
    select distinct si.purchased_item_id
    from public.stock_issues si
    where si.session_id = v_session_id and si.reverses_issue_id is null and si.base_quantity < 0
  loop
    v_low := public.issue_stock_headroom(v_check.purchased_item_id, v_now);
    if v_low < 0 then
      select u.name into v_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_check.purchased_item_id and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Không huỷ được phiên kiểm kê %: % sẽ âm kho (còn % %) vì số hàng tìm thấy lúc kiểm đã được xuất hoặc dùng. Xử lý phần đã xuất trước.',
        v_session_id,
        (select pi.name from public.purchased_items pi where pi.id = v_check.purchased_item_id),
        v_low, coalesce(v_unit_name, '');
    end if;
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
    'issue_ids', v_issue_ids
  );
end;
$function$;

revoke all on function public.reverse_stocktake_session_atomic(text, text, text, text) from public;
revoke all on function public.reverse_stocktake_session_atomic(text, text, text, text) from anon;
revoke all on function public.reverse_stocktake_session_atomic(text, text, text, text) from authenticated;
grant execute on function public.reverse_stocktake_session_atomic(text, text, text, text) to service_role;
