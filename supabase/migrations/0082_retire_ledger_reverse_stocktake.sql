-- Stock ledger retirement, Phase C, function 5 of 8: reverse_stocktake_session_atomic.
-- docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md section 5.
--
-- Removes the compensating insert into stock_ledger (the second loop,
-- which reversed whatever apply_stocktake_session_atomic's ingredient-
-- correction pass had written for the session being undone). Per section
-- 5.3, this function has never run for real data -- no stocktake session
-- has ever been reversed -- and after Phase C commit 2/8 removed the
-- ingredient-correction write itself, there is nothing left in
-- stock_ledger for a future reversal to compensate for anyway. The
-- stock_issues reversal loop (the real COGS-side undo) is untouched.
--
-- ledger_count/ledger_ids dropped from the return contract entirely, same
-- move as commits 2/8 and 3/8 made where nothing is left to report --
-- unlike apply_stocktake_session_atomic's ingredient corrections, there is
-- no still-useful "detected but not written" value to preserve here, since
-- this loop only ever compensated a write that no longer happens.
--
-- Signature is unchanged (no parameters touched), so this is a plain
-- create-or-replace.
--
-- Deploy order (section 5.7): application code must stop reading
-- result.ledgerCount/ledgerIds BEFORE this migration is applied, since
-- those fields disappear from the return value.

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
