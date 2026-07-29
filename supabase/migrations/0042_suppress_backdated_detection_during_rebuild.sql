-- Phase 4 stock rebuild (docs/superpowers/plans/2026-07-29-phase4-stock-rebuild.md,
-- Task 1). rebuild_stock_ledger_for_order (migration 0034) inserts PRODUCTION_YIELD
-- rows carrying historical created_at values for every order in history. Without
-- suppression, detect_backdated_ledger_entry (migration 0014) records a
-- backdated_ledger_events row for each one, and the nightly
-- apply-backdated-corrections cron (0 20 * * * UTC) auto-applies any plan it
-- does not classify as anomalous -- silently rewriting cost_at_sale overnight,
-- unreviewed, even though this phase deliberately defers cost changes to
-- Phase 5. The other recovery RPCs (migration 0030) already set
-- app.mac_drift_recovery='on' for exactly this reason; this migration closes
-- the same gap in rebuild_stock_ledger_for_order. No other behavior changes.

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
  v_old_cost bigint;
  v_new_cost bigint;
  v_actual_cost bigint;
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
    v_old_cost := nullif(v_row->>'old_cost_at_sale', '')::bigint;
    v_new_cost := nullif(v_row->>'new_cost_at_sale', '')::bigint;

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
