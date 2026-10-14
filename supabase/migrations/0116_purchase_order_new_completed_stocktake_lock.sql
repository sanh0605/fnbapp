-- supabase/migrations/0116_purchase_order_new_completed_stocktake_lock.sql
-- BR-INV-018, "New orders too" (owner 2026-10-14, "Chặn luôn, giống Sửa/Huỷ"):
-- save_purchase_order_atomic refuses to save an order as COMPLETED when it was not
-- stored as COMPLETED (a new completed order, or a draft being completed) and its
-- date is on or before the last confirmed stocktake. Example: 30 Trứng gà delivered
-- 05/08, counted on the shelf 09/08 as found goods, then entered today as a new
-- order dated 05/08 would add the 30 eggs to the book twice. Saving a DRAFT stays
-- allowed: a draft moves no stock.
--
-- The date tested is the one the stock code uses for the order: transaction_date,
-- else the stored created_at (a draft being completed), else the created_at the
-- caller sends, else now. It goes to issue_slip_stocktake_lock (0106) as it is,
-- like the edit refusal of 0112, whose message shape the refusal copies.
--
-- Based on 0112 (the latest save_purchase_order_atomic), copied verbatim; the only
-- addition is the block marked "0116". The signature is unchanged, so no drop.
--
-- Triggers, read from migration text (supabase/CLAUDE.md: no session here can
-- query pg_catalog; grep of every `create trigger` / `drop trigger`):
--   purchase_orders: trg_purchase_orders_touch (0001, BEFORE UPDATE, row level,
--     touch_updated_at()). Moves updated_at on the saved order only.
--   assets: trg_assets_touch (0069, BEFORE UPDATE); unchanged from 0112.
--   purchase_order_lines, stock_issues: none, ever.
--
-- Deploy order: no TypeScript change is needed; the refusal is a raised Vietnamese
-- message relayed verbatim by describeActionError, as 0112's. It can go up before
-- or after any code, with the owner's own approval. Not applied by the author.

create or replace function public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb default '[]'::jsonb, p_replace_existing boolean default false, p_assets jsonb default null)
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
          to_char(v_new_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), v_lock,
          to_char((select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock) at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY');
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
    v_po_id := 'PO-' || lpad(v_next_number::text, 3, '0');
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
            to_char((select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock) at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY');
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
    base_unit,
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
    nullif(row.base_unit, ''),
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
    base_unit text,
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

revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.save_purchase_order_atomic(jsonb, jsonb, boolean, jsonb) to service_role;
