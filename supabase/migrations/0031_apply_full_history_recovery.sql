-- Phase 4 of the owner-approved full-history rebuild plan
-- (C:\Users\Admin\.claude\plans\toasty-mapping-hollerith.md). Applies
-- Category A (unlocked) cost_at_sale corrections found by
-- scripts/audit-full-history-recompute.ts. Modeled directly on
-- apply_mac_drift_recovery (0012/0016)'s safe shape (idempotent
-- data_recovery_changes run-id reuse guard, advisory locks, dry-run
-- parameter) but does NOT require a pre-registered audit_baseline_locks
-- match, since these lines are specifically the ones with no lock at all.
--
-- Never reuses apply_backdated_event_recovery's unconditional-bypass
-- pattern (the vulnerability behind the COGS-5 incident, closed in
-- migration 0030). Instead: an explicit
-- `and not exists (select 1 from audit_baseline_locks ...)` guard on every
-- single line before it is touched, so this RPC is structurally incapable
-- of writing to a locked line even under a future bug in the caller --
-- not merely relying on the prevent_audit_locked_order_line_mutation
-- trigger a second time.

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
  v_old_cost bigint;
  v_new_cost bigint;
  v_actual_order_id text;
  v_actual_cost bigint;
  v_existing_count integer;
  v_change_count integer;
  v_total_delta bigint := 0;
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
        and line.cost_at_sale <> (change_log.new_value #>> '{}')::bigint
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
    v_old_cost := nullif(v_change->>'old_cost_at_sale', '')::bigint;
    v_new_cost := nullif(v_change->>'new_cost_at_sale', '')::bigint;

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
