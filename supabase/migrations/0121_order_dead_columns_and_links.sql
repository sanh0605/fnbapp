-- supabase/migrations/0121_order_dead_columns_and_links.sql
-- Bán hàng đợt 3, ticket A4b. Plan: docs/superpowers/plans/2026-10-15-ban-hang-dot-3.md.
-- The Supabase CLI runs this file as one transaction (like every migration here), so any
-- refusal below leaves everything unchanged.
--
-- WHAT IT DOES
--   1. Rewrites the order functions so they ignore the dropped keys, store "no link" as null
--      and never cut a daily order number at 3 digits.
--   2. Turns empty text into null in the order link columns.
--   3. Drops the dead columns.
--   4. Drops DRAFT from the order status check.
--   5. Adds foreign keys on the link columns; RESTRICT instead of CASCADE on order lines and
--      order events.
--
-- RUN ORDER (each step needs the owner's own approval)
--   a. A4a code pushed (nothing reads the dead columns any more).
--   b. This migration, OUTSIDE OPENING HOURS. ALTER TABLE takes a lock on orders_v2 and the
--      till's inserts wait behind it for the few seconds the file runs.
--   c. Push the A4b code (the till stops sending the dropped keys) right after b.
--   Data write 1 (price history 0đ rows) is independent of this file: run it before or after.
--   Why this order: after b, the OLD till code still sends currency, payment_ref, cost_at_sale,
--   recipe_snapshot_json and manual_discount_reason in its payload; the functions below read
--   keys by name and ignore any other key, so it keeps working. The NEW code (c) sends no
--   cost_at_sale or recipe_snapshot_json, which the old functions insert into NOT NULL columns,
--   so c must never go out before b.
--
-- MEASURED 2026-10-15 on the live server (read-only queries)
--   orders_v2: 3,475 rows = COMPLETED 3,414, SUPERSEDED 24, VOIDED 37, DRAFT 0.
--   Empty text ('') today, per link column (the rest are already null or hold a real id):
--     orders_v2.parent_order_id 2,244 (25 real, 1,206 null)
--     orders_v2.superseded_by 2,240 (24 real, 1,211 null)
--     orders_v2.voided_by_id 2,229 (37 real, 1,209 null)
--     orders_v2.applied_promotion_id 2,148 (831 real, 496 null)
--     order_events.previous_order_id 2,274 (25 real, 1,215 null) of 3,514 rows
--   Orphans against the new foreign keys: 0 for parent_order_id, superseded_by,
--   applied_promotion_id (against promotions) and previous_order_id (against orders_v2).
--   voided_by_id has NO foreign key: 2 of its 37 values are 'system', not a user (the audit
--   counted 0 orphans; created_by_id and order_events.actor_id are not links to users either:
--   834 and 840 import/system markers).
--   Dropped columns hold only constants: cost_at_sale 0 on 4,824 of 4,824 lines,
--   recipe_snapshot_json '{}' on all, currency 'VND' on all, payment_ref '' on all,
--   manual_discount_reason is non-empty on 107 lines (always 'MANUAL_CASHIER', read by nothing).
--   products 48 rows: brand_id null on all, description empty on all, sort_order 0 on all;
--   product_variants 60 and modifiers 9: sort_order 0 on all.
--   Highest daily order sequence in one outlet-day: 39 (261012001039 style codes), so no number is near 999.
--   product_price_history: 55 rows, 37 at new_price 0 until data write 1 (this file leaves them alone).
--
-- WRITER INVENTORY (skill fnbapp-bulk-data-change, section 6). Source: pg_proc on the live
-- server (every public function whose source names orders_v2, order_lines_v2, order_payments
-- or order_events) plus a grep of app, lib, scripts and supabase/functions.
--   create_pos_order_atomic_unvalidated_0025 (live body is 0085's)  rewritten here
--   supersede_order_v2_atomic, 5 arguments (live body is 0081's)    rewritten here
--   supersede_order_v2_atomic, 6 arguments (0081)  only inserts order_payments (reference stays);
--       it calls the 5-argument one. Unchanged.
--   create_pos_order_atomic (0085)  validates payments, calls the _0025 function. Unchanged.
--   void_order_atomic (live body is 0088's)                         rewritten here
--   TypeScript writers: none write these tables directly; scripts/restore-order-seller-promo.ts
--   updates created_by and the promotion link only.
--   save_product_atomic, sync_topping_price_atomic and create_standalone_topping_product_atomic
--   write product_price_history; none names the dropped products/variants/modifiers columns.
--
-- Triggers. Source: queried live (pg_trigger) 2026-10-15.
--   orders_v2: trg_orders_v2_touch only, BEFORE UPDATE -> touch_updated_at(). Step 2 fires it
--   on every row it changes, so updated_at moves on about 3,4xx orders (nothing in app or lib
--   reads orders_v2.updated_at). products, product_variants, modifiers: a touch trigger each;
--   dropping a column fires nothing. order_lines_v2, order_events, order_payments and
--   product_price_history carry no trigger.
--
-- SIDE EFFECTS to expect
--   Dropping products.brand_id drops its foreign key and idx_products_brand_id with it.
--   The self-references parent_order_id and superseded_by point at each other (an edit sets
--   the old row's superseded_by before the new row exists), so superseded_by is DEFERRABLE
--   INITIALLY DEFERRED: it is checked at commit.
--   order_payments.reference STAYS: the till still has a box for it (0 of 1,883 payments use it).

-- 1. Order functions. Bodies copied from the live server (pg_get_functiondef); only the
--    dropped keys, the null links and the minting parse/pad change. create or replace keeps
--    the function's owner and ACL; the revoke/grant lines state them again on purpose.
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

  return jsonb_build_object(
    'new_order_id', v_new_order_id,
    'line_count', v_line_count
  );
end;
$function$;

revoke all on function public.supersede_order_v2_atomic(text, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.supersede_order_v2_atomic(text, integer, jsonb, jsonb, jsonb) to service_role;

create or replace function public.void_order_atomic(p_order_id text, p_event jsonb, p_voided_at timestamp with time zone DEFAULT now(), p_voided_by_id text DEFAULT ''::text, p_reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_has_void_event boolean;
  v_has_reversal boolean := false;
  v_reversal_count integer := 0;
  v_event_id text;
begin
  if nullif(btrim(p_order_id), '') is null then
    raise exception 'p_order_id is required';
  end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'p_event must be a JSON object';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'p_reason is required';
  end if;
  if lower(coalesce(p_event->>'event_type', '')) <> 'voided' then
    raise exception 'p_event->>''event_type'' <> ''VOIDED''';
  end if;
  if nullif(btrim(p_event->>'id'), '') is null then
    raise exception 'p_event.id is required';
  end if;
  if nullif(btrim(p_event->>'order_id'), '') is distinct from p_order_id then
    raise exception 'p_event.order_id must match p_order_id';
  end if;

  select status
  into v_status
  from public.orders_v2
  where id = p_order_id
  for update;

  if v_status is null then
    raise exception 'Order % not found', p_order_id;
  end if;

  select exists (
    select 1
    from public.order_events
    where order_id = p_order_id
      and event_type = 'VOIDED'
  ) into v_has_void_event;

  -- stock_ledger no longer holds EDIT_REVERSAL rows and nothing writes them
  -- anymore (see the migration header comment); v_has_void_event alone
  -- carries this guard now.

  if v_status = 'VOIDED' then
    if not v_has_void_event then
      raise exception 'Order % is VOIDED without a VOIDED event', p_order_id;
    end if;
    -- reversal_count kept in the return shape for lib/void-order-transaction.ts,
    -- always 0 now that stock_ledger is not read.
    return jsonb_build_object(
      'order_id', p_order_id,
      'reversal_count', v_reversal_count,
      'already_voided', true
    );
  end if;

  if v_status <> 'COMPLETED' then
    raise exception 'Order status is %, must be COMPLETED to void', v_status;
  end if;
  if v_has_void_event or v_has_reversal then
    raise exception 'Order % has an incomplete legacy void state', p_order_id;
  end if;

  v_event_id := p_event->>'id';

  insert into public.order_events (
    id, order_id, event_type, event_at, actor_id, actor_name, from_version,
    to_version, previous_order_id, delta_json, reason
  )
  values (
    v_event_id,
    p_order_id,
    'VOIDED',
    coalesce(nullif(p_event->>'event_at', '')::timestamptz, p_voided_at, now()),
    nullif(p_event->>'actor_id', ''),
    nullif(p_event->>'actor_name', ''),
    nullif(p_event->>'from_version', '')::integer,
    coalesce(nullif(p_event->>'to_version', '')::integer, 1),
    nullif(p_event->>'previous_order_id', ''),
    coalesce(p_event->'delta_json', '{}'::jsonb),
    p_reason
  );

  update public.orders_v2
  set
    status = 'VOIDED',
    voided_at = coalesce(p_voided_at, now()),
    voided_by_id = nullif(p_voided_by_id, ''),
    void_reason = p_reason
  where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'reversal_count', v_reversal_count,
    'already_voided', false
  );
end;
$function$;

revoke all on function public.void_order_atomic(text, jsonb, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.void_order_atomic(text, jsonb, timestamptz, text, text) to service_role;

-- 2. Empty text becomes null in the link columns (voided_by_id too, though it gets no foreign key).
update public.orders_v2
set parent_order_id = nullif(parent_order_id, ''),
    superseded_by = nullif(superseded_by, ''),
    voided_by_id = nullif(voided_by_id, ''),
    applied_promotion_id = nullif(applied_promotion_id, '')
where parent_order_id = '' or superseded_by = '' or voided_by_id = '' or applied_promotion_id = '';

update public.order_events set previous_order_id = null where previous_order_id = '';

-- 3. Dead columns.
alter table public.order_lines_v2
  drop column cost_at_sale,
  drop column recipe_snapshot_json,
  drop column manual_discount_reason;
alter table public.orders_v2
  drop column currency,
  drop column payment_ref;
alter table public.products
  drop column description,
  drop column brand_id,
  drop column sort_order;
alter table public.product_variants drop column sort_order;
alter table public.modifiers drop column sort_order;

-- 4. No order is ever a DRAFT (the till's drafts live in pos_drafts).
alter table public.orders_v2 drop constraint orders_v2_status_check;
alter table public.orders_v2
  add constraint orders_v2_status_check check (status in ('COMPLETED', 'SUPERSEDED', 'VOIDED'));

-- 5. Links and delete behaviour. The step 2 update left the tables free of '' links.
alter table public.orders_v2
  add constraint orders_v2_parent_order_id_fkey
    foreign key (parent_order_id) references public.orders_v2 (id) on delete restrict,
  add constraint orders_v2_superseded_by_fkey
    foreign key (superseded_by) references public.orders_v2 (id) on delete restrict
    deferrable initially deferred,
  add constraint orders_v2_applied_promotion_id_fkey
    foreign key (applied_promotion_id) references public.promotions (id) on delete restrict;

alter table public.order_events
  add constraint order_events_previous_order_id_fkey
    foreign key (previous_order_id) references public.orders_v2 (id) on delete restrict;

alter table public.order_lines_v2 drop constraint order_lines_v2_order_id_fkey;
alter table public.order_lines_v2
  add constraint order_lines_v2_order_id_fkey
    foreign key (order_id) references public.orders_v2 (id) on delete restrict;

alter table public.order_events drop constraint order_events_order_id_fkey;
alter table public.order_events
  add constraint order_events_order_id_fkey
    foreign key (order_id) references public.orders_v2 (id) on delete restrict;
