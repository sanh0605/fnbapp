-- Stock ledger retirement, Phase C, function 1 of 8: save_purchase_order_atomic.
-- docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md section 5.
--
-- Sales stopped writing to stock_ledger at the 2026-08-07 cutover
-- (docs/BUSINESS-RULES.md). Purchase receipts are the last routine writer
-- still adding real rows to it (last real write 2026-08-29, PO-155 --
-- section 2d). This migration removes that write. The receipt row itself,
-- its lines, and base_quantity are untouched -- only the insert into
-- stock_ledger (and its matching delete in the replace-existing branch)
-- comes out. Body is otherwise copied forward unchanged from the live
-- function (verified against pg_get_functiondef, not the original 0006
-- migration file, which can drift -- see section 2d on
-- supersede_order_v2_atomic for why that check matters).
--
-- p_ledger removed from the parameter list, so this drops and recreates
-- rather than create-or-replace, to avoid an old-signature overload
-- lingering alongside the new one.
--
-- Deploy order (section 5.7): application code must stop sending p_ledger
-- BEFORE this migration is applied. The old signature's p_ledger has a
-- default, so new code that omits it still resolves against the old
-- function; applying this migration first, while old code still sends
-- p_ledger, would break every purchase order save.

drop function if exists public.save_purchase_order_atomic(jsonb, jsonb, jsonb, boolean);

CREATE FUNCTION public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb DEFAULT '[]'::jsonb, p_replace_existing boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_po_id text;
  v_next_number integer;
  v_existing_id text;
  v_line_count integer;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;

  v_po_id := nullif(btrim(p_order->>'id'), '');

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
    select id
    into v_existing_id
    from public.purchase_orders
    where id = v_po_id
    for update;

    if v_existing_id is null then
      raise exception 'Purchase order % does not exist', v_po_id;
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

  return jsonb_build_object(
    'purchase_order_id', v_po_id,
    'line_count', v_line_count
  );
end;
$function$;

revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) from public;
revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) from anon;
revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) from authenticated;
grant execute on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) to service_role;
