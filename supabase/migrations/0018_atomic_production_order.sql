-- Persist a synchronous production batch and its inventory movements in one
-- transaction. PostgreSQL rolls back every insert if any validation or write
-- fails.

create or replace function public.save_production_order_atomic(
  p_order jsonb,
  p_items jsonb default '[]'::jsonb,
  p_ledger jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text;
  v_semi_product_id text;
  v_batch_yield numeric;
  v_created_at timestamptz;
  v_completed_at timestamptz;
  v_next_order integer;
  v_next_item integer;
  v_next_ledger integer;
  v_item_count integer := 0;
  v_ledger_count integer := 0;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array';
  end if;
  if p_ledger is null or jsonb_typeof(p_ledger) <> 'array' then
    raise exception 'p_ledger must be a JSON array';
  end if;

  v_semi_product_id := nullif(btrim(p_order->>'semi_product_id'), '');
  v_batch_yield := nullif(p_order->>'batch_yield', '')::numeric;
  if v_semi_product_id is null then
    raise exception 'p_order.semi_product_id is required';
  end if;
  if v_batch_yield is null or v_batch_yield <= 0 then
    raise exception 'p_order.batch_yield must be positive';
  end if;
  if coalesce(p_order->>'status', '') <> 'COMPLETED' then
    raise exception 'p_order.status must be COMPLETED';
  end if;
  v_created_at := coalesce(
    nullif(p_order->>'created_at', '')::timestamptz,
    now()
  );
  v_completed_at := coalesce(
    nullif(p_order->>'completed_at', '')::timestamptz,
    v_created_at
  );

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry
    where nullif(btrim(entry->>'ingredient_id'), '') is null
       or coalesce(entry->>'ingredient_type', '') not in ('BASE_INGREDIENT', 'SEMI_PRODUCT')
       or coalesce(nullif(entry->>'quantity', '')::numeric, 0) <= 0
  ) then
    raise exception 'p_items contains an invalid production ingredient';
  end if;

  if jsonb_array_length(p_ledger) <> jsonb_array_length(p_items) + 1 then
    raise exception 'p_ledger must contain one consume per item plus one yield';
  end if;
  if (
    select count(*)
    from jsonb_array_elements(p_ledger) as entry
    where entry->>'transaction_type' = 'PRODUCTION_YIELD'
      and entry->>'item_reference' = v_semi_product_id
      and nullif(entry->>'quantity_change', '')::numeric = v_batch_yield
  ) <> 1 then
    raise exception 'p_ledger must contain exactly one matching PRODUCTION_YIELD';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_ledger) as entry
    where coalesce(entry->>'transaction_type', '') not in ('PRODUCTION_CONSUME', 'PRODUCTION_YIELD')
       or (entry->>'transaction_type' = 'PRODUCTION_CONSUME'
           and coalesce(nullif(entry->>'quantity_change', '')::numeric, 0) >= 0)
       or (entry->>'transaction_type' = 'PRODUCTION_YIELD'
           and coalesce(nullif(entry->>'quantity_change', '')::numeric, 0) <= 0)
  ) then
    raise exception 'p_ledger contains an invalid production movement';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where not exists (
      select 1
      from jsonb_array_elements(p_ledger) as ledger
      where ledger->>'transaction_type' = 'PRODUCTION_CONSUME'
        and ledger->>'item_reference' = item->>'ingredient_id'
        and nullif(ledger->>'quantity_change', '')::numeric =
          -nullif(item->>'quantity', '')::numeric
    )
  ) or exists (
    select 1
    from jsonb_array_elements(p_ledger) as ledger
    where ledger->>'transaction_type' = 'PRODUCTION_CONSUME'
      and not exists (
        select 1
        from jsonb_array_elements(p_items) as item
        where item->>'ingredient_id' = ledger->>'item_reference'
          and nullif(item->>'quantity', '')::numeric =
            -nullif(ledger->>'quantity_change', '')::numeric
      )
  ) then
    raise exception 'p_items and PRODUCTION_CONSUME rows do not match';
  end if;

  perform pg_advisory_xact_lock(hashtext('production_orders:id'));
  perform pg_advisory_xact_lock(hashtext('production_items:id'));
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));

  select coalesce(max(substring(id from '^PRD-([0-9]+)$')::integer), 0) + 1
  into v_next_order
  from public.production_orders
  where id ~ '^PRD-[0-9]+$';
  select coalesce(max(substring(id from '^PRI-([0-9]+)$')::integer), 0) + 1
  into v_next_item
  from public.production_items
  where id ~ '^PRI-[0-9]+$';
  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0) + 1
  into v_next_ledger
  from public.stock_ledger
  where id ~ '^STK-[0-9]+$';

  v_order_id := 'PRD-' || lpad(v_next_order::text, 3, '0');
  insert into public.production_orders (
    id, semi_product_id, batch_yield, status, notes, created_by_id,
    created_by_name, created_at, completed_at
  ) values (
    v_order_id,
    v_semi_product_id,
    v_batch_yield,
    'COMPLETED',
    nullif(p_order->>'notes', ''),
    nullif(p_order->>'created_by_id', ''),
    nullif(p_order->>'created_by_name', ''),
    v_created_at,
    v_completed_at
  );

  insert into public.production_items (
    id, production_order_id, ingredient_id, ingredient_type, quantity,
    unit_id, created_at
  )
  select
    'PRI-' || lpad((v_next_item + entry.ordinality - 1)::text, 3, '0'),
    v_order_id,
    entry.value->>'ingredient_id',
    entry.value->>'ingredient_type',
    (entry.value->>'quantity')::numeric,
    nullif(entry.value->>'unit_id', ''),
    v_created_at
  from jsonb_array_elements(p_items) with ordinality as entry(value, ordinality);
  get diagnostics v_item_count = row_count;

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change,
    unit_cost, source, notes, created_at
  )
  select
    'STK-' || lpad((v_next_ledger + entry.ordinality - 1)::text, 3, '0'),
    entry.value->>'transaction_type',
    v_order_id,
    entry.value->>'item_reference',
    (entry.value->>'quantity_change')::numeric,
    coalesce(nullif(entry.value->>'unit_cost', '')::numeric, 0),
    coalesce(entry.value->>'source', ''),
    coalesce(entry.value->>'notes', ''),
    coalesce(nullif(entry.value->>'created_at', '')::timestamptz, v_created_at)
  from jsonb_array_elements(p_ledger) with ordinality as entry(value, ordinality);
  get diagnostics v_ledger_count = row_count;

  if v_item_count <> jsonb_array_length(p_items)
     or v_ledger_count <> jsonb_array_length(p_ledger) then
    raise exception 'Production batch persisted row count mismatch';
  end if;

  return jsonb_build_object(
    'production_order_id', v_order_id,
    'item_count', v_item_count,
    'ledger_count', v_ledger_count
  );
end;
$$;

revoke all on function public.save_production_order_atomic(jsonb, jsonb, jsonb) from public;
revoke all on function public.save_production_order_atomic(jsonb, jsonb, jsonb) from anon;
revoke all on function public.save_production_order_atomic(jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.save_production_order_atomic(jsonb, jsonb, jsonb) to service_role;
