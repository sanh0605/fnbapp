-- Owner decision 2026-07-30 (docs/superpowers/plans/2026-07-30-exact-cost-
-- precision.md): stop rounding computed COGS. order_lines_v2.cost_at_sale
-- was bigint (0001_init_schema.sql:262) -- widened here to numeric(18,6),
-- matching the precision stock_ledger.quantity_change and
-- stock_ledger.unit_cost have used since 0004_add_stock_ledger_columns.sql.
--
-- Widening is lossless: every existing whole-number value survives
-- unchanged under the numeric(18,6) cast. The cost engine's Math.round
-- calls are removed in a later step (Task 3) -- this migration only makes
-- room for the unrounded value; it does not itself change what gets
-- written.

alter table public.order_lines_v2
  alter column cost_at_sale type numeric(18,6)
  using cost_at_sale::numeric(18,6);

-- ============================================================================
-- Step 4: redefine every RPC that casts order_lines_v2.cost_at_sale (or a
-- variable holding it) to ::bigint. Left behind, the widened column would
-- silently accept a decimal from the caller and each of these functions
-- would truncate it back to a whole number on write -- worse than today,
-- because today's rounding is at least visible in the code.
--
-- Full sweep reported to and approved by the owner before any of this was
-- written (grep for "bigint" across every migration, cost_at_sale hits
-- classified live/dead/out-of-scope). Seven functions redefined here, each
-- at its current (latest, not superseded) definition, logic otherwise
-- unchanged:
--   1. apply_hong_to_luc_migration        (was 0011)
--   2. supersede_order_v2_atomic, 6-arg   (was 0020 -- NOT superseded: the
--      7-arg overload added in 0035 is a thin payment-validating wrapper
--      that calls this exact 6-arg function internally; both overloads
--      coexist under Postgres function overloading, so the 0020 body is
--      still live, not dead history)
--   3. apply_mac_drift_recovery           (was 0016)
--   4. apply_backdated_event_recovery     (was 0030, first definition)
--   5. apply_backdated_recipe_event_recovery (was 0030, second definition)
--   6. apply_full_history_recovery        (was 0031)
--   7. rebuild_stock_ledger_for_order     (was 0042)
--
-- Deliberately NOT included: create_pos_order_atomic /
-- create_pos_order_atomic_unvalidated_0024 (the live POS checkout path).
-- Owner split these out to their own migration with a dedicated payment-flow
-- test, an off-hours deploy window, and a real test sale immediately after,
-- since this database function takes effect the instant the migration is
-- pushed -- there is no web-deploy step in between to catch a mistake before
-- the next sale.
--
-- Also NOT included (found during the sweep, confirmed out of scope):
--   - save_product_atomic (0044): v_old_price/v_new_price bigint is the
--     product/variant PRICE, not cost_at_sale. Prices stay whole VND.
--   - flag_backdated_ledger_entry() (0014): unit_cost bigint belongs to
--     backdated_ledger_events, a different table's own column, not
--     order_lines_v2.cost_at_sale or stock_ledger.cost_at_sale.
--   - Purchase-order RPCs (0006, 0041): subtotal_amount, shipping_fee, etc
--     are invoice amounts, explicitly out of scope.
--   - get_pos_inventory_state (0008): no cost_at_sale or bigint reference.
--
-- Also confirmed clean, no change needed: void_order_atomic (0017) only
-- ever writes stock_ledger.cost_at_sale, whose recordset column is already
-- declared `numeric` (not bigint), and never touches order_lines_v2.

-- audit_baseline_locks (0 rows, confirmed before writing this) stores a
-- point-in-time snapshot of cost_at_sale for the lock-match check inside
-- apply_mac_drift_recovery below. Left as bigint, any future lock would
-- itself become a silent-truncation source the moment cost_at_sale carries
-- a decimal. Widening now while the table is empty is lossless.
alter table public.audit_baseline_locks
  alter column stored_cost_at_sale type numeric(18,6),
  alter column expected_cost_at_sale type numeric(18,6),
  alter column delta_vnd type numeric(18,6);

-- ---------------------------------------------------------------------------
-- 1. apply_hong_to_luc_migration (was 0011_hong_to_luc_idempotency_precision_fix.sql)
-- ---------------------------------------------------------------------------

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
        or line.cost_at_sale <> (change->'after'->>'cost_at_sale')::numeric(18,6)
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
      or (v_actual->>'cost_at_sale')::numeric(18,6) <>
        (v_before->>'cost_at_sale')::numeric(18,6)
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
      cost_at_sale = (v_after->>'cost_at_sale')::numeric(18,6),
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

-- ---------------------------------------------------------------------------
-- 2. supersede_order_v2_atomic, 6-arg overload (was 0020_atomic_supersede_order.sql)
-- ---------------------------------------------------------------------------

create or replace function public.supersede_order_v2_atomic(
  p_old_order_id text,
  p_expected_old_version integer,
  p_new_order jsonb,
  p_new_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_ledger jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
  v_old_version integer;
  v_new_order_id text;
  v_event_id text;
  v_line_count integer := 0;
  v_ledger_count integer := 0;
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
  if p_ledger is null or jsonb_typeof(p_ledger) <> 'array' then
    raise exception 'p_ledger must be a JSON array';
  end if;

  select status, version
  into v_old_status, v_old_version
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

  if exists (
    select 1
    from jsonb_array_elements(p_ledger) as entry
    where nullif(btrim(entry->>'id'), '') is null
       or entry->>'order_event_id' is distinct from v_event_id
       or (
         entry->>'transaction_type' = 'EDIT_REVERSAL'
         and (
           entry->>'reference_id' is distinct from p_old_order_id
           or coalesce(nullif(entry->>'quantity_change', '')::numeric, 0) <= 0
         )
       )
       or (
         entry->>'transaction_type' = 'SALES_CONSUME'
         and (
           entry->>'reference_id' is distinct from v_new_order_id
           or coalesce(nullif(entry->>'quantity_change', '')::numeric, 0) >= 0
         )
       )
       or coalesce(entry->>'transaction_type', '') not in ('EDIT_REVERSAL', 'SALES_CONSUME')
  ) then
    raise exception 'p_ledger contains an invalid edit movement';
  end if;

  update public.orders_v2
  set
    status = 'SUPERSEDED',
    superseded_by = v_new_order_id,
    updated_at = now()
  where id = p_old_order_id;

  insert into public.orders_v2 (
    id, order_no, brand_id, status, version, parent_order_id, superseded_by,
    created_at, created_by_id, created_by_name, completed_at, voided_at,
    voided_by_id, void_reason, currency, gross_total, promo_discount_total,
    manual_item_discount_total, manual_order_discount, net_total,
    applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json,
    payment_method, payment_ref, migration_notes
  ) values (
    v_new_order_id,
    p_new_order->>'order_no',
    p_new_order->>'brand_id',
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

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change,
    unit_cost, created_at, order_event_id, cost_at_sale, source, notes
  )
  select
    row.id,
    row.transaction_type,
    row.reference_id,
    row.item_reference,
    row.quantity_change,
    coalesce(row.unit_cost, 0),
    row.created_at,
    v_event_id,
    coalesce(row.cost_at_sale, 0),
    coalesce(row.source, ''),
    coalesce(row.notes, '')
  from jsonb_to_recordset(p_ledger) as row(
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
  if v_ledger_count <> jsonb_array_length(p_ledger) then
    raise exception 'Ledger count mismatch';
  end if;

  return jsonb_build_object(
    'new_order_id', v_new_order_id,
    'line_count', v_line_count,
    'ledger_count', v_ledger_count
  );
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

-- ---------------------------------------------------------------------------
-- 3. apply_mac_drift_recovery (was 0016_harden_mac_drift_baseline_locks.sql)
-- ---------------------------------------------------------------------------

create or replace function public.apply_mac_drift_recovery(
  p_run_id text,
  p_source_hash text,
  p_changes jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change jsonb;
  v_line_id text;
  v_order_id text;
  v_old_cost numeric(18,6);
  v_new_cost numeric(18,6);
  v_actual_order_id text;
  v_actual_cost numeric(18,6);
  v_existing_count integer;
  v_change_count integer;
  v_total_delta numeric(18,6) := 0;
  v_preview jsonb := '[]'::jsonb;
begin
  if p_run_id is null or btrim(p_run_id) = '' then
    raise exception 'p_run_id is required';
  end if;
  if p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'p_source_hash must be a lowercase SHA-256';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'p_changes must be a JSON array';
  end if;
  if jsonb_array_length(p_changes) = 0 then
    raise exception 'p_changes must not be empty';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_changes) as change(value)
    group by value->>'line_id'
    having count(*) > 1
  ) then
    raise exception 'p_changes contains duplicate line IDs';
  end if;

  perform set_config('lock_timeout', '5s', true);
  perform pg_advisory_xact_lock(hashtext('mac-drift-recovery:' || p_run_id));
  v_change_count := jsonb_array_length(p_changes);

  select count(*)
  into v_existing_count
  from public.data_recovery_changes
  where run_id = p_run_id;

  if v_existing_count > 0 then
    if v_existing_count <> v_change_count then
      raise exception 'MAC drift recovery run % exists with a different change count', p_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      where change_log.run_id = p_run_id
        and (
          change_log.source_hash <> p_source_hash
          or change_log.table_name <> 'order_lines_v2'
          or change_log.column_name <> 'cost_at_sale'
          or change_log.rolled_back_at is not null
        )
    ) then
      raise exception 'MAC drift recovery run % cannot be reused', p_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      join public.order_lines_v2 line
        on line.id = change_log.row_id
      where change_log.run_id = p_run_id
        and line.cost_at_sale <> (change_log.new_value #>> '{}')::numeric(18,6)
    ) then
      raise exception 'MAC drift recovery run % no longer matches current order line values', p_run_id;
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_changes) as requested(value)
      left join public.data_recovery_changes change_log
        on change_log.run_id = p_run_id
       and change_log.row_id = requested.value->>'line_id'
      where change_log.row_id is null
        or (change_log.old_value #>> '{}')::numeric(18,6)
          <> (requested.value->>'old_cost_at_sale')::numeric(18,6)
        or (change_log.new_value #>> '{}')::numeric(18,6)
          <> (requested.value->>'new_cost_at_sale')::numeric(18,6)
    ) then
      raise exception 'MAC drift recovery run % does not match the requested changes', p_run_id;
    end if;
    return jsonb_build_object(
      'run_id', p_run_id,
      'change_count', 0,
      'already_applied', true,
      'dry_run', p_dry_run,
      'preview', '[]'::jsonb
    );
  end if;

  if not p_dry_run then
    perform set_config('app.mac_drift_recovery', 'on', true);
  end if;

  for v_change in
    select value
    from jsonb_array_elements(p_changes)
    order by value->>'line_id'
  loop
    v_line_id := nullif(btrim(v_change->>'line_id'), '');
    v_order_id := nullif(btrim(v_change->>'order_id'), '');
    v_old_cost := nullif(v_change->>'old_cost_at_sale', '')::numeric(18,6);
    v_new_cost := nullif(v_change->>'new_cost_at_sale', '')::numeric(18,6);

    if v_line_id is null or v_order_id is null or v_old_cost is null or v_new_cost is null then
      raise exception 'MAC drift recovery change is missing required fields';
    end if;

    perform pg_advisory_xact_lock(hashtext('mac-drift-line:' || v_line_id));

    if not exists (
      select 1
      from public.audit_baseline_locks lock
      where lock.order_line_id = v_line_id
        and lock.source_hash = p_source_hash
        and lock.stored_cost_at_sale = v_old_cost
        and lock.expected_cost_at_sale = v_new_cost
        and lock.delta_vnd = v_new_cost - v_old_cost
    ) then
      raise exception 'Order line % does not have a matching audit-baseline lock', v_line_id;
    end if;

    select order_id, cost_at_sale
    into v_actual_order_id, v_actual_cost
    from public.order_lines_v2
    where id = v_line_id
    for update;

    if not found then
      raise exception 'Order line % was not found', v_line_id;
    end if;
    if v_actual_order_id <> v_order_id or v_actual_cost <> v_old_cost then
      raise exception 'Order line % changed after planning', v_line_id;
    end if;

    v_total_delta := v_total_delta + (v_new_cost - v_old_cost);
    v_preview := v_preview || jsonb_build_array(jsonb_build_object(
      'line_id', v_line_id,
      'order_id', v_order_id,
      'current_stored', v_actual_cost,
      'expected_stored', v_new_cost,
      'delta_vnd', v_new_cost - v_old_cost
    ));

    if p_dry_run then
      continue;
    end if;

    insert into public.data_recovery_changes (
      run_id,
      table_name,
      row_id,
      column_name,
      old_value,
      new_value,
      source_hash
    )
    values (
      p_run_id,
      'order_lines_v2',
      v_line_id,
      'cost_at_sale',
      to_jsonb(v_actual_cost),
      to_jsonb(v_new_cost),
      p_source_hash
    );

    update public.order_lines_v2
    set cost_at_sale = v_new_cost
    where id = v_line_id;
  end loop;

  if p_dry_run then
    return jsonb_build_object(
      'run_id', p_run_id,
      'change_count', v_change_count,
      'total_delta_vnd', v_total_delta,
      'already_applied', false,
      'dry_run', true,
      'preview', v_preview
    );
  end if;

  return jsonb_build_object(
    'run_id', p_run_id,
    'change_count', v_change_count,
    'total_delta_vnd', v_total_delta,
    'already_applied', false,
    'dry_run', false,
    'preview', v_preview
  );
end;
$$;

revoke all on function public.apply_mac_drift_recovery(text, text, jsonb, boolean) from public;
revoke all on function public.apply_mac_drift_recovery(text, text, jsonb, boolean) from anon;
revoke all on function public.apply_mac_drift_recovery(text, text, jsonb, boolean) from authenticated;
grant execute on function public.apply_mac_drift_recovery(text, text, jsonb, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 4+5. apply_backdated_event_recovery and apply_backdated_recipe_event_recovery
-- (was 0030_harden_backdated_event_recovery_against_locks.sql)
-- ---------------------------------------------------------------------------

create or replace function public.apply_backdated_event_recovery(
  p_event_id uuid,
  p_reviewer text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.backdated_ledger_events%rowtype;
  v_change jsonb;
  v_line_id text;
  v_order_id text;
  v_old_cost numeric(18,6);
  v_new_cost numeric(18,6);
  v_actual_order_id text;
  v_actual_cost numeric(18,6);
  v_run_id text;
  v_source_hash text;
  v_existing_count integer;
  v_change_count integer;
begin
  if p_event_id is null then
    raise exception 'p_event_id required';
  end if;
  if p_reviewer is null or btrim(p_reviewer) = '' then
    raise exception 'p_reviewer required';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'p_changes must be a JSON array';
  end if;

  v_run_id := 'backdated-' || p_event_id::text;
  v_source_hash := encode(digest(p_changes::text, 'sha256'), 'hex');
  v_change_count := jsonb_array_length(p_changes);

  perform pg_advisory_xact_lock(hashtext('backdated-event-recovery:' || p_event_id::text));

  select * into v_event
  from public.backdated_ledger_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event % not found', p_event_id;
  end if;

  if v_event.status = 'REJECTED' then
    raise exception 'Event % is rejected, cannot recompute', p_event_id;
  end if;

  select count(*)
  into v_existing_count
  from public.data_recovery_changes
  where run_id = v_run_id;

  if v_existing_count > 0 or v_event.status = 'RECOMPUTED' then
    if v_existing_count <> v_change_count then
      raise exception 'Backdated event recovery run % exists with a different change count', v_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      where change_log.run_id = v_run_id
        and (
          change_log.table_name <> 'order_lines_v2'
          or change_log.column_name <> 'cost_at_sale'
          or change_log.rolled_back_at is not null
        )
    ) then
      raise exception 'Backdated event recovery run % cannot be reused', v_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      join public.order_lines_v2 line
        on line.id = change_log.row_id
      where change_log.run_id = v_run_id
        and line.cost_at_sale <> (change_log.new_value #>> '{}')::numeric(18,6)
    ) then
      raise exception 'Backdated event recovery run % no longer matches current order line values', v_run_id;
    end if;
    return jsonb_build_object(
      'event_id', p_event_id,
      'run_id', v_run_id,
      'change_count', 0,
      'already_applied', true
    );
  end if;

  if v_event.status not in ('PENDING', 'APPROVED') then
    raise exception 'Event % is in status %, cannot recompute', p_event_id, v_event.status;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_changes) as change(value)
    join public.audit_baseline_locks lock
      on lock.order_line_id = change.value->>'line_id'
  ) then
    raise exception 'One or more order lines in this backdated event are audit-baseline locked; use apply_mac_drift_recovery with an explicit lock match instead of apply_backdated_event_recovery';
  end if;

  perform set_config('app.mac_drift_recovery', 'on', true);

  for v_change in
    select value from jsonb_array_elements(p_changes)
  loop
    v_line_id := nullif(btrim(v_change->>'line_id'), '');
    v_order_id := nullif(btrim(v_change->>'order_id'), '');
    v_old_cost := nullif(v_change->>'old_cost_at_sale', '')::numeric(18,6);
    v_new_cost := nullif(v_change->>'new_cost_at_sale', '')::numeric(18,6);

    if v_line_id is null or v_order_id is null or v_old_cost is null or v_new_cost is null then
      raise exception 'Backdated event recovery change is missing required fields';
    end if;

    select order_id, cost_at_sale
    into v_actual_order_id, v_actual_cost
    from public.order_lines_v2
    where id = v_line_id
    for update;

    if not found then
      raise exception 'Order line % was not found', v_line_id;
    end if;
    if v_actual_order_id <> v_order_id or v_actual_cost <> v_old_cost then
      raise exception 'Order line % changed after planning', v_line_id;
    end if;

    insert into public.data_recovery_changes (
      run_id,
      table_name,
      row_id,
      column_name,
      old_value,
      new_value,
      source_hash
    )
    values (
      v_run_id,
      'order_lines_v2',
      v_line_id,
      'cost_at_sale',
      to_jsonb(v_actual_cost),
      to_jsonb(v_new_cost),
      v_source_hash
    );

    update public.order_lines_v2
    set cost_at_sale = v_new_cost
    where id = v_line_id;
  end loop;

  return jsonb_build_object(
    'event_id', p_event_id,
    'run_id', v_run_id,
    'change_count', v_change_count,
    'already_applied', false
  );
end;
$$;

create or replace function public.apply_backdated_recipe_event_recovery(
  p_event_id uuid,
  p_reviewer text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.backdated_recipe_events%rowtype;
  v_change jsonb;
  v_line_id text;
  v_order_id text;
  v_old_cost numeric(18,6);
  v_new_cost numeric(18,6);
  v_actual_order_id text;
  v_actual_cost numeric(18,6);
  v_run_id text;
  v_source_hash text;
  v_existing_count integer;
  v_change_count integer;
begin
  if p_event_id is null then
    raise exception 'p_event_id required';
  end if;
  if p_reviewer is null or btrim(p_reviewer) = '' then
    raise exception 'p_reviewer required';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'p_changes must be a JSON array';
  end if;

  v_run_id := 'backdated-recipe-' || p_event_id::text;
  v_source_hash := encode(digest(p_changes::text, 'sha256'), 'hex');
  v_change_count := jsonb_array_length(p_changes);

  perform pg_advisory_xact_lock(hashtext('backdated-recipe-event-recovery:' || p_event_id::text));

  select * into v_event
  from public.backdated_recipe_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event % not found', p_event_id;
  end if;

  if v_event.status = 'REJECTED' then
    raise exception 'Event % is rejected, cannot recompute', p_event_id;
  end if;

  select count(*)
  into v_existing_count
  from public.data_recovery_changes
  where run_id = v_run_id;

  if v_existing_count > 0 or v_event.status = 'RECOMPUTED' then
    if v_existing_count <> v_change_count then
      raise exception 'Backdated recipe event recovery run % exists with a different change count', v_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      where change_log.run_id = v_run_id
        and (
          change_log.table_name <> 'order_lines_v2'
          or change_log.column_name <> 'cost_at_sale'
          or change_log.rolled_back_at is not null
        )
    ) then
      raise exception 'Backdated recipe event recovery run % cannot be reused', v_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      join public.order_lines_v2 line
        on line.id = change_log.row_id
      where change_log.run_id = v_run_id
        and line.cost_at_sale <> (change_log.new_value #>> '{}')::numeric(18,6)
    ) then
      raise exception 'Backdated recipe event recovery run % no longer matches current order line values', v_run_id;
    end if;
    return jsonb_build_object(
      'event_id', p_event_id,
      'run_id', v_run_id,
      'change_count', 0,
      'already_applied', true
    );
  end if;

  if v_event.status <> 'PENDING' then
    raise exception 'Event % is in status %, cannot recompute', p_event_id, v_event.status;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_changes) as change(value)
    join public.audit_baseline_locks lock
      on lock.order_line_id = change.value->>'line_id'
  ) then
    raise exception 'One or more order lines in this backdated recipe event are audit-baseline locked; use apply_mac_drift_recovery with an explicit lock match instead of apply_backdated_recipe_event_recovery';
  end if;

  perform set_config('app.mac_drift_recovery', 'on', true);

  for v_change in
    select value from jsonb_array_elements(p_changes)
  loop
    v_line_id := nullif(btrim(v_change->>'line_id'), '');
    v_order_id := nullif(btrim(v_change->>'order_id'), '');
    v_old_cost := nullif(v_change->>'old_cost_at_sale', '')::numeric(18,6);
    v_new_cost := nullif(v_change->>'new_cost_at_sale', '')::numeric(18,6);

    if v_line_id is null or v_order_id is null or v_old_cost is null or v_new_cost is null then
      raise exception 'Backdated recipe event recovery change is missing required fields';
    end if;

    select order_id, cost_at_sale
    into v_actual_order_id, v_actual_cost
    from public.order_lines_v2
    where id = v_line_id
    for update;

    if not found then
      raise exception 'Order line % was not found', v_line_id;
    end if;
    if v_actual_order_id <> v_order_id or v_actual_cost <> v_old_cost then
      raise exception 'Order line % changed after planning', v_line_id;
    end if;

    insert into public.data_recovery_changes (
      run_id,
      table_name,
      row_id,
      column_name,
      old_value,
      new_value,
      source_hash
    )
    values (
      v_run_id,
      'order_lines_v2',
      v_line_id,
      'cost_at_sale',
      to_jsonb(v_actual_cost),
      to_jsonb(v_new_cost),
      v_source_hash
    );

    update public.order_lines_v2
    set cost_at_sale = v_new_cost
    where id = v_line_id;
  end loop;

  return jsonb_build_object(
    'event_id', p_event_id,
    'run_id', v_run_id,
    'change_count', v_change_count,
    'already_applied', false
  );
end;
$$;

revoke all on function public.apply_backdated_event_recovery(uuid, text, jsonb) from public;
revoke all on function public.apply_backdated_event_recovery(uuid, text, jsonb) from anon;
revoke all on function public.apply_backdated_event_recovery(uuid, text, jsonb) from authenticated;
grant execute on function public.apply_backdated_event_recovery(uuid, text, jsonb) to service_role;

revoke all on function public.apply_backdated_recipe_event_recovery(uuid, text, jsonb) from public;
revoke all on function public.apply_backdated_recipe_event_recovery(uuid, text, jsonb) from anon;
revoke all on function public.apply_backdated_recipe_event_recovery(uuid, text, jsonb) from authenticated;
grant execute on function public.apply_backdated_recipe_event_recovery(uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 6. apply_full_history_recovery (was 0031_apply_full_history_recovery.sql)
-- ---------------------------------------------------------------------------

create or replace function public.apply_full_history_recovery(
  p_run_id text,
  p_source_hash text,
  p_changes jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_change jsonb;
  v_line_id text;
  v_order_id text;
  v_old_cost numeric(18,6);
  v_new_cost numeric(18,6);
  v_actual_order_id text;
  v_actual_cost numeric(18,6);
  v_existing_count integer;
  v_change_count integer;
  v_total_delta numeric(18,6) := 0;
  v_preview jsonb := '[]'::jsonb;
begin
  if p_run_id is null or btrim(p_run_id) = '' then
    raise exception 'p_run_id is required';
  end if;
  if p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'p_source_hash must be a lowercase SHA-256';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'p_changes must be a JSON array';
  end if;
  if jsonb_array_length(p_changes) = 0 then
    raise exception 'p_changes must not be empty';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_changes) as change(value)
    group by value->>'line_id'
    having count(*) > 1
  ) then
    raise exception 'p_changes contains duplicate line IDs';
  end if;

  perform set_config('lock_timeout', '5s', true);
  perform pg_advisory_xact_lock(hashtext('full-history-recovery:' || p_run_id));
  v_change_count := jsonb_array_length(p_changes);

  if exists (
    select 1
    from jsonb_array_elements(p_changes) as change(value)
    join public.audit_baseline_locks lock
      on lock.order_line_id = change.value->>'line_id'
  ) then
    raise exception 'One or more order lines in this batch are audit-baseline locked; apply_full_history_recovery only handles unlocked lines -- use apply_mac_drift_recovery with an explicit lock match for locked lines instead';
  end if;

  select count(*)
  into v_existing_count
  from public.data_recovery_changes
  where run_id = p_run_id;

  if v_existing_count > 0 then
    if v_existing_count <> v_change_count then
      raise exception 'Full-history recovery run % exists with a different change count', p_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      where change_log.run_id = p_run_id
        and (
          change_log.source_hash <> p_source_hash
          or change_log.table_name <> 'order_lines_v2'
          or change_log.column_name <> 'cost_at_sale'
          or change_log.rolled_back_at is not null
        )
    ) then
      raise exception 'Full-history recovery run % cannot be reused', p_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      join public.order_lines_v2 line
        on line.id = change_log.row_id
      where change_log.run_id = p_run_id
        and line.cost_at_sale <> (change_log.new_value #>> '{}')::numeric(18,6)
    ) then
      raise exception 'Full-history recovery run % no longer matches current order line values', p_run_id;
    end if;
    return jsonb_build_object(
      'run_id', p_run_id,
      'change_count', 0,
      'already_applied', true,
      'dry_run', p_dry_run,
      'preview', '[]'::jsonb
    );
  end if;

  for v_change in
    select value
    from jsonb_array_elements(p_changes)
    order by value->>'line_id'
  loop
    v_line_id := nullif(btrim(v_change->>'line_id'), '');
    v_order_id := nullif(btrim(v_change->>'order_id'), '');
    v_old_cost := nullif(v_change->>'old_cost_at_sale', '')::numeric(18,6);
    v_new_cost := nullif(v_change->>'new_cost_at_sale', '')::numeric(18,6);

    if v_line_id is null or v_order_id is null or v_old_cost is null or v_new_cost is null then
      raise exception 'Full-history recovery change is missing required fields';
    end if;

    perform pg_advisory_xact_lock(hashtext('full-history-recovery-line:' || v_line_id));

    if exists (
      select 1 from public.audit_baseline_locks lock
      where lock.order_line_id = v_line_id
    ) then
      raise exception 'Order line % is audit-baseline locked; apply_full_history_recovery only handles unlocked lines', v_line_id;
    end if;

    select order_id, cost_at_sale
    into v_actual_order_id, v_actual_cost
    from public.order_lines_v2
    where id = v_line_id
    for update;

    if not found then
      raise exception 'Order line % was not found', v_line_id;
    end if;
    if v_actual_order_id <> v_order_id or v_actual_cost <> v_old_cost then
      raise exception 'Order line % changed after planning', v_line_id;
    end if;

    v_total_delta := v_total_delta + (v_new_cost - v_old_cost);
    v_preview := v_preview || jsonb_build_array(jsonb_build_object(
      'line_id', v_line_id,
      'order_id', v_order_id,
      'current_stored', v_actual_cost,
      'expected_stored', v_new_cost,
      'delta_vnd', v_new_cost - v_old_cost
    ));

    if p_dry_run then
      continue;
    end if;

    insert into public.data_recovery_changes (
      run_id,
      table_name,
      row_id,
      column_name,
      old_value,
      new_value,
      source_hash
    )
    values (
      p_run_id,
      'order_lines_v2',
      v_line_id,
      'cost_at_sale',
      to_jsonb(v_actual_cost),
      to_jsonb(v_new_cost),
      p_source_hash
    );

    update public.order_lines_v2
    set cost_at_sale = v_new_cost
    where id = v_line_id;
  end loop;

  if p_dry_run then
    return jsonb_build_object(
      'run_id', p_run_id,
      'change_count', v_change_count,
      'total_delta_vnd', v_total_delta,
      'already_applied', false,
      'dry_run', true,
      'preview', v_preview
    );
  end if;

  return jsonb_build_object(
    'run_id', p_run_id,
    'change_count', v_change_count,
    'total_delta_vnd', v_total_delta,
    'already_applied', false,
    'dry_run', false,
    'preview', v_preview
  );
end;
$$;

revoke all on function public.apply_full_history_recovery(text, text, jsonb, boolean) from public;
revoke all on function public.apply_full_history_recovery(text, text, jsonb, boolean) from anon;
revoke all on function public.apply_full_history_recovery(text, text, jsonb, boolean) from authenticated;
grant execute on function public.apply_full_history_recovery(text, text, jsonb, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 7. rebuild_stock_ledger_for_order (was 0042_suppress_backdated_detection_during_rebuild.sql)
-- ---------------------------------------------------------------------------

create or replace function public.rebuild_stock_ledger_for_order(
  p_run_id text,
  p_order_id text,
  p_source_hash text,
  p_expected_delete_count integer,
  p_insert_rows jsonb,
  p_cost_changes jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_derived_types text[] := array['SALES_CONSUME','PRODUCTION_CONSUME','PRODUCTION_YIELD','RECLASSIFICATION_REVERSAL','EDIT_REVERSAL','EDIT_CONSUME'];
  v_existing_derived_count integer;
  v_existing_run_count integer;
  v_deleted_count integer := 0;
  v_inserted_count integer := 0;
  v_seq integer := 0;
  v_row jsonb;
  v_new_id text;
  v_line_id text;
  v_old_cost numeric(18,6);
  v_new_cost numeric(18,6);
  v_actual_cost numeric(18,6);
  v_cost_change_count integer;
begin
  if p_run_id is null or btrim(p_run_id) = '' then
    raise exception 'p_run_id is required';
  end if;
  if p_order_id is null or btrim(p_order_id) = '' then
    raise exception 'p_order_id is required';
  end if;
  if p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'p_source_hash must be a lowercase SHA-256';
  end if;
  if p_expected_delete_count is null or p_expected_delete_count < 0 then
    raise exception 'p_expected_delete_count must be a non-negative integer';
  end if;
  if p_insert_rows is null or jsonb_typeof(p_insert_rows) <> 'array' then
    raise exception 'p_insert_rows must be a JSON array';
  end if;
  if p_cost_changes is null or jsonb_typeof(p_cost_changes) <> 'array' then
    raise exception 'p_cost_changes must be a JSON array';
  end if;

  perform set_config('lock_timeout', '5s', true);
  -- Replay writes historical created_at values on purpose. Without this, the
  -- detect_backdated_ledger_entry trigger records a backdated event for every
  -- PRODUCTION_YIELD row the rebuild inserts, and the nightly
  -- apply-backdated-corrections cron then auto-applies cost changes that this
  -- phase deliberately defers to Phase 5. Transaction-scoped (is_local = true).
  perform set_config('app.mac_drift_recovery', 'on', true);
  perform pg_advisory_xact_lock(hashtext('rebuild-stock-ledger:' || p_order_id));

  select count(*) into v_existing_run_count
  from public.data_recovery_changes
  where run_id = p_run_id;

  if v_existing_run_count > 0 then
    if exists (
      select 1 from public.data_recovery_changes
      where run_id = p_run_id and source_hash <> p_source_hash
    ) then
      raise exception 'Rebuild run % exists with a different source hash', p_run_id;
    end if;
    return jsonb_build_object(
      'run_id', p_run_id, 'order_id', p_order_id,
      'already_applied', true, 'dry_run', p_dry_run,
      'deleted', 0, 'inserted', 0, 'cost_changes', 0
    );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_cost_changes) as change(value)
    join public.audit_baseline_locks lock
      on lock.order_line_id = change.value->>'line_id'
  ) then
    raise exception 'One or more order lines for order % are audit-baseline locked; rebuild_stock_ledger_for_order refuses to touch locked lines', p_order_id;
  end if;

  select count(*) into v_existing_derived_count
  from public.stock_ledger
  where reference_id = p_order_id
    and transaction_type = any(v_derived_types);

  if v_existing_derived_count <> p_expected_delete_count then
    raise exception 'Order % has % derived Stock_Ledger rows now but the plan expected exactly % -- data changed since planning, aborting', p_order_id, v_existing_derived_count, p_expected_delete_count;
  end if;

  v_cost_change_count := jsonb_array_length(p_cost_changes);

  if p_dry_run then
    return jsonb_build_object(
      'run_id', p_run_id, 'order_id', p_order_id,
      'already_applied', false, 'dry_run', true,
      'deleted', v_existing_derived_count, 'inserted', jsonb_array_length(p_insert_rows),
      'cost_changes', v_cost_change_count
    );
  end if;

  for v_row in
    delete from public.stock_ledger
    where reference_id = p_order_id
      and transaction_type = any(v_derived_types)
    returning to_jsonb(stock_ledger.*)
  loop
    insert into public.data_recovery_changes (run_id, table_name, row_id, column_name, old_value, new_value, source_hash)
    values (p_run_id, 'stock_ledger', v_row->>'id', 'deleted', v_row, 'null'::jsonb, p_source_hash);
    v_deleted_count := v_deleted_count + 1;
  end loop;

  if v_deleted_count <> p_expected_delete_count then
    raise exception 'Order % deleted % rows but expected % -- aborting transaction', p_order_id, v_deleted_count, p_expected_delete_count;
  end if;

  for v_row in select value from jsonb_array_elements(p_insert_rows)
  loop
    v_new_id := 'FULLHISTORY_REBUILD-' || p_order_id || '-' || v_seq;
    v_seq := v_seq + 1;

    insert into public.stock_ledger (id, item_reference, transaction_type, quantity_change, unit_cost, reference_id, source, created_at)
    values (
      v_new_id,
      v_row->>'item_reference',
      v_row->>'transaction_type',
      (v_row->>'quantity_change')::numeric,
      (v_row->>'unit_cost')::numeric,
      p_order_id,
      'FULLHISTORY_REBUILD_2026-07-24',
      (v_row->>'created_at')::timestamptz
    );

    insert into public.data_recovery_changes (run_id, table_name, row_id, column_name, old_value, new_value, source_hash)
    values (p_run_id, 'stock_ledger', v_new_id, 'inserted', 'null'::jsonb, v_row || jsonb_build_object('id', v_new_id), p_source_hash);

    v_inserted_count := v_inserted_count + 1;
  end loop;

  for v_row in select value from jsonb_array_elements(p_cost_changes)
  loop
    v_line_id := nullif(btrim(v_row->>'line_id'), '');
    v_old_cost := nullif(v_row->>'old_cost_at_sale', '')::numeric(18,6);
    v_new_cost := nullif(v_row->>'new_cost_at_sale', '')::numeric(18,6);

    if v_line_id is null or v_old_cost is null or v_new_cost is null then
      raise exception 'Cost change entry missing required fields for order %', p_order_id;
    end if;

    select cost_at_sale into v_actual_cost
    from public.order_lines_v2
    where id = v_line_id and order_id = p_order_id
    for update;

    if not found then
      raise exception 'Order line % not found for order %', v_line_id, p_order_id;
    end if;
    if v_actual_cost <> v_old_cost then
      raise exception 'Order line % cost_at_sale changed since planning (expected %, found %)', v_line_id, v_old_cost, v_actual_cost;
    end if;

    insert into public.data_recovery_changes (run_id, table_name, row_id, column_name, old_value, new_value, source_hash)
    values (p_run_id, 'order_lines_v2', v_line_id, 'cost_at_sale', to_jsonb(v_actual_cost), to_jsonb(v_new_cost), p_source_hash);

    update public.order_lines_v2
    set cost_at_sale = v_new_cost
    where id = v_line_id;
  end loop;

  return jsonb_build_object(
    'run_id', p_run_id, 'order_id', p_order_id,
    'already_applied', false, 'dry_run', false,
    'deleted', v_deleted_count, 'inserted', v_inserted_count, 'cost_changes', v_cost_change_count
  );
end;
$$;

revoke all on function public.rebuild_stock_ledger_for_order(text, text, text, integer, jsonb, jsonb, boolean) from public;
revoke all on function public.rebuild_stock_ledger_for_order(text, text, text, integer, jsonb, jsonb, boolean) from anon;
revoke all on function public.rebuild_stock_ledger_for_order(text, text, text, integer, jsonb, jsonb, boolean) from authenticated;
grant execute on function public.rebuild_stock_ledger_for_order(text, text, text, integer, jsonb, jsonb, boolean) to service_role;
