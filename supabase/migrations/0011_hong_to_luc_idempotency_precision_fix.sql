-- Atomic, fingerprint-gated Hồng trà chanh -> Lục trà chanh recovery.

create or replace function public.apply_hong_to_luc_migration(
  p_migration_key text,
  p_source_hash text,
  p_snapshot_id text,
  p_manifest_sha256 text,
  p_write_set jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
  v_line_update jsonb;
  v_before jsonb;
  v_after jsonb;
  v_ledger jsonb;
  v_event jsonb;
  v_recipe jsonb;
  v_actual jsonb;
  v_existing public.data_migration_runs%rowtype;
  v_order_ids text[];
  v_order_numbers text[];
  v_expected_order_count integer;
  v_existing_event_count integer;
  v_changed_lines integer := 0;
  v_replaced_ledger_rows integer := 0;
  v_inserted_ledger_rows integer := 0;
  v_inserted_events integer := 0;
  v_deleted_recipes integer := 0;
begin
  if p_migration_key <> 'HONG_TO_LUC_2026-06-29_V1' then
    raise exception 'Unsupported migration key';
  end if;
  if p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'p_source_hash must be a lowercase SHA-256';
  end if;
  if p_snapshot_id is null or p_snapshot_id !~ '^recovery-[0-9]{8}T[0-9]{9}Z$' then
    raise exception 'p_snapshot_id is invalid';
  end if;
  if p_manifest_sha256 is null or p_manifest_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'p_manifest_sha256 must be a lowercase SHA-256';
  end if;
  if p_write_set is null or jsonb_typeof(p_write_set) <> 'object' then
    raise exception 'p_write_set must be a JSON object';
  end if;
  if
    jsonb_typeof(p_write_set->'orders') <> 'array'
    or jsonb_typeof(p_write_set->'lineUpdates') <> 'array'
    or jsonb_typeof(p_write_set->'ledgerBefore') <> 'array'
    or jsonb_typeof(p_write_set->'ledgerAfter') <> 'array'
    or jsonb_typeof(p_write_set->'eventsBefore') <> 'array'
    or jsonb_typeof(p_write_set->'events') <> 'array'
    or jsonb_typeof(p_write_set->'corruptRecipe') <> 'object'
  then
    raise exception 'p_write_set has invalid collections';
  end if;

  v_expected_order_count := jsonb_array_length(p_write_set->'orders');
  if v_expected_order_count <> 4 then
    raise exception 'Expected order count mismatch';
  end if;
  if jsonb_array_length(p_write_set->'lineUpdates') <> 4 then
    raise exception 'Expected line count mismatch';
  end if;
  if jsonb_array_length(p_write_set->'ledgerBefore') <> 29 then
    raise exception 'Expected source ledger count mismatch';
  end if;
  if jsonb_array_length(p_write_set->'events') <> 4 then
    raise exception 'Expected migration event count mismatch';
  end if;
  if p_write_set->'corruptRecipe'->>'id' <> 'REC-068' then
    raise exception 'Expected corrupt recipe REC-068';
  end if;

  select array_agg(value->>'id' order by value->>'id')
  into v_order_ids
  from jsonb_array_elements(p_write_set->'orders');
  select array_agg(value->>'order_no' order by value->>'order_no')
  into v_order_numbers
  from jsonb_array_elements(p_write_set->'orders');
  if v_order_numbers <> array[
    'UCK000364',
    'UCK000369',
    'UCK000384',
    'UCK000391'
  ]::text[] then
    raise exception 'Expected order numbers mismatch';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('data-migration:' || p_migration_key)
  );

  select *
  into v_existing
  from public.data_migration_runs
  where migration_key = p_migration_key
  for update;

  select count(*)
  into v_existing_event_count
  from public.order_events
  where
    order_id = any(v_order_ids)
    and event_type = 'MIGRATED'
    and delta_json->>'migration_key' = p_migration_key;

  if v_existing.migration_key is not null then
    if
      v_existing.source_hash <> p_source_hash
      or v_existing.snapshot_id <> p_snapshot_id
      or v_existing.manifest_sha256 <> p_manifest_sha256
      or v_existing.write_set <> p_write_set
    then
      raise exception 'Source fingerprint mismatch for existing migration run';
    end if;
    if v_existing_event_count <> 4 then
      raise exception 'Partial migration state: migration event count mismatch';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_write_set->'events') expected
      left join public.order_events event
        on event.id = expected->>'id'
      where
        event.id is null
        or event.order_id <> expected->>'order_id'
        or event.event_type <> 'MIGRATED'
        or event.delta_json->>'migration_key' <> p_migration_key
        or event.delta_json->>'source_hash' <> p_source_hash
    ) then
      raise exception 'Partial migration state: migration event fingerprint mismatch';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_write_set->'lineUpdates') change
      left join public.order_lines_v2 line
        on line.id = change->>'lineId'
      where
        line.id is null
        or line.product_id <> change->'after'->>'product_id'
        or line.variant_id <> change->'after'->>'variant_id'
        or line.product_snapshot_json <> change->'after'->'product_snapshot_json'
        or line.variant_snapshot_json <> change->'after'->'variant_snapshot_json'
        or line.recipe_snapshot_json <> change->'after'->'recipe_snapshot_json'
        or line.cost_at_sale <> (change->'after'->>'cost_at_sale')::bigint
    ) then
      raise exception 'Partial migration state: migrated line mismatch';
    end if;
    if exists (select 1 from public.recipes where id = 'REC-068') then
      raise exception 'Partial migration state: corrupt recipe still exists';
    end if;
    if (
      select count(*)
      from public.stock_ledger
      where reference_id = any(v_order_ids)
        and transaction_type = 'SALES_CONSUME'
    ) <> jsonb_array_length(p_write_set->'ledgerAfter') then
      raise exception 'Partial migration state: target ledger count mismatch';
    end if;
    if exists (
      with expected_rows as (
        select
          expected->>'transaction_type' as transaction_type,
          expected->>'reference_id' as reference_id,
          expected->>'item_reference' as item_reference,
          round((expected->>'quantity_change')::numeric, 6) as quantity_change,
          coalesce(expected->>'source', '') as source
        from jsonb_array_elements(p_write_set->'ledgerAfter') expected
      ),
      actual_rows as (
        select
          ledger.transaction_type,
          ledger.reference_id,
          ledger.item_reference,
          ledger.quantity_change,
          coalesce(ledger.source, '') as source
        from public.stock_ledger ledger
        where
          ledger.reference_id = any(v_order_ids)
          and ledger.transaction_type = 'SALES_CONSUME'
      )
      (
        select * from expected_rows
        except all
        select * from actual_rows
      )
      union all
      (
        select * from actual_rows
        except all
        select * from expected_rows
      )
    ) then
      raise exception 'Partial migration state: target ledger fingerprint mismatch';
    end if;
    return jsonb_build_object(
      'migration_key', p_migration_key,
      'already_applied', true,
      'changed_lines', 0,
      'replaced_ledger_rows', 0,
      'inserted_ledger_rows', 0,
      'inserted_events', 0,
      'deleted_recipes', 0
    );
  end if;

  if
    v_existing_event_count > 0
    or not exists (select 1 from public.recipes where id = 'REC-068')
    or exists (
      select 1
      from jsonb_array_elements(p_write_set->'lineUpdates') change
      join public.order_lines_v2 line on line.id = change->>'lineId'
      where
        line.product_id = change->'after'->>'product_id'
        or line.variant_id = change->'after'->>'variant_id'
    )
    or exists (
      select 1
      from jsonb_array_elements(p_write_set->'ledgerAfter') expected
      join public.stock_ledger ledger on ledger.id = expected->>'id'
    )
  then
    raise exception 'Partial migration state detected';
  end if;

  if (
    select count(*)
    from public.orders_v2
    where id = any(v_order_ids)
  ) <> v_expected_order_count then
    raise exception 'Expected order count mismatch';
  end if;

  for v_order in
    select value from jsonb_array_elements(p_write_set->'orders')
  loop
    select jsonb_build_object(
      'id', id,
      'order_no', order_no,
      'status', status,
      'superseded_by', coalesce(superseded_by, ''),
      'created_at', created_at,
      'version', version
    )
    into v_actual
    from public.orders_v2
    where id = v_order->>'id'
    for update;
    if not found then
      raise exception 'Source fingerprint mismatch: order % missing', v_order->>'id';
    end if;
    if v_actual->>'status' <> 'COMPLETED' then
      raise exception 'Source fingerprint mismatch: order is not completed';
    end if;
    if coalesce(v_actual->>'superseded_by', '') <> '' then
      raise exception 'Affected order is superseded';
    end if;
    if
      v_actual->>'order_no' <> v_order->>'order_no'
      or (v_actual->>'created_at')::timestamptz <>
        (v_order->>'created_at')::timestamptz
      or (v_actual->>'version')::integer <> (v_order->>'version')::integer
    then
      raise exception 'Source fingerprint mismatch for order %', v_order->>'id';
    end if;
  end loop;

  for v_line_update in
    select value from jsonb_array_elements(p_write_set->'lineUpdates')
  loop
    v_before := v_line_update->'before';
    v_after := v_line_update->'after';
    select to_jsonb(line)
    into v_actual
    from public.order_lines_v2 line
    where line.id = v_line_update->>'lineId'
    for update;
    if not found then
      raise exception 'Source fingerprint mismatch: line % missing',
        v_line_update->>'lineId';
    end if;
    if
      v_actual->>'order_id' <> v_before->>'order_id'
      or (v_actual->>'line_no')::integer <> (v_before->>'line_no')::integer
      or v_actual->>'product_id' <> v_before->>'product_id'
      or v_actual->'product_snapshot_json' <> v_before->'product_snapshot_json'
      or v_actual->>'variant_id' <> v_before->>'variant_id'
      or v_actual->'variant_snapshot_json' <> v_before->'variant_snapshot_json'
      or (v_actual->>'qty')::integer <> (v_before->>'qty')::integer
      or (v_actual->>'unit_price')::bigint <> (v_before->>'unit_price')::bigint
      or v_actual->'modifiers_snapshot_json' <> v_before->'modifiers_snapshot_json'
      or (v_actual->>'gross_line_total')::bigint <>
        (v_before->>'gross_line_total')::bigint
      or (v_actual->>'promo_discount')::bigint <>
        (v_before->>'promo_discount')::bigint
      or (v_actual->>'manual_item_discount')::bigint <>
        (v_before->>'manual_item_discount')::bigint
      or (v_actual->>'order_discount_allocation')::bigint <>
        (v_before->>'order_discount_allocation')::bigint
      or (v_actual->>'net_line_total')::bigint <>
        (v_before->>'net_line_total')::bigint
      or (v_actual->>'cost_at_sale')::bigint <>
        (v_before->>'cost_at_sale')::bigint
      or v_actual->'recipe_snapshot_json' <> v_before->'recipe_snapshot_json'
      or coalesce(v_actual->>'promo_discount_reason', '') <>
        coalesce(v_before->>'promo_discount_reason', '')
      or coalesce(v_actual->>'manual_discount_reason', '') <>
        coalesce(v_before->>'manual_discount_reason', '')
    then
      raise exception 'Source fingerprint mismatch for line %',
        v_line_update->>'lineId';
    end if;
  end loop;

  if (
    select count(*)
    from public.stock_ledger
    where reference_id = any(v_order_ids)
      and transaction_type = 'SALES_CONSUME'
  ) <> jsonb_array_length(p_write_set->'ledgerBefore') then
    raise exception 'Ledger fingerprint mismatch: row count changed';
  end if;
  for v_ledger in
    select value from jsonb_array_elements(p_write_set->'ledgerBefore')
  loop
    perform 1
    from public.stock_ledger ledger
    where
      ledger.id = v_ledger->>'id'
      and ledger.transaction_type = v_ledger->>'transaction_type'
      and coalesce(ledger.reference_id, '') = coalesce(v_ledger->>'reference_id', '')
      and ledger.item_reference = v_ledger->>'item_reference'
      and ledger.quantity_change = (v_ledger->>'quantity_change')::numeric
      and ledger.unit_cost = (v_ledger->>'unit_cost')::numeric
      and ledger.created_at = (v_ledger->>'created_at')::timestamptz
      and coalesce(ledger.order_event_id, '') =
        coalesce(v_ledger->>'order_event_id', '')
      and ledger.cost_at_sale = (v_ledger->>'cost_at_sale')::numeric
      and coalesce(ledger.source, '') = coalesce(v_ledger->>'source', '')
      and coalesce(ledger.notes, '') = coalesce(v_ledger->>'notes', '')
    for update;
    if not found then
      raise exception 'Ledger fingerprint mismatch for row %', v_ledger->>'id';
    end if;
  end loop;

  v_recipe := p_write_set->'corruptRecipe';
  select to_jsonb(recipe)
  into v_actual
  from public.recipes recipe
  where recipe.id = v_recipe->>'id'
  for update;
  if not found then
    raise exception 'Recipe fingerprint mismatch: REC-068 missing';
  end if;
  if
    v_actual->>'target_type' <> v_recipe->>'target_type'
    or v_actual->>'target_id' <> v_recipe->>'target_id'
    or v_actual->'ingredients_json' <> v_recipe->'ingredients_json'
    or nullif(v_actual->>'start_date', '')::timestamptz is distinct from
      nullif(v_recipe->>'start_date', '')::timestamptz
    or nullif(v_actual->>'end_date', '')::timestamptz is distinct from
      nullif(v_recipe->>'end_date', '')::timestamptz
    or v_actual->>'status' <> v_recipe->>'status'
    or nullif(v_actual->>'created_at', '')::timestamptz is distinct from
      nullif(v_recipe->>'created_at', '')::timestamptz
    or nullif(v_actual->>'updated_at', '')::timestamptz is distinct from
      nullif(v_recipe->>'updated_at', '')::timestamptz
  then
    raise exception 'Recipe fingerprint mismatch';
  end if;

  if (
    select count(*)
    from public.order_events
    where order_id = any(v_order_ids)
  ) <> jsonb_array_length(p_write_set->'eventsBefore') then
    raise exception 'Source fingerprint mismatch: order event count changed';
  end if;
  for v_event in
    select value from jsonb_array_elements(p_write_set->'eventsBefore')
  loop
    perform 1
    from public.order_events event
    where
      event.id = v_event->>'id'
      and event.order_id = v_event->>'order_id'
      and event.event_type = v_event->>'event_type'
      and event.event_at = (v_event->>'event_at')::timestamptz
      and coalesce(event.actor_id, '') = coalesce(v_event->>'actor_id', '')
      and coalesce(event.actor_name, '') = coalesce(v_event->>'actor_name', '')
      and event.from_version is not distinct from
        nullif(v_event->>'from_version', '')::integer
      and event.to_version = (v_event->>'to_version')::integer
      and coalesce(event.previous_order_id, '') =
        coalesce(v_event->>'previous_order_id', '')
      and event.delta_json = v_event->'delta_json'
      and coalesce(event.reason, '') = coalesce(v_event->>'reason', '')
    for update;
    if not found then
      raise exception 'Source fingerprint mismatch for order event %',
        v_event->>'id';
    end if;
  end loop;

  insert into public.data_migration_runs (
    migration_key,
    source_hash,
    snapshot_id,
    manifest_sha256,
    before_image,
    write_set
  )
  values (
    p_migration_key,
    p_source_hash,
    p_snapshot_id,
    p_manifest_sha256,
    jsonb_build_object(
      'orders', p_write_set->'orders',
      'lines', (
        select jsonb_agg(value->'before')
        from jsonb_array_elements(p_write_set->'lineUpdates')
      ),
      'ledger', p_write_set->'ledgerBefore',
      'events', p_write_set->'eventsBefore',
      'recipe', p_write_set->'corruptRecipe'
    ),
    p_write_set
  );

  for v_line_update in
    select value from jsonb_array_elements(p_write_set->'lineUpdates')
  loop
    v_after := v_line_update->'after';
    update public.order_lines_v2
    set
      product_id = v_after->>'product_id',
      product_snapshot_json = v_after->'product_snapshot_json',
      variant_id = v_after->>'variant_id',
      variant_snapshot_json = v_after->'variant_snapshot_json',
      cost_at_sale = (v_after->>'cost_at_sale')::bigint,
      recipe_snapshot_json = v_after->'recipe_snapshot_json'
    where id = v_line_update->>'lineId';
    v_changed_lines := v_changed_lines + 1;
  end loop;

  delete from public.stock_ledger
  where
    reference_id = any(v_order_ids)
    and transaction_type = 'SALES_CONSUME';
  get diagnostics v_replaced_ledger_rows = row_count;
  if v_replaced_ledger_rows <> jsonb_array_length(p_write_set->'ledgerBefore') then
    raise exception 'Ledger delete count mismatch';
  end if;

  insert into public.stock_ledger (
    id,
    transaction_type,
    reference_id,
    item_reference,
    quantity_change,
    unit_cost,
    created_at,
    order_event_id,
    cost_at_sale,
    source,
    notes
  )
  select
    row.id,
    row.transaction_type,
    row.reference_id,
    row.item_reference,
    row.quantity_change,
    row.unit_cost,
    row.created_at,
    row.order_event_id,
    row.cost_at_sale,
    row.source,
    row.notes
  from jsonb_to_recordset(p_write_set->'ledgerAfter') as row(
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
  get diagnostics v_inserted_ledger_rows = row_count;
  if v_inserted_ledger_rows <> jsonb_array_length(p_write_set->'ledgerAfter') then
    raise exception 'Ledger insert count mismatch';
  end if;

  insert into public.order_events (
    id,
    order_id,
    event_type,
    event_at,
    actor_id,
    actor_name,
    from_version,
    to_version,
    previous_order_id,
    delta_json,
    reason
  )
  select
    row.id,
    row.order_id,
    row.event_type,
    row.event_at,
    row.actor_id,
    row.actor_name,
    row.from_version,
    row.to_version,
    row.previous_order_id,
    row.delta_json,
    row.reason
  from jsonb_to_recordset(p_write_set->'events') as row(
    id text,
    order_id text,
    event_type text,
    event_at timestamptz,
    actor_id text,
    actor_name text,
    from_version integer,
    to_version integer,
    previous_order_id text,
    delta_json jsonb,
    reason text
  );
  get diagnostics v_inserted_events = row_count;
  if v_inserted_events <> 4 then
    raise exception 'Migration event insert count mismatch';
  end if;

  delete from public.recipes
  where id = 'REC-068';
  get diagnostics v_deleted_recipes = row_count;
  if v_deleted_recipes <> 1 then
    raise exception 'Recipe delete count mismatch';
  end if;

  return jsonb_build_object(
    'migration_key', p_migration_key,
    'already_applied', false,
    'changed_lines', v_changed_lines,
    'replaced_ledger_rows', v_replaced_ledger_rows,
    'inserted_ledger_rows', v_inserted_ledger_rows,
    'inserted_events', v_inserted_events,
    'deleted_recipes', v_deleted_recipes
  );
end;
$$;

revoke all on function public.apply_hong_to_luc_migration(
  text,
  text,
  text,
  text,
  jsonb
) from public;
revoke all on function public.apply_hong_to_luc_migration(
  text,
  text,
  text,
  text,
  jsonb
) from anon;
revoke all on function public.apply_hong_to_luc_migration(
  text,
  text,
  text,
  text,
  jsonb
) from authenticated;
grant execute on function public.apply_hong_to_luc_migration(
  text,
  text,
  text,
  text,
  jsonb
) to service_role;
