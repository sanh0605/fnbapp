-- Reversible field-level recovery for historical purchase receipt costs.

create table if not exists public.data_recovery_changes (
  run_id text not null,
  table_name text not null,
  row_id text not null,
  column_name text not null,
  old_value jsonb not null,
  new_value jsonb not null,
  source_hash text not null,
  applied_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  primary key (run_id, table_name, row_id, column_name)
);

alter table public.data_recovery_changes enable row level security;
revoke all on table public.data_recovery_changes from public;
revoke all on table public.data_recovery_changes from anon;
revoke all on table public.data_recovery_changes from authenticated;
grant select, insert, update on table public.data_recovery_changes to service_role;

create or replace function public.apply_purchase_cost_recovery(
  p_run_id text,
  p_source_hash text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change jsonb;
  v_ledger_id text;
  v_po_id text;
  v_item_reference text;
  v_quantity numeric;
  v_old_unit_cost numeric;
  v_new_unit_cost numeric;
  v_actual_po_id text;
  v_actual_item_reference text;
  v_actual_quantity numeric;
  v_actual_unit_cost numeric;
  v_existing_count integer;
  v_change_count integer;
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

  perform pg_advisory_xact_lock(hashtext('purchase-cost-recovery:' || p_run_id));
  v_change_count := jsonb_array_length(p_changes);

  select count(*)
  into v_existing_count
  from public.data_recovery_changes
  where run_id = p_run_id;

  if v_existing_count > 0 then
    if v_existing_count <> v_change_count then
      raise exception 'Recovery run % exists with a different change count', p_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes
      where run_id = p_run_id
        and (
          source_hash <> p_source_hash
          or rolled_back_at is not null
        )
    ) then
      raise exception 'Recovery run % cannot be reused', p_run_id;
    end if;
    if exists (
      select 1
      from public.data_recovery_changes change_log
      join public.stock_ledger ledger
        on ledger.id = change_log.row_id
      where change_log.run_id = p_run_id
        and ledger.unit_cost <> (change_log.new_value #>> '{}')::numeric
    ) then
      raise exception 'Recovery run % no longer matches current ledger values', p_run_id;
    end if;
    return jsonb_build_object(
      'run_id', p_run_id,
      'change_count', 0,
      'already_applied', true
    );
  end if;

  for v_change in
    select value from jsonb_array_elements(p_changes)
  loop
    v_ledger_id := nullif(btrim(v_change->>'ledger_id'), '');
    v_po_id := nullif(btrim(v_change->>'po_id'), '');
    v_item_reference := nullif(btrim(v_change->>'item_reference'), '');
    v_quantity := nullif(v_change->>'quantity_change', '')::numeric;
    v_old_unit_cost := nullif(v_change->>'old_unit_cost', '')::numeric;
    v_new_unit_cost := nullif(v_change->>'new_unit_cost', '')::numeric;
    if
      v_ledger_id is null
      or v_po_id is null
      or v_item_reference is null
      or v_quantity is null
      or v_old_unit_cost is null
      or v_new_unit_cost is null
    then
      raise exception 'Recovery change is missing required fields';
    end if;

    select
      reference_id,
      item_reference,
      quantity_change,
      unit_cost
    into
      v_actual_po_id,
      v_actual_item_reference,
      v_actual_quantity,
      v_actual_unit_cost
    from public.stock_ledger
    where id = v_ledger_id
      and transaction_type = 'PO_RECEIPT'
    for update;

    if not found then
      raise exception 'PO receipt ledger row % was not found', v_ledger_id;
    end if;
    if
      v_actual_po_id <> v_po_id
      or v_actual_item_reference <> v_item_reference
      or v_actual_quantity <> v_quantity
      or v_actual_unit_cost <> v_old_unit_cost
    then
      raise exception 'PO receipt ledger row % changed after planning', v_ledger_id;
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
      'stock_ledger',
      v_ledger_id,
      'unit_cost',
      to_jsonb(v_actual_unit_cost),
      to_jsonb(v_new_unit_cost),
      p_source_hash
    );

    update public.stock_ledger
    set unit_cost = v_new_unit_cost
    where id = v_ledger_id;
  end loop;

  return jsonb_build_object(
    'run_id', p_run_id,
    'change_count', v_change_count,
    'already_applied', false
  );
end;
$$;

create or replace function public.rollback_purchase_cost_recovery(
  p_run_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.data_recovery_changes%rowtype;
  v_actual_unit_cost numeric;
  v_total_count integer;
  v_rollback_count integer := 0;
begin
  if p_run_id is null or btrim(p_run_id) = '' then
    raise exception 'p_run_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('purchase-cost-recovery:' || p_run_id));
  select count(*)
  into v_total_count
  from public.data_recovery_changes
  where run_id = p_run_id;
  if v_total_count = 0 then
    raise exception 'Recovery run % was not found', p_run_id;
  end if;

  for v_log in
    select *
    from public.data_recovery_changes
    where run_id = p_run_id
      and rolled_back_at is null
    order by row_id
    for update
  loop
    if v_log.table_name <> 'stock_ledger' or v_log.column_name <> 'unit_cost' then
      raise exception 'Unsupported recovery log target for row %', v_log.row_id;
    end if;
    select unit_cost
    into v_actual_unit_cost
    from public.stock_ledger
    where id = v_log.row_id
    for update;
    if not found then
      raise exception 'Ledger row % was not found during rollback', v_log.row_id;
    end if;
    if v_actual_unit_cost <> (v_log.new_value #>> '{}')::numeric then
      raise exception 'Ledger row % changed after recovery', v_log.row_id;
    end if;

    update public.stock_ledger
    set unit_cost = (v_log.old_value #>> '{}')::numeric
    where id = v_log.row_id;

    update public.data_recovery_changes
    set rolled_back_at = now()
    where
      run_id = v_log.run_id
      and table_name = v_log.table_name
      and row_id = v_log.row_id
      and column_name = v_log.column_name;
    v_rollback_count := v_rollback_count + 1;
  end loop;

  return jsonb_build_object(
    'run_id', p_run_id,
    'change_count', v_rollback_count,
    'already_rolled_back', v_rollback_count = 0
  );
end;
$$;

revoke all on function public.apply_purchase_cost_recovery(
  text,
  text,
  jsonb
) from public;
revoke all on function public.apply_purchase_cost_recovery(
  text,
  text,
  jsonb
) from anon;
revoke all on function public.apply_purchase_cost_recovery(
  text,
  text,
  jsonb
) from authenticated;
grant execute on function public.apply_purchase_cost_recovery(
  text,
  text,
  jsonb
) to service_role;

revoke all on function public.rollback_purchase_cost_recovery(text) from public;
revoke all on function public.rollback_purchase_cost_recovery(text) from anon;
revoke all on function public.rollback_purchase_cost_recovery(text) from authenticated;
grant execute on function public.rollback_purchase_cost_recovery(text) to service_role;
