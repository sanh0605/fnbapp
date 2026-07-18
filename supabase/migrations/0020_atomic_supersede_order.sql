-- Supersede one completed order and persist its replacement, lines, edit
-- event, and inventory effects in one transaction.

create or replace function public.supersede_order_v2_atomic(
  p_old_order_id text,
  p_expected_old_version integer,
  p_new_order jsonb,
  p_new_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_ledger jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
  v_old_version integer;
  v_new_order_id text;
  v_event_id text;
  v_line_count integer := 0;
  v_ledger_count integer := 0;
begin
  if nullif(btrim(p_old_order_id), '') is null then
    raise exception 'p_old_order_id is required';
  end if;
  if p_expected_old_version is null then
    raise exception 'p_expected_old_version is required';
  end if;
  if p_new_order is null or jsonb_typeof(p_new_order) <> 'object' then
    raise exception 'p_new_order must be a JSON object';
  end if;
  if p_new_lines is null or jsonb_typeof(p_new_lines) <> 'array' then
    raise exception 'p_new_lines must be a JSON array';
  end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'p_event must be a JSON object';
  end if;
  if p_ledger is null or jsonb_typeof(p_ledger) <> 'array' then
    raise exception 'p_ledger must be a JSON array';
  end if;

  select status, version
  into v_old_status, v_old_version
  from public.orders_v2
  where id = p_old_order_id
  for update;
  if not found then
    raise exception 'Order % not found', p_old_order_id;
  end if;
  if v_old_status <> 'COMPLETED' then
    raise exception 'Order status is %, must be COMPLETED to edit', v_old_status;
  end if;
  if v_old_version <> p_expected_old_version then
    raise exception 'Optimistic lock failed: expected version % but found %',
      p_expected_old_version, v_old_version;
  end if;

  v_new_order_id := nullif(btrim(p_new_order->>'id'), '');
  v_event_id := nullif(btrim(p_event->>'id'), '');
  if v_new_order_id is null or v_new_order_id = p_old_order_id then
    raise exception 'p_new_order.id must be a new non-empty ID';
  end if;
  if coalesce(p_new_order->>'status', '') <> 'COMPLETED' then
    raise exception 'p_new_order.status must be COMPLETED';
  end if;
  if nullif(p_new_order->>'version', '')::integer <> p_expected_old_version + 1 then
    raise exception 'p_new_order.version must increment the old version';
  end if;
  if nullif(btrim(p_new_order->>'parent_order_id'), '') is distinct from p_old_order_id then
    raise exception 'p_new_order.parent_order_id must match the old order';
  end if;
  if jsonb_array_length(p_new_lines) = 0 then
    raise exception 'p_new_lines must contain at least one line';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_new_lines) as line
    where nullif(btrim(line->>'id'), '') is null
       or line->>'order_id' is distinct from v_new_order_id
  ) then
    raise exception 'Every new line must reference the new order';
  end if;

  if v_event_id is null then
    raise exception 'p_event.id is required';
  end if;
  if p_event->>'order_id' is distinct from v_new_order_id then
    raise exception 'p_event.order_id must match the new order';
  end if;
  if coalesce(p_event->>'event_type', '') <> 'EDITED' then
    raise exception 'p_event.event_type must be EDITED';
  end if;
  if nullif(p_event->>'from_version', '')::integer <> p_expected_old_version
     or nullif(p_event->>'to_version', '')::integer <> p_expected_old_version + 1
     or p_event->>'previous_order_id' is distinct from p_old_order_id then
    raise exception 'p_event version chain does not match the edit';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_ledger) as entry
    where nullif(btrim(entry->>'id'), '') is null
       or entry->>'order_event_id' is distinct from v_event_id
       or (
         entry->>'transaction_type' = 'EDIT_REVERSAL'
         and (
           entry->>'reference_id' is distinct from p_old_order_id
           or coalesce(nullif(entry->>'quantity_change', '')::numeric, 0) <= 0
         )
       )
       or (
         entry->>'transaction_type' = 'SALES_CONSUME'
         and (
           entry->>'reference_id' is distinct from v_new_order_id
           or coalesce(nullif(entry->>'quantity_change', '')::numeric, 0) >= 0
         )
       )
       or coalesce(entry->>'transaction_type', '') not in ('EDIT_REVERSAL', 'SALES_CONSUME')
  ) then
    raise exception 'p_ledger contains an invalid edit movement';
  end if;

  update public.orders_v2
  set
    status = 'SUPERSEDED',
    superseded_by = v_new_order_id,
    updated_at = now()
  where id = p_old_order_id;

  insert into public.orders_v2 (
    id, order_no, brand_id, status, version, parent_order_id, superseded_by,
    created_at, created_by_id, created_by_name, completed_at, voided_at,
    voided_by_id, void_reason, currency, gross_total, promo_discount_total,
    manual_item_discount_total, manual_order_discount, net_total,
    applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json,
    payment_method, payment_ref, migration_notes
  ) values (
    v_new_order_id,
    p_new_order->>'order_no',
    p_new_order->>'brand_id',
    'COMPLETED',
    (p_new_order->>'version')::integer,
    p_old_order_id,
    coalesce(p_new_order->>'superseded_by', ''),
    (p_new_order->>'created_at')::timestamptz,
    nullif(p_new_order->>'created_by_id', ''),
    nullif(p_new_order->>'created_by_name', ''),
    nullif(p_new_order->>'completed_at', '')::timestamptz,
    nullif(p_new_order->>'voided_at', '')::timestamptz,
    coalesce(p_new_order->>'voided_by_id', ''),
    coalesce(p_new_order->>'void_reason', ''),
    coalesce(nullif(p_new_order->>'currency', ''), 'VND'),
    coalesce(nullif(p_new_order->>'gross_total', '')::bigint, 0),
    coalesce(nullif(p_new_order->>'promo_discount_total', '')::bigint, 0),
    coalesce(nullif(p_new_order->>'manual_item_discount_total', '')::bigint, 0),
    coalesce(nullif(p_new_order->>'manual_order_discount', '')::bigint, 0),
    coalesce(nullif(p_new_order->>'net_total', '')::bigint, 0),
    coalesce(p_new_order->>'applied_promotion_id', ''),
    coalesce(p_new_order->'applied_promotion_snapshot_json', '{}'::jsonb),
    coalesce(p_new_order->'pos_snapshot_json', '{}'::jsonb),
    nullif(p_new_order->>'payment_method', ''),
    coalesce(p_new_order->>'payment_ref', ''),
    coalesce(p_new_order->>'migration_notes', '')
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
    row.id,
    v_new_order_id,
    row.line_no,
    row.product_id,
    row.product_snapshot_json,
    row.variant_id,
    row.variant_snapshot_json,
    row.qty,
    row.unit_price,
    row.modifiers_snapshot_json,
    row.gross_line_total,
    row.promo_discount,
    row.manual_item_discount,
    row.order_discount_allocation,
    row.net_line_total,
    row.cost_at_sale,
    row.recipe_snapshot_json,
    row.promo_discount_reason,
    row.manual_discount_reason,
    coalesce(row.created_at, now())
  from jsonb_to_recordset(p_new_lines) as row(
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
  if v_line_count <> jsonb_array_length(p_new_lines) then
    raise exception 'Line count mismatch';
  end if;

  insert into public.order_events (
    id, order_id, event_type, event_at, actor_id, actor_name, from_version,
    to_version, previous_order_id, delta_json, reason
  ) values (
    v_event_id,
    v_new_order_id,
    'EDITED',
    coalesce(nullif(p_event->>'event_at', '')::timestamptz, now()),
    nullif(p_event->>'actor_id', ''),
    nullif(p_event->>'actor_name', ''),
    (p_event->>'from_version')::integer,
    (p_event->>'to_version')::integer,
    p_old_order_id,
    coalesce(p_event->'delta_json', '{}'::jsonb),
    coalesce(p_event->>'reason', '')
  );

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change,
    unit_cost, created_at, order_event_id, cost_at_sale, source, notes
  )
  select
    row.id,
    row.transaction_type,
    row.reference_id,
    row.item_reference,
    row.quantity_change,
    coalesce(row.unit_cost, 0),
    row.created_at,
    v_event_id,
    coalesce(row.cost_at_sale, 0),
    coalesce(row.source, ''),
    coalesce(row.notes, '')
  from jsonb_to_recordset(p_ledger) as row(
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
  if v_ledger_count <> jsonb_array_length(p_ledger) then
    raise exception 'Ledger count mismatch';
  end if;

  return jsonb_build_object(
    'new_order_id', v_new_order_id,
    'line_count', v_line_count,
    'ledger_count', v_ledger_count
  );
end;
$$;

revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb, jsonb
) from public;
revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb, jsonb
) from anon;
revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb, jsonb
) from authenticated;
grant execute on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb, jsonb
) to service_role;
