-- Reduce POS checkout database traffic while preserving the existing MAC
-- calculation and all-or-nothing order persistence.

create or replace function public.get_pos_inventory_state(
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_item text;
  v_qty numeric;
  v_unit_cost numeric;
  v_mac_qty numeric;
  v_mac_value numeric;
  v_latest_mac numeric;
  v_consume_qty numeric;
  v_balances jsonb := '{}'::jsonb;
  v_mac_quantities jsonb := '{}'::jsonb;
  v_mac_values jsonb := '{}'::jsonb;
  v_mac_unit_costs jsonb := '{}'::jsonb;
begin
  if p_as_of is null then
    raise exception 'p_as_of is required';
  end if;

  for v_row in
    select
      item_reference,
      transaction_type,
      quantity_change,
      unit_cost
    from public.stock_ledger
    where created_at <= p_as_of
    order by created_at, id
  loop
    v_item := v_row.item_reference;
    v_qty := coalesce(v_row.quantity_change, 0);
    v_unit_cost := coalesce(v_row.unit_cost, 0);

    v_balances := jsonb_set(
      v_balances,
      array[v_item],
      to_jsonb(coalesce((v_balances->>v_item)::numeric, 0) + v_qty),
      true
    );

    v_mac_qty := coalesce((v_mac_quantities->>v_item)::numeric, 0);
    v_mac_value := coalesce((v_mac_values->>v_item)::numeric, 0);
    v_latest_mac := coalesce((v_mac_unit_costs->>v_item)::numeric, 0);

    if v_row.transaction_type in (
      'PO_RECEIPT',
      'STOCK_ADJUST',
      'PRODUCTION_YIELD'
    ) and v_qty > 0 and v_unit_cost > 0 then
      v_mac_qty := v_mac_qty + v_qty;
      v_mac_value := v_mac_value + (v_qty * v_unit_cost);
      v_latest_mac := v_mac_value / v_mac_qty;

      v_mac_quantities := jsonb_set(
        v_mac_quantities,
        array[v_item],
        to_jsonb(v_mac_qty),
        true
      );
      v_mac_values := jsonb_set(
        v_mac_values,
        array[v_item],
        to_jsonb(v_mac_value),
        true
      );
      v_mac_unit_costs := jsonb_set(
        v_mac_unit_costs,
        array[v_item],
        to_jsonb(v_latest_mac),
        true
      );
    elsif v_qty < 0 and v_mac_qty > 0 then
      v_consume_qty := least(v_mac_qty, abs(v_qty));
      v_mac_qty := v_mac_qty - v_consume_qty;
      v_mac_value := v_mac_value - (v_consume_qty * v_latest_mac);
      if v_mac_qty = 0 then
        v_mac_value := 0;
      end if;

      v_mac_quantities := jsonb_set(
        v_mac_quantities,
        array[v_item],
        to_jsonb(v_mac_qty),
        true
      );
      v_mac_values := jsonb_set(
        v_mac_values,
        array[v_item],
        to_jsonb(v_mac_value),
        true
      );
    end if;
  end loop;

  return jsonb_build_object(
    'balances', v_balances,
    'mac_unit_costs', v_mac_unit_costs
  );
end;
$$;

create or replace function public.create_pos_order_atomic(
  p_brand_code text,
  p_order jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_ledger jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_code text;
  v_order_id text;
  v_order_no text;
  v_next_number integer;
  v_line_count integer := 0;
  v_ledger_count integer := 0;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'p_event must be a JSON object';
  end if;
  if p_ledger is null or jsonb_typeof(p_ledger) <> 'array' then
    raise exception 'p_ledger must be a JSON array';
  end if;

  v_brand_code := upper(btrim(coalesce(p_brand_code, '')));
  v_order_id := nullif(btrim(p_order->>'id'), '');
  if v_brand_code = '' or v_brand_code !~ '^[A-Z0-9]+$' then
    raise exception 'p_brand_code must contain only letters and numbers';
  end if;
  if v_order_id is null then
    raise exception 'p_order.id is required';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'p_lines must contain at least one row';
  end if;
  if nullif(btrim(p_event->>'id'), '') is null then
    raise exception 'p_event.id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('pos:order_no:' || v_brand_code));

  select coalesce(max(
    case
      when substring(order_no from length(v_brand_code) + 1) ~ '^[0-9]+$'
      then substring(order_no from length(v_brand_code) + 1)::integer
      else null
    end
  ), 0) + 1
  into v_next_number
  from public.orders_v2
  where left(order_no, length(v_brand_code)) = v_brand_code;

  v_order_no := v_brand_code || lpad(v_next_number::text, 6, '0');

  insert into public.orders_v2 (
    id, order_no, brand_id, status, version, parent_order_id, superseded_by,
    created_at, created_by_id, created_by_name, completed_at, voided_at,
    voided_by_id, void_reason, currency, gross_total, promo_discount_total,
    manual_item_discount_total, manual_order_discount, net_total,
    applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json,
    payment_method, payment_ref, migration_notes
  )
  values (
    v_order_id,
    v_order_no,
    p_order->>'brand_id',
    p_order->>'status',
    coalesce((p_order->>'version')::integer, 1),
    coalesce(p_order->>'parent_order_id', ''),
    coalesce(p_order->>'superseded_by', ''),
    (p_order->>'created_at')::timestamptz,
    nullif(p_order->>'created_by_id', ''),
    nullif(p_order->>'created_by_name', ''),
    nullif(p_order->>'completed_at', '')::timestamptz,
    nullif(p_order->>'voided_at', '')::timestamptz,
    coalesce(p_order->>'voided_by_id', ''),
    coalesce(p_order->>'void_reason', ''),
    coalesce(nullif(p_order->>'currency', ''), 'VND'),
    coalesce((p_order->>'gross_total')::bigint, 0),
    coalesce((p_order->>'promo_discount_total')::bigint, 0),
    coalesce((p_order->>'manual_item_discount_total')::bigint, 0),
    coalesce((p_order->>'manual_order_discount')::bigint, 0),
    coalesce((p_order->>'net_total')::bigint, 0),
    coalesce(p_order->>'applied_promotion_id', ''),
    coalesce(p_order->'applied_promotion_snapshot_json', '{}'::jsonb),
    coalesce(p_order->'pos_snapshot_json', '{}'::jsonb),
    nullif(p_order->>'payment_method', ''),
    coalesce(p_order->>'payment_ref', ''),
    coalesce(p_order->>'migration_notes', '')
  );

  insert into public.order_lines_v2 (
    id, order_id, line_no, product_id, product_snapshot_json, variant_id,
    variant_snapshot_json, qty, unit_price, modifiers_snapshot_json,
    gross_line_total, promo_discount, manual_item_discount,
    order_discount_allocation, net_line_total, cost_at_sale,
    recipe_snapshot_json, promo_discount_reason, manual_discount_reason,
    created_at
  )
  select
    x.id, v_order_id, x.line_no, x.product_id, x.product_snapshot_json,
    x.variant_id, x.variant_snapshot_json, x.qty, x.unit_price,
    x.modifiers_snapshot_json, x.gross_line_total, x.promo_discount,
    x.manual_item_discount, x.order_discount_allocation, x.net_line_total,
    x.cost_at_sale, x.recipe_snapshot_json, x.promo_discount_reason,
    x.manual_discount_reason, coalesce(x.created_at, now())
  from jsonb_to_recordset(p_lines) as x(
    id text,
    order_id text,
    line_no integer,
    product_id text,
    product_snapshot_json jsonb,
    variant_id text,
    variant_snapshot_json jsonb,
    qty integer,
    unit_price bigint,
    modifiers_snapshot_json jsonb,
    gross_line_total bigint,
    promo_discount bigint,
    manual_item_discount bigint,
    order_discount_allocation bigint,
    net_line_total bigint,
    cost_at_sale bigint,
    recipe_snapshot_json jsonb,
    promo_discount_reason text,
    manual_discount_reason text,
    created_at timestamptz
  );
  get diagnostics v_line_count = row_count;

  insert into public.order_events (
    id, order_id, event_type, event_at, actor_id, actor_name, from_version,
    to_version, previous_order_id, delta_json, reason
  )
  values (
    p_event->>'id',
    v_order_id,
    p_event->>'event_type',
    coalesce((p_event->>'event_at')::timestamptz, now()),
    nullif(p_event->>'actor_id', ''),
    nullif(p_event->>'actor_name', ''),
    nullif(p_event->>'from_version', '')::integer,
    (p_event->>'to_version')::integer,
    coalesce(p_event->>'previous_order_id', ''),
    coalesce(p_event->'delta_json', '{}'::jsonb),
    coalesce(p_event->>'reason', '')
  );

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change,
    unit_cost, created_at, order_event_id, cost_at_sale, source, notes
  )
  select
    x.id, x.transaction_type, v_order_id, x.item_reference,
    x.quantity_change, x.unit_cost, x.created_at, x.order_event_id,
    x.cost_at_sale, x.source, x.notes
  from jsonb_to_recordset(p_ledger) as x(
    id text,
    transaction_type text,
    reference_id text,
    item_reference text,
    quantity_change numeric,
    unit_cost numeric,
    created_at timestamptz,
    order_event_id text,
    cost_at_sale numeric,
    source text,
    notes text
  );
  get diagnostics v_ledger_count = row_count;

  if v_line_count <> jsonb_array_length(p_lines) then
    raise exception 'Order line count mismatch';
  end if;
  if v_ledger_count <> jsonb_array_length(p_ledger) then
    raise exception 'Stock ledger count mismatch';
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'line_count', v_line_count,
    'ledger_count', v_ledger_count
  );
end;
$$;

revoke all on function public.get_pos_inventory_state(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_pos_inventory_state(timestamptz)
  to service_role;

revoke all on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb
) to service_role;
