-- supabase/migrations/0122_stocktake_edit_headroom.sql
-- Kho dot 1, K1 (audit finding 1): editing a confirmed stocktake's counted
-- quantity can no longer push an item's stock below zero on any day from the
-- count's date to today. Same rule the other stock writers use
-- (issue_stock_headroom, 0106; the undo of a stocktake, 0111).
--
-- Example: Sữa tươi was counted 8 against a book of 10 on 10/10 (issue row 2).
-- Slips of 8 are issued on 12/10. Editing the count down to 5 makes the issue
-- row 5, so the balance from 10/10 is 5 and drops to -3 on 12/10: refused,
-- nothing written. Raising the count only puts goods back and always passes.
--
-- Body copied from 0110 (the only definition of this function); the only change
-- is the headroom check after the loop, marked "0122". A refused edit rolls the
-- whole call back, including the lines already updated in the loop. The check
-- reports the shortfall and the count's date; the lowest point itself may fall
-- on a later day, issue_stock_headroom returns only the minimum.
--
-- NOT YET RUN on the server; the owner approves running it separately. The
-- application code does not depend on it: without it the edit behaves as
-- before, with it the refusal text arrives through describeActionError.
--
-- Triggers: unchanged from 0110 (no new write, only a read of stock_issues).
create or replace function public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_status text;
  v_confirmed_at timestamptz;
  v_latest_id text;
  v_next_issue_number integer;
  v_entry jsonb;
  v_line_id text;
  v_line record;
  v_new_qty numeric(18,6);
  v_variance numeric(18,6);
  v_existing_issue_id text;
  v_existing_count integer;
  v_issue_id text;
  v_note text;
  v_changed integer := 0;
  -- 0122
  v_items text[] := '{}';
  v_check text;
  v_low numeric;
  v_unit_name text;
  v_issue_ids jsonb := '[]'::jsonb;
begin
  if v_session_id is null then raise exception 'p_session_id is required'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Không có dòng nào để sửa';
  end if;

  select status, confirmed_at into v_status, v_confirmed_at
  from public.stocktake_sessions where id = v_session_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê %', v_session_id; end if;
  if v_status <> 'CONFIRMED' then
    raise exception 'Phiếu kiểm kê % không ở trạng thái đã xác nhận, không sửa được', v_session_id;
  end if;
  if exists (select 1 from public.stocktake_sessions where status = 'OPEN') then
    raise exception 'Đang có một phiếu kiểm kê mở -- xong phiếu đó rồi mới sửa được phiếu cũ';
  end if;
  select id into v_latest_id from public.stocktake_sessions
  where status = 'CONFIRMED' order by confirmed_at desc limit 1;
  if v_latest_id <> v_session_id then
    raise exception 'Chỉ sửa được phiếu kiểm kê mới nhất (%), không phải %', v_latest_id, v_session_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number from public.stock_issues where id ~ '^ISS-[0-9]+$';

  for v_entry in select value from jsonb_array_elements(p_lines) loop
    v_line_id := nullif(btrim(coalesce(v_entry->>'line_id', '')), '');
    if jsonb_typeof(v_entry->'counted_qty') is distinct from 'number' then
      raise exception 'Số đếm của dòng % phải là một số', coalesce(v_line_id, '?');
    end if;
    v_new_qty := (v_entry->>'counted_qty')::numeric;
    if v_new_qty < 0 then raise exception 'Số đếm của dòng % không được âm', v_line_id; end if;

    select id, item_reference, item_type, counted_qty, theoretical_at_count into v_line
    from public.stocktake_lines where id = v_line_id and session_id = v_session_id for update;
    if not found then raise exception 'Dòng % không thuộc phiếu %', coalesce(v_line_id, '?'), v_session_id; end if;
    if v_line.item_type <> 'PURCHASED_ITEM' then
      raise exception 'Dòng % không phải hàng mua, không sửa được', v_line_id;
    end if;
    if v_line.theoretical_at_count is null then
      raise exception 'Dòng % không có số sổ lúc đếm', v_line_id;
    end if;
    if v_line.counted_qty is not distinct from v_new_qty then continue; end if;

    update public.stocktake_lines set counted_qty = v_new_qty where id = v_line_id;
    v_changed := v_changed + 1;
    v_items := array_append(v_items, v_line.item_reference);
    v_variance := v_new_qty - v_line.theoretical_at_count;

    select count(*), min(id) into v_existing_count, v_existing_issue_id
    from public.stock_issues
    where session_id = v_session_id and purchased_item_id = v_line.item_reference and reverses_issue_id is null;
    if v_existing_count > 1 then
      raise exception 'Phiếu % có % dòng xuất cho cùng một hàng, cần kiểm tay', v_session_id, v_existing_count;
    end if;

    -- Same note texts as apply_stocktake_session_atomic (0089), dated the count.
    if v_variance > 0 then
      v_note := 'Hàng tìm lại được (BR-INV-008) -- kiểm kê định kỳ ' ||
        to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
    else
      v_note := 'Kiểm kê định kỳ ' || to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
    end if;

    if v_variance = 0 then
      if v_existing_issue_id is not null then
        delete from public.stock_issues where id = v_existing_issue_id;
      end if;
    elsif v_existing_issue_id is not null then
      update public.stock_issues set base_quantity = -v_variance, note = v_note where id = v_existing_issue_id;
      v_issue_ids := v_issue_ids || jsonb_build_array(v_existing_issue_id);
    else
      v_next_issue_number := v_next_issue_number + 1;
      v_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');
      insert into public.stock_issues (id, purchased_item_id, issued_at, base_quantity, source, session_id, note)
      values (v_issue_id, v_line.item_reference, v_confirmed_at, -v_variance, 'STOCKTAKE', v_session_id, v_note);
      v_issue_ids := v_issue_ids || jsonb_build_array(v_issue_id);
    end if;
  end loop;

  -- 0122: after every row is written (so two edited lines of one item count
  -- together), the item's lowest balance from the count's date to now must stay
  -- at or above zero.
  for v_check in select distinct unnest(v_items) loop
    v_low := public.issue_stock_headroom(v_check, v_confirmed_at);
    if v_low < 0 then
      select u.name into v_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_check and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Không sửa được: % sẽ âm kho, thiếu % % tính từ ngày kiểm kê % vì số hàng đó đã được xuất hoặc dùng sau ngày này. Giữ số đếm cao hơn hoặc xử lý phần đã xuất trước.',
        (select pi.name from public.purchased_items pi where pi.id = v_check),
        abs(v_low), coalesce(v_unit_name, ''),
        to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY');
    end if;
  end loop;

  return jsonb_build_object('session_id', v_session_id, 'changed_count', v_changed, 'issue_ids', v_issue_ids);
end;
$$;

revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from public;
revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from anon;
revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from authenticated;
grant execute on function public.edit_confirmed_stocktake_atomic(text, jsonb) to service_role;
