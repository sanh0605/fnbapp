-- Phase D blocker 4/4: void_order_atomic stops reading stock_ledger.
--
-- Two old-state guards asked the same question ("does this order already
-- have an EDIT_REVERSAL row?") via two different tables: order_events
-- (v_has_void_event) and stock_ledger (v_has_reversal). Both were always
-- written atomically together by this same function since its first version
-- (0017_atomic_void_order.sql inserted both the stock_ledger EDIT_REVERSAL
-- rows and the order_events VOIDED row in one transaction) -- so wherever
-- v_has_reversal could ever have been true, v_has_void_event was already
-- true for the same order, in the same transaction. The order_events guard
-- alone carries the same protection.
--
-- Phase C (0080_retire_ledger_void_order.sql) already stopped this function
-- from writing to stock_ledger. Live measurement 2026-09-01: stock_ledger
-- holds 384 rows, all PO_RECEIPT (300) or STOCK_ADJUST (84) -- zero
-- EDIT_REVERSAL. This function is the only live function that ever
-- referenced EDIT_REVERSAL (checked via pg_get_functiondef across every
-- function in the public schema, comments stripped), and it no longer
-- writes that type -- so this read can never again observe a true value.
--
-- Note for the record: EDIT_REVERSAL rows did exist historically (72 of
-- them, per DEVELOPMENT-TRACKING.md's 2026-08-07 entry) before being
-- deleted by scripts/delete-derived-stock-rows.ts on 2026-08-07. This is
-- not the same claim as "EDIT_REVERSAL never happened" -- it is the claim
-- that whenever it did happen, order_events already knew about it too,
-- because both rows were written in the same transaction.
create or replace function public.void_order_atomic(
  p_order_id text,
  p_event jsonb,
  p_voided_at timestamptz default now(),
  p_voided_by_id text default '',
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    coalesce(p_event->>'previous_order_id', ''),
    coalesce(p_event->'delta_json', '{}'::jsonb),
    p_reason
  );

  update public.orders_v2
  set
    status = 'VOIDED',
    voided_at = coalesce(p_voided_at, now()),
    voided_by_id = coalesce(p_voided_by_id, ''),
    void_reason = p_reason
  where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'reversal_count', v_reversal_count,
    'already_voided', false
  );
end;
$$;
