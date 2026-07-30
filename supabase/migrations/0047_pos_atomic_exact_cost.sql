-- Owner-approved deploy plan 2026-07-31 (docs/superpowers/plans/2026-07-31-
-- deploy-exact-cost.md): the two POS checkout RPCs still declare
-- cost_at_sale as bigint in their p_lines recordset, even though
-- order_lines_v2.cost_at_sale is numeric(18,6) since migration 0046 and the
-- TypeScript cost engine has carried full precision since Task 3 of the
-- same plan. Left unpatched, jsonb_to_recordset would silently truncate
-- every new sale's decimal cost back to a whole number on write -- the
-- checkout path (app/pos/actions.ts:110) calls this on every single sale,
-- so this is a live, ongoing gap, not a historical one.
--
-- Migration goes BEFORE the web push, deliberately: create_pos_order_atomic
-- accepts numeric, which also accepts whole-number input, so the still-old
-- deployed app keeps working unchanged against the widened RPC. Pushing the
-- app first would send a decimal into a bigint parameter and either error
-- or truncate at checkout -- the exact failure this ordering avoids.
--
-- Only the p_lines.cost_at_sale column type changes, in
-- create_pos_order_atomic_unvalidated_0024 (the real logic, current
-- definition as of migration 0040). create_pos_order_atomic (the thin
-- payment-validating wrapper, current definition as of migration 0035) is
-- reproduced here unchanged -- it forwards p_lines as opaque jsonb and
-- never itself references cost_at_sale, but is redefined anyway so both
-- checkout RPCs are captured together in one migration, matching the
-- deploy plan's own file list.

create or replace function public.create_pos_order_atomic_unvalidated_0024(
  p_brand_code text,
  p_order jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_ledger jsonb default '[]'::jsonb,
  p_client_request_id text default null,
  p_payments jsonb default '[]'::jsonb
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
  v_payment_count integer := 0;
  v_client_request_id text;
  v_existing_order_id text;
  v_existing_order_no text;
  v_net_total bigint;
  v_payment_sum bigint;
  v_effective_payments jsonb;
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
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;

  v_brand_code := upper(btrim(coalesce(p_brand_code, '')));
  v_order_id := nullif(btrim(p_order->>'id'), '');
  v_client_request_id := nullif(btrim(coalesce(p_client_request_id, '')), '');
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
  if v_client_request_id is not null and length(v_client_request_id) > 128 then
    raise exception 'p_client_request_id exceeds 128 characters';
  end if;

  v_net_total := coalesce((p_order->>'net_total')::bigint, 0);

  if jsonb_array_length(p_payments) = 0 then
    v_effective_payments := jsonb_build_array(
      jsonb_build_object(
        'id', 'pay-' || v_order_id,
        'method', coalesce(nullif(p_order->>'payment_method', ''), 'CASH'),
        'amount', v_net_total,
        'reference', coalesce(p_order->>'payment_ref', '')
      )
    );
  else
    v_effective_payments := p_payments;
  end if;

  select coalesce(sum((x.amount)::bigint), 0)
  into v_payment_sum
  from jsonb_to_recordset(v_effective_payments) as x(amount numeric);

  if v_payment_sum <> v_net_total then
    raise exception
      'Payment total % does not match order net_total %',
      v_payment_sum, v_net_total;
  end if;

  if v_client_request_id is not null then
    perform pg_advisory_xact_lock(
      hashtext('pos:client_request:' || v_client_request_id)
    );

    select id, order_no
    into v_existing_order_id, v_existing_order_no
    from public.orders_v2
    where client_request_id = v_client_request_id;

    if v_existing_order_id is not null then
      select count(*)::integer
      into v_line_count
      from public.order_lines_v2
      where order_id = v_existing_order_id;

      select count(*)::integer
      into v_ledger_count
      from public.stock_ledger
      where reference_id = v_existing_order_id
        and transaction_type = 'SALES_CONSUME';

      select count(*)::integer
      into v_payment_count
      from public.order_payments
      where order_id = v_existing_order_id;

      return jsonb_build_object(
        'order_id', v_existing_order_id,
        'order_no', v_existing_order_no,
        'line_count', v_line_count,
        'ledger_count', v_ledger_count,
        'payment_count', v_payment_count,
        'idempotent_replay', true
      );
    end if;
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
    created_at, synced_at, created_by_id, created_by_name, completed_at, voided_at,
    voided_by_id, void_reason, currency, gross_total, promo_discount_total,
    manual_item_discount_total, manual_order_discount, net_total,
    applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json,
    payment_method, payment_ref, migration_notes, client_request_id
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
    now(),
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
    v_net_total,
    coalesce(p_order->>'applied_promotion_id', ''),
    coalesce(p_order->'applied_promotion_snapshot_json', '{}'::jsonb),
    coalesce(p_order->'pos_snapshot_json', '{}'::jsonb),
    nullif(p_order->>'payment_method', ''),
    coalesce(p_order->>'payment_ref', ''),
    coalesce(p_order->>'migration_notes', ''),
    v_client_request_id
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
    cost_at_sale numeric(18,6),
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

  insert into public.order_payments (
    id, order_id, method, amount, reference, created_at
  )
  select
    x.id, v_order_id, x.method, x.amount, coalesce(x.reference, ''), now()
  from jsonb_to_recordset(v_effective_payments) as x(
    id text,
    method text,
    amount bigint,
    reference text
  );
  get diagnostics v_payment_count = row_count;

  if v_line_count <> jsonb_array_length(p_lines) then
    raise exception 'Order line count mismatch';
  end if;
  if v_ledger_count <> jsonb_array_length(p_ledger) then
    raise exception 'Stock ledger count mismatch';
  end if;
  if v_payment_count <> jsonb_array_length(v_effective_payments) then
    raise exception 'Order payment count mismatch';
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'line_count', v_line_count,
    'ledger_count', v_ledger_count,
    'payment_count', v_payment_count,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.create_pos_order_atomic_unvalidated_0024(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.create_pos_order_atomic(
  p_brand_code text,
  p_order jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_ledger jsonb default '[]'::jsonb,
  p_client_request_id text default null,
  p_payments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;

  if jsonb_array_length(p_payments) > 0 and exists (
    select 1
    from jsonb_array_elements(p_payments) as payment
    where nullif(btrim(payment->>'id'), '') is null
       or coalesce(payment->>'method', '') not in ('CASH', 'BANK_TRANSFER')
       or coalesce(payment->>'amount', '') !~ '^[0-9]+$'
  ) then
    raise exception 'Payment amount must be non-negative integer VND and payment fields must be valid';
  end if;

  select public.create_pos_order_atomic_unvalidated_0024(
    p_brand_code,
    p_order,
    p_lines,
    p_event,
    p_ledger,
    p_client_request_id,
    p_payments
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) to service_role;
