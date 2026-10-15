-- supabase/migrations/0127_order_promotions.sql
-- C10 step 3 (plan 2026-10-15-c10-tinh-khuyen-mai.md, ticket S7). NOT YET RUN on the server;
-- the owner approves running it separately, outside opening hours, BEFORE the step 4 code push.
-- Additive in SQL, but the server now refuses orders without promotion_ids/shown_total: a till on
-- the old code is refused with the reload message. The SQL bridge (no promotions key sent -> one
-- row is made from applied_promotion_id) stays only as a no-op default.
--
-- WHAT IT DOES
--   1. order_promotions: one row per promotion applied to an order (spec 4.3).
--   2. promotions.stackable ("Dung chung"), default false.
--   3. Backfills one row per order that has applied_promotion_id (rerun-safe).
--   4. create_pos_order_atomic_unvalidated_0025 also writes order_promotions.
--   5. supersede_order_v2_atomic copies the old order's order_promotions to the edited order.
--
-- MEASURED 2026-10-15 (read-only): orders_v2 3,507 rows, 831 with applied_promotion_id;
--   promotions 2 rows; order_promotions did not exist.
--
-- Triggers. Source: queried live (pg_trigger) 2026-10-15. promotions: trg_promotions_touch
--   (BEFORE UPDATE, touch_updated_at); adding a column fires nothing. orders_v2 is only read by
--   the backfill. order_promotions is new and carries no trigger.
--
-- WRITER INVENTORY. Only create_pos_order_atomic_unvalidated_0025 (live body is 0121's, last
--   create or replace of it; the wrapper create_pos_order_atomic is 0085's and passes p_order
--   through unchanged) and supersede_order_v2_atomic (live body is 0121's; it copies the old
--   order's order_promotions rows to the new order) write the new table.

create table if not exists public.order_promotions (
  id text primary key,
  order_id text not null references public.orders_v2(id) on delete restrict,
  promotion_id text not null references public.promotions(id) on delete restrict,
  seq integer not null,
  name text not null,
  code text not null default '',
  type text not null,
  discount_type text not null,
  discount_value bigint not null,
  stackable boolean not null default false,
  amount bigint not null check (amount >= 0),
  unique (order_id, promotion_id)
);

alter table public.order_promotions enable row level security;
revoke all on table public.order_promotions from anon, authenticated;

alter table public.promotions add column if not exists stackable boolean not null default false;

insert into public.order_promotions (
  id, order_id, promotion_id, seq, name, code, type, discount_type, discount_value, stackable, amount
)
select
  'op-' || o.id, o.id, pr.id, 1,
  coalesce(nullif(o.applied_promotion_snapshot_json->>'name', ''), pr.name),
  coalesce(o.applied_promotion_snapshot_json->>'code', pr.code, ''),
  coalesce(nullif(o.applied_promotion_snapshot_json->>'type', ''), pr.type),
  coalesce(nullif(o.applied_promotion_snapshot_json->>'discount_type', ''), pr.discount_type),
  coalesce(round((o.applied_promotion_snapshot_json->>'discount_value')::numeric)::bigint, pr.discount_value),
  pr.stackable,
  o.promo_discount_total
from public.orders_v2 o
join public.promotions pr on pr.id = o.applied_promotion_id
where not exists (
  select 1 from public.order_promotions op
  where op.order_id = o.id and op.promotion_id = o.applied_promotion_id
);

-- 4. Order function: body copied from 0121 (the live one); only the order_promotions insert is new.
create or replace function public.create_pos_order_atomic_unvalidated_0025(p_outlet_code text, p_order jsonb, p_lines jsonb DEFAULT '[]'::jsonb, p_event jsonb DEFAULT '{}'::jsonb, p_client_request_id text DEFAULT NULL::text, p_payments jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
        'reference', ''
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
      when substring(order_no from length(v_code_prefix) + 1) ~ '^[0-9]{3,}$'
      then substring(order_no from length(v_code_prefix) + 1)::integer
      else null
    end
  ), 0) + 1
  into v_next_number
  from public.orders_v2
  where left(order_no, length(v_code_prefix)) = v_code_prefix;

  -- lpad cuts to its length: lpad('1000', 3, '0') is '100'. Past 999 the number just grows.
  v_order_no := v_code_prefix || case when v_next_number < 1000 then lpad(v_next_number::text, 3, '0') else v_next_number::text end;

  insert into public.orders_v2 (
    id, order_no, brand_id, outlet_id, status, version, parent_order_id, superseded_by,
    created_at, synced_at, created_by_id, created_by_name, completed_at, voided_at,
    voided_by_id, void_reason, gross_total, promo_discount_total,
    manual_item_discount_total, manual_order_discount, net_total,
    applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json,
    payment_method, migration_notes, client_request_id
  )
  values (
    v_order_id,
    v_order_no,
    p_order->>'brand_id',
    v_outlet_id,
    p_order->>'status',
    coalesce((p_order->>'version')::integer, 1),
    nullif(p_order->>'parent_order_id', ''),
    nullif(p_order->>'superseded_by', ''),
    (p_order->>'created_at')::timestamptz,
    now(),
    nullif(p_order->>'created_by_id', ''),
    nullif(p_order->>'created_by_name', ''),
    nullif(p_order->>'completed_at', '')::timestamptz,
    nullif(p_order->>'voided_at', '')::timestamptz,
    nullif(p_order->>'voided_by_id', ''),
    coalesce(p_order->>'void_reason', ''),
    coalesce((p_order->>'gross_total')::bigint, 0),
    coalesce((p_order->>'promo_discount_total')::bigint, 0),
    coalesce((p_order->>'manual_item_discount_total')::bigint, 0),
    coalesce((p_order->>'manual_order_discount')::bigint, 0),
    v_net_total,
    nullif(p_order->>'applied_promotion_id', ''),
    coalesce(p_order->'applied_promotion_snapshot_json', '{}'::jsonb),
    coalesce(p_order->'pos_snapshot_json', '{}'::jsonb),
    nullif(p_order->>'payment_method', ''),
    coalesce(p_order->>'migration_notes', ''),
    v_client_request_id
  );

  insert into public.order_lines_v2 (
    id, order_id, line_no, product_id, product_snapshot_json, variant_id,
    variant_snapshot_json, qty, unit_price, modifiers_snapshot_json,
    gross_line_total, promo_discount, manual_item_discount,
    order_discount_allocation, net_line_total, promo_discount_reason,
    created_at
  )
  select
    x.id, v_order_id, x.line_no, x.product_id, x.product_snapshot_json,
    x.variant_id, x.variant_snapshot_json, x.qty, x.unit_price,
    x.modifiers_snapshot_json, x.gross_line_total, x.promo_discount,
    x.manual_item_discount, x.order_discount_allocation, x.net_line_total,
    x.promo_discount_reason, coalesce(x.created_at, now())
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
    promo_discount_reason text,
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
    nullif(p_event->>'previous_order_id', ''),
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

  -- Promotions applied to the order: from p_order->'promotions'; when absent (a caller that
  -- does not send it) one row is made from applied_promotion_id (bridge, removed with that column).
  if jsonb_typeof(p_order->'promotions') = 'array' and jsonb_array_length(p_order->'promotions') > 0 then
    insert into public.order_promotions (
      id, order_id, promotion_id, seq, name, code, type, discount_type, discount_value, stackable, amount
    )
    select
      'op-' || gen_random_uuid()::text, v_order_id, x.promotion_id, x.seq, x.name, coalesce(x.code, ''),
      x.type, x.discount_type, x.discount_value, coalesce(x.stackable, false), x.amount
    from jsonb_to_recordset(p_order->'promotions') as x(
      promotion_id text, seq integer, name text, code text, type text,
      discount_type text, discount_value bigint, stackable boolean, amount bigint
    );
  elsif nullif(p_order->>'applied_promotion_id', '') is not null then
    insert into public.order_promotions (
      id, order_id, promotion_id, seq, name, code, type, discount_type, discount_value, stackable, amount
    )
    select
      'op-' || gen_random_uuid()::text, v_order_id, pr.id, 1, pr.name, coalesce(pr.code, ''),
      pr.type, pr.discount_type, pr.discount_value, pr.stackable,
      coalesce((p_order->>'promo_discount_total')::bigint, 0)
    from public.promotions pr
    where pr.id = nullif(p_order->>'applied_promotion_id', '');
  end if;

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
$function$;

revoke all on function public.create_pos_order_atomic_unvalidated_0025(text, jsonb, jsonb, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_pos_order_atomic_unvalidated_0025(text, jsonb, jsonb, jsonb, text, jsonb) to service_role;

-- 5. Edit function: body copied from 0121 (the live one); only the order_promotions copy is new.
create or replace function public.supersede_order_v2_atomic(p_old_order_id text, p_expected_old_version integer, p_new_order jsonb, p_new_lines jsonb DEFAULT '[]'::jsonb, p_event jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    voided_by_id, void_reason, gross_total, promo_discount_total,
    manual_item_discount_total, manual_order_discount, net_total,
    applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json,
    payment_method, migration_notes
  ) values (
    v_new_order_id,
    p_new_order->>'order_no',
    p_new_order->>'brand_id',
    v_old_outlet_id,
    'COMPLETED',
    (p_new_order->>'version')::integer,
    p_old_order_id,
    nullif(p_new_order->>'superseded_by', ''),
    (p_new_order->>'created_at')::timestamptz,
    nullif(p_new_order->>'created_by_id', ''),
    nullif(p_new_order->>'created_by_name', ''),
    nullif(p_new_order->>'completed_at', '')::timestamptz,
    nullif(p_new_order->>'voided_at', '')::timestamptz,
    nullif(p_new_order->>'voided_by_id', ''),
    coalesce(p_new_order->>'void_reason', ''),
    coalesce(nullif(p_new_order->>'gross_total', '')::bigint, 0),
    coalesce(nullif(p_new_order->>'promo_discount_total', '')::bigint, 0),
    coalesce(nullif(p_new_order->>'manual_item_discount_total', '')::bigint, 0),
    coalesce(nullif(p_new_order->>'manual_order_discount', '')::bigint, 0),
    coalesce(nullif(p_new_order->>'net_total', '')::bigint, 0),
    nullif(p_new_order->>'applied_promotion_id', ''),
    coalesce(p_new_order->'applied_promotion_snapshot_json', '{}'::jsonb),
    coalesce(p_new_order->'pos_snapshot_json', '{}'::jsonb),
    nullif(p_new_order->>'payment_method', ''),
    coalesce(p_new_order->>'migration_notes', '')
  );

  insert into public.order_lines_v2 (
    id, order_id, line_no, product_id, product_snapshot_json, variant_id,
    variant_snapshot_json, qty, unit_price, modifiers_snapshot_json,
    gross_line_total, promo_discount, manual_item_discount,
    order_discount_allocation, net_line_total, promo_discount_reason,
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
    row.promo_discount_reason,
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
    promo_discount_reason text,
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

  -- Edited order keeps its promotions: copy the old order's rows to the new order.
  insert into public.order_promotions (
    id, order_id, promotion_id, seq, name, code, type, discount_type, discount_value, stackable, amount
  )
  select
    'op-' || gen_random_uuid()::text, v_new_order_id, promotion_id, seq, name, code, type, discount_type, discount_value, stackable, amount
  from public.order_promotions
  where order_id = p_old_order_id;

  return jsonb_build_object(
    'new_order_id', v_new_order_id,
    'line_count', v_line_count
  );
end;
$function$;

revoke all on function public.supersede_order_v2_atomic(text, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.supersede_order_v2_atomic(text, integer, jsonb, jsonb, jsonb) to service_role;
