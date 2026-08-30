-- Stock ledger retirement, Phase C, function 8 of 8 (POS, last per
-- instruction): create_pos_order_atomic_unvalidated_0025 and its outer
-- validating wrapper create_pos_order_atomic.
-- docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md section 5.
--
-- Sales stopped writing real ledger data at the 2026-08-07 cutover
-- (docs/BUSINESS-RULES.md) -- the POS client has been sending
-- ledgerRows: [] on every real checkout since then (app/pos/actions.ts).
-- This migration removes the now-always-empty insert into stock_ledger,
-- and its matching read in the idempotent-replay branch (the count of
-- existing SALES_CONSUME rows for a client_request_id being replayed --
-- always 0 for any order created after this deploy, since nothing writes
-- there anymore; unlike void_order_atomic's legacy-state guard, this read
-- has no other purpose to preserve).
--
-- create_pos_order_atomic_unvalidated_0025 is NOT renamed despite its
-- misleading name -- section 5.5 explicitly rules this out: renaming a
-- function on the money path is a real risk traded for cosmetic
-- readability, and the confusing name naturally stops surfacing in
-- "who touches stock_ledger" searches once the write is gone.
--
-- Both functions' signatures change (p_ledger removed), so both drop and
-- recreate rather than create-or-replace -- same as commit 1/8's
-- save_purchase_order_atomic and commit 4/8's supersede_order_v2_atomic.
--
-- Deploy order (section 5.7): application code must stop sending p_ledger
-- BEFORE this migration is applied. This is the last of the 8 commits and
-- the one every real sale depends on -- get the ordering wrong here and
-- checkout breaks for every outlet, not just one flow.

drop function if exists public.create_pos_order_atomic(text, jsonb, jsonb, jsonb, jsonb, text, jsonb);
drop function if exists public.create_pos_order_atomic_unvalidated_0025(text, jsonb, jsonb, jsonb, jsonb, text, jsonb);

-- 1. The inner, unvalidated function. Body copied forward unchanged from
-- 0072 apart from the ledger validation, insert, count-guard, and the
-- idempotent-replay branch's ledger_count read -- all removed together
-- since they exist only to serve the write being removed.
create function public.create_pos_order_atomic_unvalidated_0025(
  p_outlet_code text,
  p_order jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_client_request_id text default null,
  p_payments jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_outlet_code text;
  v_date_part text;
  v_code_prefix text;
  v_order_id text;
  v_order_no text;
  v_next_number integer;
  v_line_count integer := 0;
  v_payment_count integer := 0;
  v_client_request_id text;
  v_existing_order_id text;
  v_existing_order_no text;
  v_net_total bigint;
  v_payment_sum bigint;
  v_effective_payments jsonb;
  v_outlet_id text;
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
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;

  v_outlet_code := btrim(coalesce(p_outlet_code, ''));
  v_order_id := nullif(btrim(p_order->>'id'), '');
  v_outlet_id := nullif(btrim(p_order->>'outlet_id'), '');
  v_client_request_id := nullif(btrim(coalesce(p_client_request_id, '')), '');
  if v_outlet_code = '' or v_outlet_code !~ '^[0-9]{3}$' then
    raise exception 'p_outlet_code must be exactly 3 digits';
  end if;
  if v_order_id is null then
    raise exception 'p_order.id is required';
  end if;
  if v_outlet_id is null then
    raise exception 'p_order.outlet_id is required';
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
      into v_payment_count
      from public.order_payments
      where order_id = v_existing_order_id;

      return jsonb_build_object(
        'order_id', v_existing_order_id,
        'order_no', v_existing_order_no,
        'line_count', v_line_count,
        'payment_count', v_payment_count,
        'idempotent_replay', true
      );
    end if;
  end if;

  -- Date is derived from the order's own created_at, in Asia/Ho_Chi_Minh --
  -- Postgres's own timezone conversion, not a client-side round trip, so
  -- OPEN-ITEMS 55's class of bug cannot reach this code at all.
  v_date_part := to_char(
    (p_order->>'created_at')::timestamptz at time zone 'Asia/Ho_Chi_Minh',
    'YYMMDD'
  );
  v_code_prefix := v_date_part || v_outlet_code;

  perform pg_advisory_xact_lock(hashtext('pos:order_no:' || v_code_prefix));

  select coalesce(max(
    case
      when substring(order_no from length(v_code_prefix) + 1) ~ '^[0-9]{3}$'
      then substring(order_no from length(v_code_prefix) + 1)::integer
      else null
    end
  ), 0) + 1
  into v_next_number
  from public.orders_v2
  where left(order_no, length(v_code_prefix)) = v_code_prefix;

  v_order_no := v_code_prefix || lpad(v_next_number::text, 3, '0');

  insert into public.orders_v2 (
    id, order_no, brand_id, outlet_id, status, version, parent_order_id, superseded_by,
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
    v_outlet_id,
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
  if v_payment_count <> jsonb_array_length(v_effective_payments) then
    raise exception 'Order payment count mismatch';
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'line_count', v_line_count,
    'payment_count', v_payment_count,
    'idempotent_replay', false
  );
end;
$$;

-- 2. The validated entry point. Body unchanged apart from dropping p_ledger
-- from its own signature and from the internal delegating call above.
create function public.create_pos_order_atomic(
  p_outlet_code text,
  p_order jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_client_request_id text default null,
  p_payments jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
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

  select public.create_pos_order_atomic_unvalidated_0025(
    p_outlet_code,
    p_order,
    p_lines,
    p_event,
    p_client_request_id,
    p_payments
  )
  into v_result;

  return v_result;
end;
$$;
