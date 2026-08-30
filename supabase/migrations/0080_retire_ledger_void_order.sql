-- Stock ledger retirement, Phase C, function 3 of 8: void_order_atomic.
-- docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md section 5.
--
-- Removes the EDIT_REVERSAL insert into stock_ledger. Phase A already
-- proved this insert has written nothing for real data since the
-- 2026-08-07 cutover (app/admin/orders/actions.ts's own comment: 0
-- stock_ledger rows across all 24 real VOIDED orders and all 17 real
-- EDITED orders checked) -- reversalEntries has always been [].
--
-- Deliberately left untouched, per section 5.5 (reads, not the write) and
-- the plan's section 2d.3 precedent for leaving stale-but-harmless reads
-- alone: v_has_reversal (a SELECT against stock_ledger used only by the
-- "incomplete legacy void state" guard, which only fires on a COMPLETED
-- order with stray rows already sitting in the ledger from before this
-- function was hardened) and the already-voided branch's fresh SELECT
-- count. Once nothing new is ever inserted, that guard simply stops being
-- able to trip on new data, which is correct, not a regression -- the real
-- idempotency gate is v_status = 'VOIDED' plus the order_events VOIDED-row
-- check, both untouched.
--
-- p_reversal_ledger removed from the parameter list, so this drops and
-- recreates rather than create-or-replace.
--
-- Deploy order (section 5.7): application code must stop sending
-- p_reversal_ledger BEFORE this migration is applied.

drop function if exists public.void_order_atomic(text, jsonb, jsonb, timestamptz, text, text);

create function public.void_order_atomic(
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
  v_has_reversal boolean;
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

  select exists (
    select 1
    from public.stock_ledger
    where reference_id = p_order_id
      and transaction_type = 'EDIT_REVERSAL'
  ) into v_has_reversal;

  if v_status = 'VOIDED' then
    if not v_has_void_event then
      raise exception 'Order % is VOIDED without a VOIDED event', p_order_id;
    end if;
    select count(*)::integer
    into v_reversal_count
    from public.stock_ledger
    where reference_id = p_order_id
      and transaction_type = 'EDIT_REVERSAL';
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

revoke all on function public.void_order_atomic(
  text, jsonb, timestamptz, text, text
) from public;
revoke all on function public.void_order_atomic(
  text, jsonb, timestamptz, text, text
) from anon;
revoke all on function public.void_order_atomic(
  text, jsonb, timestamptz, text, text
) from authenticated;
grant execute on function public.void_order_atomic(
  text, jsonb, timestamptz, text, text
) to service_role;
