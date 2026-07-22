-- Owner decision 2026-07-22: stop preserving per-cohort historical cost
-- decisions as permanently locked: apply the single from-scratch
-- ground-truth engine (lib/full-history-recompute.ts) uniformly, including
-- to the 287 lines currently protected by audit_baseline_locks.
--
-- audit_baseline_locks previously only had select+insert granted (no way
-- to remove a lock at all, by design, since removing protection was never
-- meant to happen casually). Adds a narrow, audited RPC for this instead
-- of a blanket DELETE grant: removing a lock requires a reviewer and a
-- reason, and the removal itself is logged to data_recovery_changes for
-- the same durable audit trail every other correction in this project
-- uses -- so "we no longer want this lock" is itself a recorded, provable
-- decision, not a silent deletion.

create or replace function public.remove_audit_baseline_lock(
  p_order_line_id text,
  p_reviewer text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_lock public.audit_baseline_locks%rowtype;
begin
  if p_order_line_id is null or btrim(p_order_line_id) = '' then
    raise exception 'p_order_line_id is required';
  end if;
  if p_reviewer is null or btrim(p_reviewer) = '' then
    raise exception 'p_reviewer is required';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'p_reason is required';
  end if;

  select * into v_lock
  from public.audit_baseline_locks
  where order_line_id = p_order_line_id
  for update;

  if not found then
    raise exception 'No audit_baseline_locks row for order line %', p_order_line_id;
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
    'lock-removal-' || p_order_line_id,
    'audit_baseline_locks',
    p_order_line_id,
    'removed',
    to_jsonb(v_lock),
    to_jsonb(p_reason),
    encode(digest(p_reason, 'sha256'), 'hex')
  );

  delete from public.audit_baseline_locks
  where order_line_id = p_order_line_id;

  return jsonb_build_object(
    'order_line_id', p_order_line_id,
    'removed', true,
    'previous_lock', to_jsonb(v_lock)
  );
end;
$$;

revoke all on function public.remove_audit_baseline_lock(text, text, text) from public;
revoke all on function public.remove_audit_baseline_lock(text, text, text) from anon;
revoke all on function public.remove_audit_baseline_lock(text, text, text) from authenticated;
grant execute on function public.remove_audit_baseline_lock(text, text, text) to service_role;
