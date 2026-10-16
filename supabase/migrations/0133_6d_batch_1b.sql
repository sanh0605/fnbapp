-- supabase/migrations/0133_6d_batch_1b.sql
-- 6d database audit, batch 1b (plan docs/superpowers/plans/2026-10-16-6d-csdl.md, section "1b chi tiết").
-- NOT YET RUN on the server. Run it AFTER the code push (the code stops reading and writing these
-- columns first), outside selling hours, and only with the owner's separate approval.
--
-- What it does:
--   1. Redefines four functions with unchanged signatures and without the dropped columns:
--      save_product_atomic, create_standalone_topping_product_atomic (no products.image_url),
--      save_purchase_order_atomic (no purchase_order_lines.base_unit), purchase_order_cancel_check
--      (unit name comes from uom_conversions.base_unit through the line's conversion_id; the JSON key
--      base_unit is kept; no conversion gives ''). Bodies are the last live definitions (0132 for the
--      first three, 0108 for the cancel check) with only the dropped-column parts removed.
--   2. Drops 7 columns (counts measured on the server 2026-10-16): purchased_items.default_unit_id
--      (0 of 151), suppliers.parent_id (0 of 48), units.abbreviation (0 of 23),
--      product_price_history.reason (0 of 61), asset_depreciation_bands.status (3 of 3 ACTIVE),
--      purchase_order_lines.base_unit (81 of 362 filled, 81 of 81 equal to the conversion's base unit),
--      products.image_url (0 of 45).
--   Not done on purpose: no foreign key and no NOT NULL on assets.purchase_order_line_id (the plan
--   explains why: the order save deletes and rewrites lines, and old backups hold dangling links).
--
-- lock_timeout: dropping a column takes ACCESS EXCLUSIVE on the table; products and
-- purchase_order_lines are read by the till, so give up after 3 s instead of queueing behind it.
--
-- Triggers on the touched tables (from the migration text and the server pg_trigger as reported in
-- the 0132 header): only touch_updated_at, BEFORE UPDATE, on products, purchased_items, assets and
-- asset_depreciation_bands. This file updates no row, so no trigger fires. None on suppliers, units,
-- product_price_history or purchase_order_lines.

set lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.create_standalone_topping_product_atomic(p_modifier_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allow_standalone boolean;
  v_name text;
  v_price bigint;
  v_status text;
  v_existing_product_id text;
  v_next_product integer;
  v_next_variant integer;
  v_next_history integer;
  v_product_id text;
  v_variant_id text;
  v_pph_id text;
begin
  if p_modifier_id is null or btrim(p_modifier_id) = '' then
    raise exception 'p_modifier_id is required';
  end if;

  select m.name, m.price, m.status, m.product_id, coalesce(g.allow_standalone, false)
  into v_name, v_price, v_status, v_existing_product_id, v_allow_standalone
  from public.modifiers m
  left join public.modifier_groups g on g.id = m.group_id
  where m.id = p_modifier_id
  for update of m;
  if not found then
    raise exception 'Modifier % not found', p_modifier_id;
  end if;

  if v_status <> 'ACTIVE' then
    raise exception 'Modifier % is not ACTIVE -- cannot be sold standalone', p_modifier_id;
  end if;

  if v_existing_product_id is not null then
    raise exception 'Modifier % already has a linked product -- refusing to create a second one', p_modifier_id;
  end if;

  if not v_allow_standalone then
    raise exception 'Modifier % is in a group that does not sell options on their own', p_modifier_id;
  end if;

  if v_price is null or v_price <= 0 then
    raise exception 'Modifier % has price % -- refusing to create a 0đ món', p_modifier_id, coalesce(v_price::text, 'null');
  end if;

  perform pg_advisory_xact_lock(hashtext('products:id'));
  perform pg_advisory_xact_lock(hashtext('product_variants:id'));
  perform pg_advisory_xact_lock(hashtext('product_price_history:id'));

  select coalesce(max(substring(id from '^PROD-([0-9]+)$')::integer), 0) + 1
  into v_next_product
  from public.products
  where id ~ '^PROD-[0-9]+$';
  v_product_id := 'PROD-' || repeat('0', greatest(3 - length(v_next_product::text), 0)) || v_next_product::text;

  select coalesce(max(substring(id from '^VAR-([0-9]+)$')::integer), 0) + 1
  into v_next_variant
  from public.product_variants
  where id ~ '^VAR-[0-9]+$';
  v_variant_id := 'VAR-' || repeat('0', greatest(3 - length(v_next_variant::text), 0)) || v_next_variant::text;

  select coalesce(max(substring(id from '^PPH-([0-9]+)$')::integer), 0) + 1
  into v_next_history
  from public.product_price_history
  where id ~ '^PPH-[0-9]+$';
  v_pph_id := 'PPH-' || repeat('0', greatest(3 - length(v_next_history::text), 0)) || v_next_history::text;

  begin
    insert into public.products (
      id, category_id, name, status, created_at, updated_at
    ) values (
      v_product_id, 'CAT-007', v_name, 'ACTIVE', now(), now()
    );
  exception
    when unique_violation then
      raise exception
        'Product name "%" already exists among ACTIVE products -- refusing to create a duplicate',
        v_name;
  end;

  insert into public.product_variants (
    id, product_id, size_name, price, status, created_at, updated_at
  ) values (
    v_variant_id, v_product_id, '1 phần', v_price, 'ACTIVE', now(), now()
  );

  insert into public.product_price_history (
    id, variant_id, old_price, new_price, effective_at, created_at
  ) values (
    v_pph_id, v_variant_id, null, v_price, now(), now()
  );

  update public.modifiers
  set product_id = v_product_id
  where id = p_modifier_id;

  return jsonb_build_object(
    'product_id', v_product_id,
    'variant_id', v_variant_id
  );
end;
$function$;

revoke all on function public.create_standalone_topping_product_atomic(text) from public, anon, authenticated;
grant execute on function public.create_standalone_topping_product_atomic(text) to service_role;

CREATE OR REPLACE FUNCTION public.save_product_atomic(p_is_edit boolean, p_product jsonb, p_variants jsonb DEFAULT '[]'::jsonb, p_removed_variant_ids jsonb DEFAULT '[]'::jsonb, p_effective_at timestamp with time zone DEFAULT now(), p_option_group_ids text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_product_id text;
  v_variant jsonb;
  v_variant_id text;
  v_variant_product_id text;
  v_variant_status text;
  v_old_price bigint;
  v_new_price bigint;
  v_removed_variant_id text;
  v_next_product integer;
  v_next_variant integer;
  v_next_history integer;
  v_variant_count integer := 0;
  v_price_history_count integer := 0;
  v_removed_variant_count integer := 0;
  v_affected integer := 0;
begin
  if p_is_edit is null then
    raise exception 'p_is_edit is required';
  end if;
  if p_product is null or jsonb_typeof(p_product) <> 'object' then
    raise exception 'p_product must be a JSON object';
  end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array'
     or jsonb_array_length(p_variants) = 0 then
    raise exception 'p_variants must be a non-empty JSON array';
  end if;
  if p_removed_variant_ids is null
     or jsonb_typeof(p_removed_variant_ids) <> 'array' then
    raise exception 'p_removed_variant_ids must be a JSON array';
  end if;
  if nullif(btrim(p_product->>'name'), '') is null
     or nullif(btrim(p_product->>'category_id'), '') is null then
    raise exception 'Product name and category_id are required';
  end if;

  perform pg_advisory_xact_lock(hashtext('products:id'));
  perform pg_advisory_xact_lock(hashtext('product_variants:id'));
  perform pg_advisory_xact_lock(hashtext('product_price_history:id'));

  select coalesce(max(substring(id from '^PROD-([0-9]+)$')::integer), 0) + 1
  into v_next_product
  from public.products
  where id ~ '^PROD-[0-9]+$';
  select coalesce(max(substring(id from '^VAR-([0-9]+)$')::integer), 0) + 1
  into v_next_variant
  from public.product_variants
  where id ~ '^VAR-[0-9]+$';
  select coalesce(max(substring(id from '^PPH-([0-9]+)$')::integer), 0) + 1
  into v_next_history
  from public.product_price_history
  where id ~ '^PPH-[0-9]+$';

  if p_is_edit then
    v_product_id := nullif(btrim(p_product->>'id'), '');
    if v_product_id is null then
      raise exception 'p_product.id is required for edit';
    end if;
    perform 1
    from public.products
    where id = v_product_id
    for update;
    if not found then
      raise exception 'Product % not found', v_product_id;
    end if;
    update public.products
    set
      category_id = p_product->>'category_id',
      name = p_product->>'name',
      updated_at = now()
    where id = v_product_id;
  else
    v_product_id := 'PROD-' || repeat('0', greatest(3 - length(v_next_product::text), 0)) || v_next_product::text;
    insert into public.products (
      id, category_id, name, status, created_at, updated_at
    ) values (
      v_product_id,
      p_product->>'category_id',
      p_product->>'name',
      'ACTIVE',
      coalesce(nullif(p_product->>'created_at', '')::timestamptz, now()),
      now()
    );
  end if;

  for v_variant in
    select value from jsonb_array_elements(p_variants)
  loop
    if nullif(btrim(v_variant->>'size_name'), '') is null then
      raise exception 'Variant size_name is required';
    end if;
    v_new_price := nullif(v_variant->>'price', '')::bigint;
    if v_new_price is null or v_new_price < 0 then
      raise exception 'Variant price must be non-negative';
    end if;

    v_variant_id := nullif(btrim(v_variant->>'id'), '');
    if v_variant_id is null then
      v_variant_id := 'VAR-' || repeat('0', greatest(3 - length(v_next_variant::text), 0)) || v_next_variant::text;
      v_next_variant := v_next_variant + 1;
      insert into public.product_variants (
        id, product_id, size_name, price, status, created_at, updated_at
      ) values (
        v_variant_id,
        v_product_id,
        v_variant->>'size_name',
        v_new_price,
        'ACTIVE',
        coalesce(p_effective_at, now()),
        now()
      );
      v_old_price := null;
    else
      select product_id, status, price
      into v_variant_product_id, v_variant_status, v_old_price
      from public.product_variants
      where id = v_variant_id
      for update;
      if not found then
        raise exception 'Variant % not found', v_variant_id;
      end if;
      if v_variant_product_id <> v_product_id or v_variant_status = 'DELETED' then
        raise exception 'Variant % does not belong to active product %',
          v_variant_id, v_product_id;
      end if;
      update public.product_variants
      set
        size_name = v_variant->>'size_name',
        price = v_new_price,
        updated_at = now()
      where id = v_variant_id;
    end if;
    v_variant_count := v_variant_count + 1;

    if v_old_price is null or v_old_price <> v_new_price then
      insert into public.product_price_history (
        id, variant_id, old_price, new_price, effective_at, created_at
      ) values (
        'PPH-' || repeat('0', greatest(3 - length(v_next_history::text), 0)) || v_next_history::text,
        v_variant_id,
        v_old_price,
        v_new_price,
        coalesce(p_effective_at, now()),
        coalesce(p_effective_at, now())
      );
      v_next_history := v_next_history + 1;
      v_price_history_count := v_price_history_count + 1;
    end if;
  end loop;

  for v_removed_variant_id in
    select value from jsonb_array_elements_text(p_removed_variant_ids)
  loop
    update public.product_variants
    set status = 'DELETED', updated_at = now()
    where id = v_removed_variant_id
      and product_id = v_product_id
      and status <> 'DELETED';
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then
      raise exception 'Removed variant % is missing or already deleted',
        v_removed_variant_id;
    end if;
    v_removed_variant_count := v_removed_variant_count + 1;
  end loop;

  if v_variant_count <> jsonb_array_length(p_variants) then
    raise exception 'Variant count mismatch';
  end if;
  if v_removed_variant_count <> jsonb_array_length(p_removed_variant_ids) then
    raise exception 'Removed variant count mismatch';
  end if;

  if p_option_group_ids is not null then
    delete from public.modifier_group_products
    where product_id = v_product_id and group_id <> all (p_option_group_ids);
    insert into public.modifier_group_products (id, group_id, product_id)
    select g || ':' || v_product_id, g, v_product_id from unnest(p_option_group_ids) as g
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'product_id', v_product_id,
    'variant_count', v_variant_count,
    'price_history_count', v_price_history_count,
    'removed_variant_count', v_removed_variant_count
  );
end;
$function$;

revoke all on function public.save_product_atomic(boolean, jsonb, jsonb, jsonb, timestamptz, text[]) from public, anon, authenticated;
grant execute on function public.save_product_atomic(boolean, jsonb, jsonb, jsonb, timestamptz, text[]) to service_role;

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

revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.save_purchase_order_atomic(jsonb, jsonb, boolean, jsonb) to service_role;

create or replace function public.purchase_order_cancel_check(p_id text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_po record;
  v_at timestamptz;
  v_lock text;
  v_blocked jsonb := '[]'::jsonb;
  v_assets jsonb := '[]'::jsonb;
  r record;
begin
  select id, status, transaction_date, created_at into v_po
  from public.purchase_orders where id = p_id;
  if not found then
    return jsonb_build_object('blocked', jsonb_build_array(jsonb_build_object('code', 'NOT_FOUND')), 'assets', '[]'::jsonb);
  end if;
  if v_po.status = 'CANCELLED' then
    return jsonb_build_object('blocked', jsonb_build_array(jsonb_build_object('code', 'ALREADY_CANCELLED')), 'assets', '[]'::jsonb);
  end if;
  if v_po.status <> 'COMPLETED' then
    -- A draft touched no stock, cost, money or asset.
    return jsonb_build_object('blocked', '[]'::jsonb, 'assets', '[]'::jsonb);
  end if;

  v_at := coalesce(v_po.transaction_date, v_po.created_at);

  v_lock := public.issue_slip_stocktake_lock(v_at);
  if v_lock is not null then
    v_blocked := v_blocked || jsonb_build_object(
      'code', 'STOCKTAKE', 'stocktake_id', v_lock,
      'confirmed_at', (select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock),
      'order_at', v_at);
  end if;

  -- Lowest balance of each item from the order's moment to now (formula of
  -- issue_stock_headroom, 0106), compared with what the order brought in.
  for r in
    with q as (
      select l.purchased_item_id as item, sum(l.base_quantity) as qty, min(uc.base_unit) as base_unit
      from public.purchase_order_lines l
      left join public.uom_conversions uc on uc.id = l.conversion_id
      where l.purchase_order_id = p_id
      group by l.purchased_item_id
    ), pts as (
      select q.item, v_at as at from q
      union
      select si.purchased_item_id, si.issued_at
      from public.stock_issues si join q on q.item = si.purchased_item_id
      where si.issued_at > v_at and si.base_quantity > 0
    ), bal as (
      select pts.item, pts.at,
        coalesce((select sum(pol.base_quantity) from public.purchase_order_lines pol
                  join public.purchase_orders po on po.id = pol.purchase_order_id
                  where po.status = 'COMPLETED' and pol.purchased_item_id = pts.item
                    and coalesce(po.transaction_date, po.created_at) <= pts.at), 0)
        - coalesce((select sum(si.base_quantity) from public.stock_issues si
                    where si.purchased_item_id = pts.item and si.issued_at <= pts.at), 0) as balance
      from pts
    ), low as (
      select distinct on (item) item, at, balance from bal order by item, balance asc, at asc
    )
    select low.item, pi.name, low.balance, low.at, q.qty, coalesce(u.name, '') as unit
    from low
    join q on q.item = low.item
    join public.purchased_items pi on pi.id = low.item
    left join public.units u on u.id = q.base_unit
    where low.balance - q.qty < 0
    order by pi.name
  loop
    v_blocked := v_blocked || jsonb_build_object(
      'code', 'NEGATIVE', 'item_id', r.item, 'item_name', r.name,
      'low_balance', r.balance, 'low_at', r.at, 'order_qty', r.qty, 'base_unit', r.unit);
  end loop;

  for r in
    select a.id, a.name_snapshot, a.quantity, a.total_cost, a.status,
      exists (select 1 from public.asset_disposals d where d.asset_id = a.id) as disposed
    from public.assets a
    join public.purchase_order_lines l on l.id = a.purchase_order_line_id
    where l.purchase_order_id = p_id
    order by a.id
  loop
    if r.disposed then
      v_blocked := v_blocked || jsonb_build_object('code', 'DISPOSED', 'asset_id', r.id, 'name', r.name_snapshot);
    end if;
    if r.status <> 'INACTIVE' then
      v_assets := v_assets || jsonb_build_object('id', r.id, 'name', r.name_snapshot, 'quantity', r.quantity, 'total_cost', r.total_cost);
    end if;
  end loop;

  return jsonb_build_object('blocked', v_blocked, 'assets', v_assets);
end
$function$;

-- Atomic cancel: one transaction, nothing is ever removed.
create or replace function public.cancel_purchase_order_atomic(p_id text, p_reason text, p_actor_id text, p_actor_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_check jsonb;
  v_asset_ids text[];
begin
  if nullif(btrim(coalesce(p_actor_id, '')), '') is null then raise exception 'p_actor_id is required'; end if;
  if nullif(btrim(coalesce(p_actor_name, '')), '') is null then raise exception 'p_actor_name is required'; end if;
  if v_reason = '' then raise exception 'Lý do huỷ phiếu là bắt buộc'; end if;
  if char_length(v_reason) > 500 then raise exception 'Lý do huỷ tối đa 500 ký tự'; end if;

  -- Same lock as every stock writer (issue slips, stocktake): a slip saved at
  -- the same instant waits, so the below-zero check reads settled stock.
  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform 1 from public.purchase_orders
  where id = p_id
  for update;

  v_check := public.purchase_order_cancel_check(p_id);
  if jsonb_array_length(v_check->'blocked') > 0 then
    return jsonb_build_object('cancelled', false, 'blocked', v_check->'blocked');
  end if;

  select coalesce(array_agg(a->>'id'), '{}') into v_asset_ids
  from jsonb_array_elements(v_check->'assets') a;

  update public.purchase_orders
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by_id = p_actor_id,
      cancelled_by_name = p_actor_name, cancel_reason = v_reason
  where id = p_id;

  update public.assets
  set status = 'INACTIVE'
  where id = any(v_asset_ids);

  return jsonb_build_object('cancelled', true, 'retired_asset_ids', to_jsonb(v_asset_ids));
end
$function$;


revoke all on function public.purchase_order_cancel_check(text) from public, anon, authenticated;
grant execute on function public.purchase_order_cancel_check(text) to service_role;

alter table public.purchased_items drop column default_unit_id;
alter table public.suppliers drop column parent_id;
alter table public.units drop column abbreviation;
alter table public.product_price_history drop column reason;
alter table public.asset_depreciation_bands drop column status;
alter table public.purchase_order_lines drop column base_unit;
alter table public.products drop column image_url;
