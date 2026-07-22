-- Closes a real vulnerability found 2026-07-22 (see
-- docs/audits/2026-07-22-lock-bypass-forensic-audit.md): both
-- apply_backdated_event_recovery (0015/0026) and
-- apply_backdated_recipe_event_recovery (0029) unconditionally set
-- app.mac_drift_recovery='on' before writing, bypassing the
-- prevent_audit_locked_order_line_mutation trigger (migration 0012) with no
-- validation against audit_baseline_locks at all -- unlike
-- apply_mac_drift_recovery, which requires an exact pre-registered lock
-- match before it will touch a line. This let two separate correction
-- passes (2026-07-20/21 and 2026-07-22) silently overwrite 223 lines that
-- had already been reviewed and locked, undetected until an explicit
-- forensic audit. Both RPCs are also reachable from the daily
-- app/api/cron/apply-backdated-corrections sweep with no human in the loop,
-- so this is a live, unattended repeat waiting to happen the moment
-- CRON_SECRET is set.
--
-- Fix: reject any change whose line_id has an existing audit_baseline_locks
-- row, for both RPCs. A locked line can still be corrected, but only
-- through apply_mac_drift_recovery's stricter, exact-match-required path
-- (or a deliberate, reviewed override of the lock itself) -- never through
-- either of these two RPCs. No other behavior changes; both function bodies
-- are otherwise identical to their prior definitions (0026 and 0029).

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
  v_old_cost bigint;
  v_new_cost bigint;
  v_actual_order_id text;
  v_actual_cost bigint;
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
        and line.cost_at_sale <> (change_log.new_value #>> '{}')::bigint
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
    v_old_cost := nullif(v_change->>'old_cost_at_sale', '')::bigint;
    v_new_cost := nullif(v_change->>'new_cost_at_sale', '')::bigint;

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
  v_old_cost bigint;
  v_new_cost bigint;
  v_actual_order_id text;
  v_actual_cost bigint;
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
        and line.cost_at_sale <> (change_log.new_value #>> '{}')::bigint
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
    v_old_cost := nullif(v_change->>'old_cost_at_sale', '')::bigint;
    v_new_cost := nullif(v_change->>'new_cost_at_sale', '')::bigint;

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
