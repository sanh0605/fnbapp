-- Stock ledger retirement, Phase C, function 4 of 8: supersede_order_v2_atomic.
-- docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md section 5.
--
-- This name is actually TWO live overloads, not one -- the plan's own
-- section 5.3 table didn't know this; found by querying live pg_proc
-- directly rather than trusting the migration files (0074 alone only shows
-- the 6-param "core"):
--
--   1. The 6-param core (0074): p_old_order_id, p_expected_old_version,
--      p_new_order, p_new_lines, p_event, p_ledger. Has the real insert
--      into stock_ledger.
--   2. A 7-param wrapper (0035, "preserve order payments on edit"): adds
--      p_payments, and internally calls `select
--      public.supersede_order_v2_atomic(...6 args...) into v_result`
--      before inserting into order_payments. lib/order-edit-transaction.ts
--      calls THIS one, not the core directly -- the same
--      validating-wrapper-delegates-to-core shape as
--      create_pos_order_atomic / create_pos_order_atomic_unvalidated_0025
--      from Phase B.
--
-- Both must change together in this one migration, or every order edit
-- breaks: the wrapper's internal call has to keep matching the core's
-- actual parameter list.
--
-- p_ledger removed from the core's signature (and consequently from what
-- the wrapper passes through) -- both parameter lists change, so both drop
-- and recreate rather than create-or-replace.
--
-- Deploy order (section 5.7): application code must stop sending
-- p_ledger BEFORE this migration is applied.

drop function if exists public.supersede_order_v2_atomic(text, integer, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.supersede_order_v2_atomic(text, integer, jsonb, jsonb, jsonb, jsonb);

-- 1. The core (was 6 params, now 5 -- p_ledger removed). Body copied
-- forward unchanged from 0074 apart from the ledger validation, insert,
-- and count-guard blocks, and the ledger_count return field.
create function public.supersede_order_v2_atomic(
  p_old_order_id text,
  p_expected_old_version integer,
  p_new_order jsonb,
  p_new_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
  v_old_version integer;
  v_old_outlet_id text;
  v_new_order_id text;
  v_event_id text;
  v_line_count integer := 0;
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

  select status, version, outlet_id
  into v_old_status, v_old_version, v_old_outlet_id
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

  update public.orders_v2
  set
    status = 'SUPERSEDED',
    superseded_by = v_new_order_id,
    updated_at = now()
  where id = p_old_order_id;

  insert into public.orders_v2 (
    id, order_no, brand_id, outlet_id, status, version, parent_order_id, superseded_by,
    created_at, created_by_id, created_by_name, completed_at, voided_at,
    voided_by_id, void_reason, currency, gross_total, promo_discount_total,
    manual_item_discount_total, manual_order_discount, net_total,
    applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json,
    payment_method, payment_ref, migration_notes
  ) values (
    v_new_order_id,
    p_new_order->>'order_no',
    p_new_order->>'brand_id',
    v_old_outlet_id,
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
    cost_at_sale numeric(18,6),
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

  return jsonb_build_object(
    'new_order_id', v_new_order_id,
    'line_count', v_line_count
  );
end;
$$;

revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb
) from public;
revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb
) from anon;
revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb
) from authenticated;
grant execute on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb
) to service_role;

-- 2. The payments wrapper (was 7 params, now 6 -- p_ledger removed). Body
-- copied forward unchanged from the live function (0035) apart from
-- dropping p_ledger from its own signature and from the internal call to
-- the core above.
create function public.supersede_order_v2_atomic(
  p_old_order_id text,
  p_expected_old_version integer,
  p_new_order jsonb,
  p_new_lines jsonb,
  p_event jsonb,
  p_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_new_order_id text;
  v_net_total bigint;
  v_payment_sum bigint;
  v_payment_count integer := 0;
begin
  if p_new_order is null or jsonb_typeof(p_new_order) <> 'object' then
    raise exception 'p_new_order must be a JSON object';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;
  if jsonb_array_length(p_payments) = 0 then
    raise exception 'p_payments must contain at least one row';
  end if;

  v_new_order_id := nullif(btrim(p_new_order->>'id'), '');
  if v_new_order_id is null then
    raise exception 'p_new_order.id is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payments) as payment
    where nullif(btrim(payment->>'id'), '') is null
       or payment->>'order_id' is distinct from v_new_order_id
  ) then
    raise exception 'Every payment must reference the new order';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payments) as payment
    where coalesce(payment->>'method', '') not in ('CASH', 'BANK_TRANSFER')
  ) then
    raise exception 'Payment method is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payments) as payment
    where coalesce(payment->>'amount', '') !~ '^[0-9]+$'
  ) then
    raise exception 'Payment amount must be non-negative integer VND';
  end if;

  select coalesce(sum((payment->>'amount')::bigint), 0)
  into v_payment_sum
  from jsonb_array_elements(p_payments) as payment;

  v_net_total := coalesce(nullif(p_new_order->>'net_total', '')::bigint, 0);
  if v_payment_sum <> v_net_total then
    raise exception
      'Payment total % does not match order net_total %',
      v_payment_sum, v_net_total;
  end if;

  select public.supersede_order_v2_atomic(
    p_old_order_id,
    p_expected_old_version,
    p_new_order,
    p_new_lines,
    p_event
  )
  into v_result;

  insert into public.order_payments (
    id, order_id, method, amount, reference, created_at
  )
  select
    payment.id,
    v_new_order_id,
    payment.method,
    payment.amount,
    coalesce(payment.reference, ''),
    now()
  from jsonb_to_recordset(p_payments) as payment(
    id text,
    order_id text,
    method text,
    amount bigint,
    reference text
  );
  get diagnostics v_payment_count = row_count;

  if v_payment_count <> jsonb_array_length(p_payments) then
    raise exception 'Payment count mismatch';
  end if;

  return v_result || jsonb_build_object('payment_count', v_payment_count);
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
