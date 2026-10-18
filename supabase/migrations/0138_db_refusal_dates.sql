-- supabase/migrations/0138_db_refusal_dates.sql
-- BR-DATA-006 (owner 2026-10-18): every date outside a filter shows dd/mm/yyyy HH:mm:ss. NOT YET RUN on the server.
--
-- Five functions still built a refusal message with a date that stops at the minute or at the day, or printed a raw
-- timestamp (yyyy-mm-dd hh:mm:ss+offset, in the connection's time zone) or a raw date (2026-03-27). Every such date is now
-- to_char(<ts> at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'), or, for a date column, to_char(<date>,
-- 'DD/MM/YYYY HH24:MI:SS') with no "at time zone" (Postgres reads the date as midnight in the session zone, which has
-- no daylight saving here), so a whole day reads 27/03/2026 00:00:00:
--   create_issue_slip_atomic        'Ngày xuất ... nằm trước lần kiểm kê ... đã chốt'      (minute)
--                                   'p_issued_at (...) cannot be in the future'            (raw timestamp)
--                                   'Dòng ... chưa có đơn nhập nào tính tới thời điểm ...' (raw timestamp)
--   edit_issue_slip_atomic          'Dòng ... chưa có đơn nhập nào tính tới thời điểm ...' (raw timestamp)
--   edit_confirmed_stocktake_atomic 'Không sửa được: ... tính từ ngày kiểm kê ...'         (day)
--   save_purchase_order_atomic      the two stocktake-lock refusals, the new-order one (minute, day) and the edit one (day)
--   asset_disposals_guard           'Ngày thanh lý phải từ ngày mua (...) đến hôm nay'     (raw date)
-- Nothing else changes: signature, return type, wording, body, ACL. The future-date refusal stays in English because
-- app/admin/inventory/issue-slips/actions.ts matches on "cannot be in the future" and shows its own Vietnamese text.
-- The stored stock-issue note 'Kiểm kê định kỳ ' || to_char(..., 'YYYY-MM-DD') is data, not a message: left as it is.
--
-- Source: create_issue_slip_atomic, edit_confirmed_stocktake_atomic and edit_issue_slip_atomic from 0136,
-- save_purchase_order_atomic from 0133, asset_disposals_guard from 0132 (the newest migration of each). Measured
-- 2026-10-18 with a read-only pg_proc query: the server's prosrc of all five equals that text (line endings aside),
-- no other public function has a 'DD/MM/YY' format in its source, and a scan of every public function's raise
-- statements found no other one printing a timestamp or date outside to_char.
-- Triggers: asset_disposals_guard is the function of the trigger asset_disposals_guard (BEFORE INSERT on
-- asset_disposals, row level; read from pg_trigger, 2026-10-18). The trigger is not touched: only create or replace
-- function, no drop, no create trigger. No table is written; create or replace keeps owner and grants.
-- Return type unchanged, so it can run before or after the code; only the text of exceptions differs.

create or replace function public.create_issue_slip_atomic(p_issued_at timestamp with time zone, p_note text, p_created_by_id text, p_created_by_name text, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_next_slip_number integer;
  v_slip_id text;
  v_next_issue_number integer;
  v_issue_id text;
  v_line record;
  v_line_index integer := 0;
  v_item_ids text[] := '{}';
  v_remaining numeric[] := '{}';
  v_idx integer;
  v_item_name text;
  v_base_unit_name text;
  v_total_purchased_asof numeric(18,6);
  v_lock text;
  v_results jsonb := '[]'::jsonb;
begin
  if p_issued_at is null then raise exception 'p_issued_at is required'; end if;
  if p_issued_at > now() + interval '5 minutes' then
    raise exception 'p_issued_at (%) cannot be in the future', to_char(p_issued_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS');
  end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'p_lines must be a non-empty JSON array';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform pg_advisory_xact_lock(hashtext('issue_slips:id'));

  -- 0106 (BR-INV-013, owner 2026-09-29): no new slip on or before the last
  -- confirmed stocktake.
  v_lock := public.issue_slip_stocktake_lock(p_issued_at);
  if v_lock is not null then
    raise exception 'Ngày xuất % nằm trước lần kiểm kê % đã chốt. Chọn ngày sau lần kiểm kê.',
      to_char(p_issued_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'), v_lock;
  end if;

  select coalesce(max(substring(id from '^ISL-([0-9]+)$')::integer), 0) + 1
  into v_next_slip_number
  from public.issue_slips where id ~ '^ISL-[0-9]+$';
  v_slip_id := 'ISL-' || repeat('0', greatest(5 - length(v_next_slip_number::text), 0)) || v_next_slip_number::text;
  insert into public.issue_slips (id, issued_at, created_by_id, created_by_name)
  values (v_slip_id, p_issued_at, v_created_by_id, v_created_by_name);

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';

  for v_line in
    select * from jsonb_to_recordset(p_lines) as x(purchased_item_id text, base_quantity numeric)
  loop
    v_line_index := v_line_index + 1;

    if nullif(btrim(coalesce(v_line.purchased_item_id, '')), '') is null then
      raise exception 'Dòng %: thiếu mặt hàng', v_line_index;
    end if;
    if v_line.base_quantity is null or v_line.base_quantity <= 0 or v_line.base_quantity = 'NaN'::numeric then
      raise exception 'Dòng %: số lượng phải lớn hơn 0', v_line_index;
    end if;

    select name into v_item_name
    from public.purchased_items where id = v_line.purchased_item_id;
    if v_item_name is null then
      raise exception 'Dòng %: không tìm thấy mặt hàng %', v_line_index, v_line.purchased_item_id;
    end if;

    -- I10: seed the running balance once per distinct purchased item, then
    -- reuse and decrement it for every later line naming the same item.
    v_idx := array_position(v_item_ids, v_line.purchased_item_id);
    if v_idx is null then
      select coalesce(sum(pol.base_quantity), 0)
      into v_total_purchased_asof
      from public.purchase_order_lines pol
      join public.purchase_orders po on po.id = pol.purchase_order_id
      where po.status = 'COMPLETED'
        and pol.purchased_item_id = v_line.purchased_item_id
        and coalesce(po.transaction_date, po.created_at) <= p_issued_at;

      if v_total_purchased_asof = 0 then
        raise exception 'Dòng % (%): chưa có đơn nhập nào tính tới thời điểm %, không thể xuất trước khi nhập',
          v_line_index, v_item_name, to_char(p_issued_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS');
      end if;

      v_item_ids := array_append(v_item_ids, v_line.purchased_item_id);
      -- 0106: lowest balance from the slip date to now, not only at the date.
      v_remaining := array_append(v_remaining, public.issue_stock_headroom(v_line.purchased_item_id, p_issued_at));
      v_idx := array_length(v_item_ids, 1);
    end if;

    if v_line.base_quantity > v_remaining[v_idx] then
      select u.name into v_base_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_line.purchased_item_id and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Không đủ tồn kho cho %: từ ngày phiếu tới nay có lúc kho chỉ còn % %.',
        v_item_name, v_remaining[v_idx], coalesce(v_base_unit_name, '');
    end if;
    v_remaining[v_idx] := v_remaining[v_idx] - v_line.base_quantity;

    v_next_issue_number := v_next_issue_number + 1;
    v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;
    insert into public.stock_issues (
      id, purchased_item_id, issued_at, base_quantity, source, session_id, note, issue_slip_id
    ) values (
      v_issue_id, v_line.purchased_item_id, p_issued_at, v_line.base_quantity, 'MANUAL', null, '', v_slip_id
    );
    -- No stock_ledger row: retire-the-stock-ledger plan's phase C, applied
    -- to this function ahead of its planned order because it is what blocks
    -- the owner. stock_issues (keyed on purchased_item_id) is the
    -- authoritative record; computeOnHandByPurchasedItem reads it, not the
    -- ledger.

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'issue_id', v_issue_id,
      'purchased_item_id', v_line.purchased_item_id,
      'base_quantity', v_line.base_quantity,
      'on_hand_after', v_remaining[v_idx]
    ));
  end loop;

  return jsonb_build_object(
    'slip_id', v_slip_id,
    'issued_at', p_issued_at,
    'note', '',
    'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name,
    'lines', v_results
  );
end;
$function$;

create or replace function public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    select id, item_reference, counted_qty, theoretical_at_count into v_line
    from public.stocktake_lines where id = v_line_id and session_id = v_session_id for update;
    if not found then raise exception 'Dòng % không thuộc phiếu %', coalesce(v_line_id, '?'), v_session_id; end if;
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
      v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;
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
        to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS');
    end if;
  end loop;

  return jsonb_build_object('session_id', v_session_id, 'changed_count', v_changed, 'issue_ids', v_issue_ids);
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb DEFAULT '[]'::jsonb, p_replace_existing boolean DEFAULT false, p_assets jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_po_id text;
  v_next_number integer;
  v_existing_id text;
  v_existing_status text;
  v_existing_created_at timestamptz;
  v_stored public.purchase_orders%rowtype;
  v_lock text;
  v_moves boolean;
  v_line_count integer;
  -- 0112
  v_old_at timestamptz;
  v_new_at timestamptz;
  v_from timestamptz;
  v_items text[] := '{}';
  v_before numeric[] := '{}';
  v_after numeric;
  v_i integer;
  v_unit_name text;
  v_next_asset_number integer;
  v_asset record;
  -- 0116
  v_prev_status text;
  v_prev_created_at timestamptz;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;
  if p_assets is not null and jsonb_typeof(p_assets) <> 'object' then
    raise exception 'p_assets must be a JSON object';
  end if;

  -- 0108: a cancelled order is written only by cancel_purchase_order_atomic.
  if coalesce(nullif(p_order->>'status', ''), 'DRAFT') not in ('DRAFT', 'COMPLETED') then
    raise exception 'p_order.status must be DRAFT or COMPLETED';
  end if;

  v_po_id := nullif(btrim(p_order->>'id'), '');

  -- 0116 (BR-INV-018, owner 2026-10-14): a new completed order, or a draft being
  -- completed, dated on or before the last confirmed stocktake is refused: the
  -- count already holds those goods, so the book would gain them twice. A draft
  -- save, and a save of an order already stored as COMPLETED (0112's edit rules
  -- below), are not touched. The stock lock is taken first, as the slip writers
  -- do, so a stocktake confirming at the same instant is seen.
  if coalesce(nullif(p_order->>'status', ''), 'DRAFT') = 'COMPLETED' then
    perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
    if p_replace_existing then
      select po.status, po.created_at into v_prev_status, v_prev_created_at
      from public.purchase_orders po where po.id = v_po_id;
    end if;
    if v_prev_status is distinct from 'COMPLETED' then
      v_new_at := coalesce(
        nullif(p_order->>'transaction_date', '')::timestamptz,
        v_prev_created_at,
        nullif(p_order->>'created_at', '')::timestamptz,
        now()
      );
      v_lock := public.issue_slip_stocktake_lock(v_new_at);
      if v_lock is not null then
        raise exception 'Phiếu nhập ngày % nằm trước lần kiểm kê % (%) nên không ghi nhận hoàn thành được: lần kiểm kê đã đếm lại hàng trên kệ. Chọn ngày sau lần kiểm kê, hoặc lưu nháp. Muốn ghi lùi ngày, huỷ các lần kiểm kê từ mới nhất trở về trước (BR-INV-018).',
          to_char(v_new_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'), v_lock,
          to_char((select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock) at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS');
      end if;
    end if;
  end if;

  if v_po_id is null then
    perform pg_advisory_xact_lock(hashtext('purchase_orders:id'));
    select coalesce(
      max((substring(id from '^PO-([0-9]+)$'))::integer),
      0
    ) + 1
    into v_next_number
    from public.purchase_orders;
    v_po_id := 'PO-' || repeat('0', greatest(3 - length(v_next_number::text), 0)) || v_next_number::text;
  elsif not p_replace_existing and exists (
    select 1 from public.purchase_orders where id = v_po_id
  ) then
    raise exception 'Purchase order % already exists', v_po_id;
  end if;

  if p_replace_existing then
    -- 0112 (A3a): the same stock lock as cancel_purchase_order_atomic and the
    -- slip writers, taken before the row lock (cancel takes them in this order
    -- too), so a slip saved at the same instant waits and the balance read below
    -- is settled.
    perform pg_advisory_xact_lock(hashtext('stock_issues:id'));

    select * into v_stored
    from public.purchase_orders
    where id = v_po_id
    for update;
    v_existing_id := v_stored.id;
    v_existing_status := v_stored.status;
    v_existing_created_at := v_stored.created_at;
    v_old_at := coalesce(v_stored.transaction_date, v_stored.created_at);

    if v_existing_id is null then
      raise exception 'Purchase order % does not exist', v_po_id;
    end if;
    -- 0108: a save that waited on a cancel meets CANCELLED here.
    if v_existing_status = 'CANCELLED' then
      raise exception 'Phiếu đã huỷ, không sửa được';
    end if;

    -- 0112 (A3a): a completed order counts in stock. Measure every item of the
    -- old and the new lines from the earlier of the old and the new date, now,
    -- before anything is written.
    if v_existing_status = 'COMPLETED' then
      select coalesce(array_agg(distinct s.item), '{}') into v_items
      from (
        select l.purchased_item_id as item
        from public.purchase_order_lines l where l.purchase_order_id = v_po_id
        union
        select nullif(x.purchased_item_id, '')
        from jsonb_to_recordset(p_lines) as x(purchased_item_id text)
      ) s
      where s.item is not null;

      v_new_at := coalesce(nullif(p_order->>'transaction_date', '')::timestamptz, v_existing_created_at);

      -- 0112 (BR-INV-018, owner 2026-10-14, audit A3b): an order dated on or
      -- before the last confirmed stocktake keeps its stock and cost, like the
      -- cancel (BR-INV-015). Only an edit that moves stock or cost is refused:
      -- the date, the amounts or the lines. Notes, invoice code and payment
      -- details are not compared and stay editable.
      -- The date is compared to the second: the form sends no milliseconds, an
      -- order saved with a blank picker is stored with them.
      v_moves := date_trunc('second', v_new_at) is distinct from date_trunc('second', v_old_at)
        or v_stored.subtotal_amount is distinct from coalesce(nullif(p_order->>'subtotal_amount', ''), '0')::bigint
        or v_stored.shipping_fee is distinct from coalesce(nullif(p_order->>'shipping_fee', ''), '0')::bigint
        or v_stored.tax_amount is distinct from coalesce(nullif(p_order->>'tax_amount', ''), '0')::bigint
        or v_stored.voucher_amount is distinct from coalesce(nullif(p_order->>'voucher_amount', ''), '0')::bigint
        or v_stored.discount_amount is distinct from coalesce(nullif(p_order->>'discount_amount', ''), '0')::bigint
        or v_stored.total_amount is distinct from coalesce(nullif(p_order->>'total_amount', ''), '0')::bigint
        or (select count(*) from public.purchase_order_lines l where l.purchase_order_id = v_po_id)
           <> jsonb_array_length(p_lines)
        or exists (
          (select coalesce(l.purchased_item_id, ''), coalesce(l.unit, ''), coalesce(l.quantity, 0),
                  coalesce(l.unit_price, 0), coalesce(l.subtotal, 0), coalesce(l.base_quantity, 0)
           from public.purchase_order_lines l where l.purchase_order_id = v_po_id)
          except all
          (select coalesce(x.purchased_item_id, ''), coalesce(x.unit, ''), coalesce(x.quantity, 0),
                  coalesce(x.unit_price, 0), coalesce(x.subtotal, 0), coalesce(x.base_quantity, 0)
           from jsonb_to_recordset(p_lines) as x(purchased_item_id text, unit text, quantity numeric,
                                                 unit_price bigint, subtotal bigint, base_quantity numeric))
        )
        or exists (
          (select coalesce(x.purchased_item_id, ''), coalesce(x.unit, ''), coalesce(x.quantity, 0),
                  coalesce(x.unit_price, 0), coalesce(x.subtotal, 0), coalesce(x.base_quantity, 0)
           from jsonb_to_recordset(p_lines) as x(purchased_item_id text, unit text, quantity numeric,
                                                 unit_price bigint, subtotal bigint, base_quantity numeric))
          except all
          (select coalesce(l.purchased_item_id, ''), coalesce(l.unit, ''), coalesce(l.quantity, 0),
                  coalesce(l.unit_price, 0), coalesce(l.subtotal, 0), coalesce(l.base_quantity, 0)
           from public.purchase_order_lines l where l.purchase_order_id = v_po_id)
        );
      if v_moves then
        v_lock := public.issue_slip_stocktake_lock(v_old_at);
        if v_lock is null then
          v_lock := public.issue_slip_stocktake_lock(v_new_at);
        end if;
        if v_lock is not null then
          raise exception 'Phiếu % nằm trước lần kiểm kê % (%) nên không sửa được hàng, tiền hay ngày nữa: lần kiểm kê đã đếm lại hàng trên kệ. Muốn sửa, huỷ các lần kiểm kê từ mới nhất trở về trước.',
            v_po_id, v_lock,
            to_char((select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock) at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS');
        end if;
      end if;
      v_from := least(v_old_at, v_new_at);
      for v_i in 1..coalesce(cardinality(v_items), 0) loop
        v_before[v_i] := public.issue_stock_headroom(v_items[v_i], v_from);
      end loop;
    end if;

    update public.purchase_orders
    set
      supplier_id = nullif(p_order->>'supplier_id', ''),
      source_id = nullif(p_order->>'source_id', ''),
      transaction_date = nullif(p_order->>'transaction_date', '')::timestamptz,
      supplier_invoice_code = nullif(p_order->>'supplier_invoice_code', ''),
      notes = nullif(p_order->>'notes', ''),
      subtotal_amount = coalesce(nullif(p_order->>'subtotal_amount', ''), '0')::bigint,
      shipping_fee = coalesce(nullif(p_order->>'shipping_fee', ''), '0')::bigint,
      tax_amount = coalesce(nullif(p_order->>'tax_amount', ''), '0')::bigint,
      voucher_amount = coalesce(nullif(p_order->>'voucher_amount', ''), '0')::bigint,
      discount_amount = coalesce(nullif(p_order->>'discount_amount', ''), '0')::bigint,
      total_amount = coalesce(nullif(p_order->>'total_amount', ''), '0')::bigint,
      status = coalesce(nullif(p_order->>'status', ''), 'DRAFT'),
      payment_method = nullif(p_order->>'payment_method', ''),
      bank_account_id = nullif(p_order->>'bank_account_id', ''),
      updated_at = now()
    where id = v_po_id;

    delete from public.purchase_order_lines
    where purchase_order_id = v_po_id;
  else
    insert into public.purchase_orders (
      id,
      supplier_id,
      source_id,
      transaction_date,
      supplier_invoice_code,
      notes,
      subtotal_amount,
      shipping_fee,
      tax_amount,
      voucher_amount,
      discount_amount,
      total_amount,
      status,
      payment_method,
      bank_account_id,
      created_by_id,
      created_by_name,
      created_at
    )
    values (
      v_po_id,
      nullif(p_order->>'supplier_id', ''),
      nullif(p_order->>'source_id', ''),
      nullif(p_order->>'transaction_date', '')::timestamptz,
      nullif(p_order->>'supplier_invoice_code', ''),
      nullif(p_order->>'notes', ''),
      coalesce(nullif(p_order->>'subtotal_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'shipping_fee', ''), '0')::bigint,
      coalesce(nullif(p_order->>'tax_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'voucher_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'discount_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'total_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'status', ''), 'DRAFT'),
      nullif(p_order->>'payment_method', ''),
      nullif(p_order->>'bank_account_id', ''),
      nullif(p_order->>'created_by_id', ''),
      nullif(p_order->>'created_by_name', ''),
      coalesce(
        nullif(p_order->>'created_at', '')::timestamptz,
        now()
      )
    );
  end if;

  insert into public.purchase_order_lines (
    id,
    purchase_order_id,
    purchased_item_id,
    unit,
    quantity,
    unit_price,
    subtotal,
    conversion_id,
    base_quantity,
    created_at
  )
  select
    row.id,
    v_po_id,
    nullif(row.purchased_item_id, ''),
    nullif(row.unit, ''),
    coalesce(row.quantity, 0),
    coalesce(row.unit_price, 0),
    coalesce(row.subtotal, 0),
    nullif(row.conversion_id, ''),
    coalesce(row.base_quantity, 0),
    coalesce(row.created_at, now())
  from jsonb_to_recordset(p_lines) as row(
    id text,
    purchased_item_id text,
    unit text,
    quantity numeric,
    unit_price bigint,
    subtotal bigint,
    conversion_id text,
    base_quantity numeric,
    created_at timestamptz
  );
  get diagnostics v_line_count = row_count;

  -- 0112 (A3a): the balance again, with the new lines in place. Refused only
  -- when the item is under zero AND lower than before this edit; the raise
  -- rolls the whole save back.
  if v_existing_status = 'COMPLETED' then
    for v_i in 1..coalesce(cardinality(v_items), 0) loop
      v_after := public.issue_stock_headroom(v_items[v_i], v_from);
      if v_after < 0 and v_after < v_before[v_i] then
        select u.name into v_unit_name
        from public.uom_conversions uc join public.units u on u.id = uc.base_unit
        where uc.purchased_item_id = v_items[v_i] and uc.status = 'ACTIVE'
        order by uc.id
        limit 1;
        raise exception 'Không sửa được phiếu %: % sẽ âm kho -- từ ngày phiếu tới nay có lúc kho chỉ còn % %. Hàng này đã được xuất hoặc dùng.',
          v_po_id,
          (select pi.name from public.purchased_items pi where pi.id = v_items[v_i]),
          v_after, coalesce(v_unit_name, '');
      end if;
    end loop;
  end if;

  -- 0112 (A7): the assets of this order, in the same transaction.
  if p_assets is not null then
    perform pg_advisory_xact_lock(hashtext('assets:id'));

    update public.assets
    set status = 'INACTIVE'
    where id in (select jsonb_array_elements_text(coalesce(p_assets->'retire', '[]'::jsonb)));

    for v_asset in
      select * from jsonb_to_recordset(coalesce(p_assets->'update', '[]'::jsonb)) as x(id text, patch jsonb)
    loop
      update public.assets
      set
        quantity = coalesce((v_asset.patch->>'quantity')::int, quantity),
        unit_cost = coalesce((v_asset.patch->>'unit_cost')::bigint, unit_cost),
        total_cost = coalesce((v_asset.patch->>'total_cost')::bigint, total_cost),
        term_months = coalesce((v_asset.patch->>'term_months')::int, term_months),
        acquired_date = coalesce((v_asset.patch->>'acquired_date')::date, acquired_date)
      where id = v_asset.id;
    end loop;

    -- Same id shape as generateNewId("assets", "TS"): TS-001, never cut at 3
    -- digits (lpad would turn 1000 into 100).
    select coalesce(max(substring(id from '^TS-([0-9]+)$')::integer), 0)
    into v_next_asset_number
    from public.assets where id ~ '^TS-[0-9]+$';

    for v_asset in
      select * from jsonb_to_recordset(coalesce(p_assets->'create', '[]'::jsonb)) as x(
        purchased_item_id text,
        purchase_order_line_id text,
        name_snapshot text,
        acquired_date date,
        unit_cost bigint,
        total_cost bigint,
        quantity int,
        term_months int
      )
    loop
      v_next_asset_number := v_next_asset_number + 1;
      insert into public.assets (
        id, purchased_item_id, purchase_order_line_id, name_snapshot, acquired_date,
        unit_cost, total_cost, quantity, term_months
      ) values (
        'TS-' || repeat('0', greatest(3 - length(v_next_asset_number::text), 0)) || v_next_asset_number::text,
        v_asset.purchased_item_id, v_asset.purchase_order_line_id, v_asset.name_snapshot, v_asset.acquired_date,
        v_asset.unit_cost, v_asset.total_cost, v_asset.quantity, v_asset.term_months
      );
    end loop;
  end if;

  return jsonb_build_object(
    'purchase_order_id', v_po_id,
    'line_count', v_line_count
  );
end;
$function$;

create or replace function public.edit_issue_slip_atomic(p_slip_id text, p_remove_issue_ids text[], p_replace_issue_ids text[], p_add_lines jsonb, p_created_by_id text, p_created_by_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_slip_id text := nullif(btrim(coalesce(p_slip_id, '')), '');
  v_remove text[] := coalesce(p_remove_issue_ids, '{}'::text[]);
  v_replace text[] := coalesce(p_replace_issue_ids, '{}'::text[]);
  v_all_ids text[];
  v_original record;
  v_reversal_number integer;
  v_add jsonb := coalesce(p_add_lines, '[]'::jsonb);
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_slip record;
  v_lock text;
  v_active integer;
  v_all_distinct integer;
  v_id text;
  v_reversal jsonb;
  v_removed jsonb := '[]'::jsonb;
  v_added jsonb := '[]'::jsonb;
  v_next_issue_number integer;
  v_issue_id text;
  v_line record;
  v_line_index integer := 0;
  v_item_ids text[] := '{}';
  v_remaining numeric[] := '{}';
  v_idx integer;
  v_item_name text;
  v_base_unit_name text;
  v_total_purchased_asof numeric(18,6);
begin
  if v_slip_id is null then raise exception 'p_slip_id is required'; end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;
  if jsonb_typeof(v_add) <> 'array' then raise exception 'p_add_lines must be a JSON array'; end if;
  v_all_ids := v_remove || v_replace;
  if cardinality(v_all_ids) = 0 and jsonb_array_length(v_add) = 0 then
    raise exception 'Chưa có thay đổi nào.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));

  select * into v_slip from public.issue_slips where id = v_slip_id for update;
  if v_slip.id is null then raise exception 'Không tìm thấy phiếu %', v_slip_id; end if;

  v_lock := public.issue_slip_stocktake_lock(v_slip.issued_at);
  if v_lock is not null then
    raise exception 'Phiếu % nằm trước lần kiểm kê % nên không sửa được nữa.', v_slip_id, v_lock;
  end if;

  -- A slip with no active line is cancelled (or fully reversed): refuse first.
  select count(*) into v_active
  from public.stock_issues si
  where si.issue_slip_id = v_slip_id
    and not exists (select 1 from public.stock_issues r where r.reverses_issue_id = si.id);
  if v_active = 0 then
    raise exception 'Phiếu xuất % đã huỷ, không sửa được.', v_slip_id;
  end if;

  -- Null and duplicate checks cover remove + replace together: an id in both
  -- lists would reverse one line twice.
  if exists (select 1 from unnest(v_all_ids) as x where x is null) then
    raise exception 'Danh sách dòng bỏ có mã trống.';
  end if;
  select count(distinct x) into v_all_distinct from unnest(v_all_ids) as x;
  if v_all_distinct <> cardinality(v_all_ids) then
    raise exception 'Danh sách dòng bỏ có mã trùng nhau.';
  end if;

  -- Every removed or replaced line leaves; a replaced line comes back as one
  -- of the p_add_lines, which is counted there.
  if v_active - cardinality(v_all_ids) + jsonb_array_length(v_add) <= 0 then
    raise exception 'Phiếu không còn dòng nào. Huỷ phiếu nếu muốn bỏ hết.';
  end if;

  foreach v_id in array v_remove loop
    if not exists (
      select 1 from public.stock_issues si
      where si.id = v_id and si.issue_slip_id = v_slip_id and si.source = 'MANUAL'
        and not exists (select 1 from public.stock_issues r where r.reverses_issue_id = si.id)
    ) then
      raise exception 'Dòng % không thuộc phiếu % hoặc đã trả về kho', v_id, v_slip_id;
    end if;
    v_reversal := public.reverse_manual_issue_atomic(v_id, 'Sửa phiếu ' || v_slip_id, v_created_by_id, v_created_by_name);
    v_removed := v_removed || jsonb_build_array(jsonb_build_object(
      'reversal_issue_id', v_reversal->>'reversal_issue_id',
      'reverses_issue_id', v_reversal->>'reverses_issue_id'
    ));
  end loop;

  -- Replaced lines (quantity changed): the return is dated at the original
  -- row's own date, so the old quantity is back in stock from the slip's date
  -- on (BR-INV-013, owner 2026-09-29). Pure removals above stay dated now.
  foreach v_id in array v_replace loop
    select * into v_original from public.stock_issues si
    where si.id = v_id and si.issue_slip_id = v_slip_id and si.source = 'MANUAL'
      and not exists (select 1 from public.stock_issues r where r.reverses_issue_id = si.id)
    for update;
    if not found then
      raise exception 'Dòng % không thuộc phiếu % hoặc đã trả về kho', v_id, v_slip_id;
    end if;
    select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0) + 1
    into v_reversal_number
    from public.stock_issues where id ~ '^ISS-[0-9]+$';
    v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_reversal_number::text), 0)) || v_reversal_number::text;
    insert into public.stock_issues (
      id, purchased_item_id, issued_at, base_quantity, source, session_id, note, reverses_issue_id
    ) values (
      v_issue_id, v_original.purchased_item_id, v_original.issued_at, -v_original.base_quantity, 'MANUAL', null,
      'Sửa số lượng phiếu ' || v_slip_id, v_id
    );
    v_removed := v_removed || jsonb_build_array(jsonb_build_object(
      'reversal_issue_id', v_issue_id,
      'reverses_issue_id', v_id
    ));
  end loop;

  -- Order matters: every reversal (removed ones now, replaced ones on the slip
  -- date) is written BEFORE issue_stock_headroom is read below, so a replaced
  -- line's credit at the slip date counts. Lowering is then never refused, and
  -- raising 1.000 g to 1.500 g needs only 500 g of headroom.
  -- Take the next ISS number after the reversals above, which used numbers.
  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';

  for v_line in
    select * from jsonb_to_recordset(v_add) as x(purchased_item_id text, base_quantity numeric)
  loop
    v_line_index := v_line_index + 1;

    if nullif(btrim(coalesce(v_line.purchased_item_id, '')), '') is null then
      raise exception 'Dòng %: thiếu mặt hàng', v_line_index;
    end if;
    if v_line.base_quantity is null or v_line.base_quantity <= 0 or v_line.base_quantity = 'NaN'::numeric then
      raise exception 'Dòng %: số lượng phải lớn hơn 0', v_line_index;
    end if;

    select name into v_item_name
    from public.purchased_items where id = v_line.purchased_item_id;
    if v_item_name is null then
      raise exception 'Dòng %: không tìm thấy mặt hàng %', v_line_index, v_line.purchased_item_id;
    end if;

    -- Seed the running balance once per distinct item (cumulative, as 0094).
    v_idx := array_position(v_item_ids, v_line.purchased_item_id);
    if v_idx is null then
      select coalesce(sum(pol.base_quantity), 0)
      into v_total_purchased_asof
      from public.purchase_order_lines pol
      join public.purchase_orders po on po.id = pol.purchase_order_id
      where po.status = 'COMPLETED'
        and pol.purchased_item_id = v_line.purchased_item_id
        and coalesce(po.transaction_date, po.created_at) <= v_slip.issued_at;

      if v_total_purchased_asof = 0 then
        raise exception 'Dòng % (%): chưa có đơn nhập nào tính tới thời điểm %, không thể xuất trước khi nhập',
          v_line_index, v_item_name, to_char(v_slip.issued_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS');
      end if;

      v_item_ids := array_append(v_item_ids, v_line.purchased_item_id);
      v_remaining := array_append(v_remaining, public.issue_stock_headroom(v_line.purchased_item_id, v_slip.issued_at));
      v_idx := array_length(v_item_ids, 1);
    end if;

    if v_line.base_quantity > v_remaining[v_idx] then
      select u.name into v_base_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_line.purchased_item_id and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Không đủ tồn kho cho %: từ ngày phiếu tới nay có lúc kho chỉ còn % %.',
        v_item_name, v_remaining[v_idx], coalesce(v_base_unit_name, '');
    end if;
    v_remaining[v_idx] := v_remaining[v_idx] - v_line.base_quantity;

    v_next_issue_number := v_next_issue_number + 1;
    v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;
    insert into public.stock_issues (
      id, purchased_item_id, issued_at, base_quantity, source, session_id, note, issue_slip_id
    ) values (
      v_issue_id, v_line.purchased_item_id, v_slip.issued_at, v_line.base_quantity, 'MANUAL', null, '', v_slip_id
    );

    v_added := v_added || jsonb_build_array(jsonb_build_object(
      'issue_id', v_issue_id,
      'purchased_item_id', v_line.purchased_item_id,
      'base_quantity', v_line.base_quantity
    ));
  end loop;

  return jsonb_build_object('slip_id', v_slip_id, 'removed', v_removed, 'added', v_added);
end;
$function$;

create or replace function public.asset_disposals_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_status text;
  v_quantity integer;
  v_acquired date;
  v_disposed integer;
begin
  select status, quantity, acquired_date into v_status, v_quantity, v_acquired
  from public.assets where id = new.asset_id for update;
  if not found then
    raise exception 'Không tìm thấy tài sản';
  end if;
  if v_status = 'INACTIVE' then
    raise exception 'Tài sản đã ngừng dùng, không thanh lý được';
  end if;
  if new.disposed_date < v_acquired or new.disposed_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Ngày thanh lý phải từ ngày mua (%) đến hôm nay', to_char(v_acquired, 'DD/MM/YYYY HH24:MI:SS');
  end if;
  select coalesce(sum(quantity), 0) into v_disposed
  from public.asset_disposals where asset_id = new.asset_id;
  if v_disposed + new.quantity > v_quantity then
    raise exception 'Số lượng thanh lý (%) vượt quá số lượng còn lại (%)', new.quantity, v_quantity - v_disposed;
  end if;
  return new;
end;
$function$;
