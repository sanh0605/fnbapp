-- Owner-approved 2026-07-30: data_recovery_changes is a growing append-only
-- audit/idempotency log written by the recovery RPCs (apply_full_history_
-- recovery, apply_backdated_recipe_event_recovery, rebuild_stock_ledger_
-- for_order, etc). Uncontrolled growth (74,836 rows / 48.23 MB by 2026-07-30,
-- 43% of it from a single already-closed correction run on 2026-07-23) is
-- what pushed the daily Google Drive backup bundle over Apps Script's 50 MB
-- UrlFetchApp response limit. A one-time manual prune (docs/audits/
-- 2026-07-30-data-recovery-changes-prune.json) brought it back under 45 MB;
-- this migration is the standing rule so it does not silently recur.
--
-- Fires once per INSERT statement, not once per row -- a single rebuild can
-- insert thousands of rows in one transaction (Phase 4 alone inserted over
-- 20,000 today), and pruning once per statement is enough since the delete
-- itself is a set operation, not per-row work.
--
-- No pg_cron dependency: this project has never confirmed pg_cron is
-- enabled (0003_sync_state.sql's cron.schedule is documented as a manual,
-- optional dashboard step, never actually applied). Tying retention to
-- writes on the table itself needs no external scheduler and self-throttles:
-- if nothing is being written, the table is not growing, so there is
-- nothing urgent to prune.

create index if not exists data_recovery_changes_applied_at_idx
  on public.data_recovery_changes (applied_at);

create or replace function public.prune_data_recovery_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.data_recovery_changes
  where applied_at < now() - interval '30 days';
  return null;
end;
$$;

revoke all on function public.prune_data_recovery_changes() from public;
revoke all on function public.prune_data_recovery_changes() from anon;
revoke all on function public.prune_data_recovery_changes() from authenticated;

drop trigger if exists prune_data_recovery_changes_trigger
  on public.data_recovery_changes;

create trigger prune_data_recovery_changes_trigger
after insert on public.data_recovery_changes
for each statement
execute function public.prune_data_recovery_changes();
