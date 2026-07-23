-- Giai doan 2 of the owner-approved full-rebuild plan
-- (C:\Users\Admin\.claude\plans\toasty-mapping-hollerith.md, revised
-- 2026-07-24 scope). lib/full-history-recompute.ts had a double-counting
-- bug (fixed in the same plan's Giai doan 0): it trusted PRODUCTION_CONSUME/
-- PRODUCTION_YIELD rows in Stock_Ledger as ground truth, but this business
-- has never logged a genuine independent production order (CLAUDE.md
-- section 9) -- every such row was itself the engine's own reconstruction
-- of implicit production for a specific sale, so trusting it *and*
-- re-deriving it counted the same event twice.
--
-- Three prior correction rounds (2026-07-20, 07-21, 07-22) ran on top of
-- this buggy engine and left behind their own compensating/reversal rows,
-- which are now entangled with the genuine rows they were patching --
-- confirmed by direct inspection: for the 1,518 orders any correction round
-- ever touched, 2,977 (order, item) pairs have a genuine row and a
-- correction-script row that are fragments of the SAME event, not
-- independent facts. Deleting only the correction-script rows and leaving
-- the genuine fragment in place would silently revert those orders to the
-- original bug.
--
-- Per CLAUDE.md section 9 (owner-confirmed 2026-07-22): only recipes, sales
-- orders, and purchase orders are ground truth. Every Stock_Ledger row of
-- type SALES_CONSUME / PRODUCTION_CONSUME / PRODUCTION_YIELD /
-- RECLASSIFICATION_REVERSAL / EDIT_REVERSAL / EDIT_CONSUME -- genuine or
-- correction-script-inserted alike -- is derived, never source-of-truth.
-- So for the 1,518 affected orders, this RPC deletes ALL of an order's
-- derived rows (not just the correction-script ones) and replaces them
-- with a single fresh computation from the fixed engine. Orders no
-- correction round ever touched (144 of them) are never passed to this RPC
-- at all -- their genuine rows stay completely untouched, matching the
-- owner's explicit instruction to never disturb data that was never
-- Claude's to begin with.
--
-- Orders_V2, Order_Lines_V2 (except cost_at_sale, updated here to match the
-- corrected consumption), Purchase_Orders, and Recipes are never written by
-- this function -- only PO_RECEIPT/STOCK_ADJUST-adjacent Stock_Ledger rows
-- (never touched here either) and the derived-type rows above.
--
-- Modeled on apply_full_history_recovery (migration 0031): idempotent via
-- data_recovery_changes run-id reuse guard, advisory lock, dry-run
-- parameter, structural audit_baseline_locks refusal (checked before any
-- write, not merely relying on the prevent_audit_locked_order_line_mutation
-- trigger a second time). One run_id per order, matching the existing
-- per-order granularity in apply-full-history-cost-correction.ts, so a
-- failure on one order never blocks or half-applies another.

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
