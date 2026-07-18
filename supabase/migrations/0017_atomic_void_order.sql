-- Atomically reverse inventory, record the VOIDED event, and transition the
-- order status. Any exception rolls back all three writes.

create or replace function public.void_order_atomic(
  p_order_id text,
  p_event jsonb,
  p_reversal_ledger jsonb default '[]'::jsonb,
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
  if p_reversal_ledger is null or jsonb_typeof(p_reversal_ledger) <> 'array' then
    raise exception 'p_reversal_ledger must be a JSON array';
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
  if exists (
    select 1
    from jsonb_array_elements(p_reversal_ledger) as entry
    where lower(coalesce(entry->>'transaction_type', '')) <> 'edit_reversal'
       or nullif(btrim(entry->>'reference_id'), '') is distinct from p_order_id
  ) then
    raise exception 'p_reversal_ledger may only contain EDIT_REVERSAL rows for this order';
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

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change,
    unit_cost, created_at, order_event_id, cost_at_sale, source, notes
  )
  select
    row.id,
    'EDIT_REVERSAL',
    p_order_id,
    row.item_reference,
    row.quantity_change,
    coalesce(row.unit_cost, 0),
    coalesce(row.created_at, p_voided_at, now()),
    v_event_id,
    coalesce(row.cost_at_sale, 0),
    coalesce(row.source, ''),
    coalesce(row.notes, '')
  from jsonb_to_recordset(p_reversal_ledger) as row(
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
  get diagnostics v_reversal_count = row_count;

  if v_reversal_count <> jsonb_array_length(p_reversal_ledger) then
    raise exception 'Reversal ledger count mismatch';
  end if;

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
  text, jsonb, jsonb, timestamptz, text, text
) from public;
revoke all on function public.void_order_atomic(
  text, jsonb, jsonb, timestamptz, text, text
) from anon;
revoke all on function public.void_order_atomic(
  text, jsonb, jsonb, timestamptz, text, text
) from authenticated;
grant execute on function public.void_order_atomic(
  text, jsonb, jsonb, timestamptz, text, text
) to service_role;
