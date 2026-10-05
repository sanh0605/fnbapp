-- supabase/migrations/0108_purchase_order_cancel.sql
-- Cancel a purchase order (BR-INV-015): four cancel columns, a read-only check,
-- an atomic cancel, and a save function that refuses a cancelled order.
-- Spec: docs/superpowers/specs/2026-10-05-huy-phieu-nhap-design.md
-- Plan: docs/superpowers/plans/2026-10-05-huy-phieu-nhap.md (Task 2).
--
-- Triggers (read from migration text, not queried live; grep of every
-- create trigger / drop trigger):
--   purchase_orders: trg_purchase_orders_touch (0001, BEFORE UPDATE, row level,
--     touch_updated_at()). Moves updated_at on the cancelled order only.
--     Adding columns fires no row trigger.
--   assets: trg_assets_touch (0069, BEFORE UPDATE, row level,
--     touch_updated_at()). Moves updated_at on each retired asset only.
--   Nothing else is created or dropped on either table.
--
-- Writer inventory for the new check (every writer of purchase_orders.status):
--   save_purchase_order_atomic (live version 0107): redefined here; it now
--     refuses any status but DRAFT / COMPLETED and refuses a stored CANCELLED
--     row. It never touches the four new columns.
--   setPurchaseOrderPayment (app/admin/inventory/purchase-orders/actions.ts):
--     writes two payment columns of a COMPLETED row only; unaffected.
--   cancel_purchase_order_atomic (new): the only writer of CANCELLED and of
--     the four columns.
--   Backup restore (lib/db/backup-restore.ts) restores rows as they are; a
--     bundle taken before this file has no cancelled rows.
--
-- Deploy order: the code goes first, this file right after (separate owner
-- approvals). Before it runs the cancel page says the data is not updated and
-- nothing else reads the new columns; the TypeScript save refusal works alone.

alter table public.purchase_orders
  add column cancelled_at timestamptz,
  add column cancelled_by_id text,
  add column cancelled_by_name text,
  add column cancel_reason text;

alter table public.purchase_orders
  add constraint purchase_orders_cancelled_has_reason check (
    (status = 'CANCELLED') = (cancelled_at is not null and nullif(btrim(coalesce(cancel_reason, '')), '') is not null)
  );

-- save_purchase_order_atomic: 0107 body, with the two 0108 refusals marked.
-- Same signature, so create or replace leaves no overload behind.
create or replace function public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb DEFAULT '[]'::jsonb, p_replace_existing boolean DEFAULT false)
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
  v_line_count integer;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;

  -- 0108: a cancelled order is written only by cancel_purchase_order_atomic.
  if coalesce(nullif(p_order->>'status', ''), 'DRAFT') not in ('DRAFT', 'COMPLETED') then
    raise exception 'p_order.status must be DRAFT or COMPLETED';
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
    select id, status
    into v_existing_id, v_existing_status
    from public.purchase_orders
    where id = v_po_id
    for update;

    if v_existing_id is null then
      raise exception 'Purchase order % does not exist', v_po_id;
    end if;
    -- 0108: a save that waited on a cancel meets CANCELLED here.
    if v_existing_status = 'CANCELLED' then
      raise exception 'Phiếu đã huỷ, không sửa được';
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

  return jsonb_build_object(
    'purchase_order_id', v_po_id,
    'line_count', v_line_count
  );
end;
$function$;

revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) to service_role;

-- Read-only check, one source for the cancel page and the cancel itself.
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
      select l.purchased_item_id as item, sum(l.base_quantity) as qty, min(l.base_unit) as base_unit
      from public.purchase_order_lines l where l.purchase_order_id = p_id
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
    select low.item, pi.name, low.balance, low.at, q.qty, coalesce(u.name, q.base_unit, '') as unit
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
revoke all on function public.cancel_purchase_order_atomic(text, text, text, text) from public, anon, authenticated;
grant execute on function public.cancel_purchase_order_atomic(text, text, text, text) to service_role;
