-- Atomic purchase-order save.
--
-- The function owns ID allocation and replaces the PO, lines, and receipt
-- ledger rows in one PostgreSQL transaction. Any exception rolls back every
-- statement in the function.

create or replace function public.save_purchase_order_atomic(
  p_order jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_ledger jsonb default '[]'::jsonb,
  p_replace_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po_id text;
  v_next_number integer;
  v_existing_id text;
  v_line_count integer;
  v_ledger_count integer;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;
  if p_ledger is null or jsonb_typeof(p_ledger) <> 'array' then
    raise exception 'p_ledger must be a JSON array';
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

    delete from public.stock_ledger
    where reference_id = v_po_id
      and transaction_type = 'PO_RECEIPT';
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

  if exists (
    select 1
    from jsonb_array_elements(p_ledger) as entry
    where coalesce(entry->>'transaction_type', '') <> 'PO_RECEIPT'
  ) then
    raise exception 'p_ledger may only contain PO_RECEIPT rows';
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

  insert into public.stock_ledger (
    id,
    item_reference,
    transaction_type,
    quantity_change,
    unit_cost,
    reference_id,
    source,
    notes,
    created_at,
    order_event_id,
    cost_at_sale
  )
  select
    row.id,
    row.item_reference,
    'PO_RECEIPT',
    row.quantity_change,
    row.unit_cost,
    v_po_id,
    coalesce(row.source, ''),
    coalesce(row.notes, ''),
    coalesce(row.created_at, now()),
    '',
    0
  from jsonb_to_recordset(p_ledger) as row(
    id text,
    item_reference text,
    transaction_type text,
    quantity_change numeric,
    unit_cost numeric,
    source text,
    notes text,
    created_at timestamptz
  );
  get diagnostics v_ledger_count = row_count;

  return jsonb_build_object(
    'purchase_order_id', v_po_id,
    'line_count', v_line_count,
    'ledger_count', v_ledger_count
  );
end;
$$;

revoke all on function public.save_purchase_order_atomic(
  jsonb,
  jsonb,
  jsonb,
  boolean
) from public;
revoke all on function public.save_purchase_order_atomic(
  jsonb,
  jsonb,
  jsonb,
  boolean
) from anon;
revoke all on function public.save_purchase_order_atomic(
  jsonb,
  jsonb,
  jsonb,
  boolean
) from authenticated;
grant execute on function public.save_purchase_order_atomic(
  jsonb,
  jsonb,
  jsonb,
  boolean
) to service_role;
