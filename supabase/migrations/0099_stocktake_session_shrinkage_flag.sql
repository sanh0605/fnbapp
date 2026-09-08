-- docs/superpowers/plans/2026-09-08-tach-gia-von-va-hao-hut.md, implementing
-- BR-COGS-007 (docs/02-rules/business-rules/cogs.md). Owner decision
-- 2026-09-08: which stocktake counts are shrinkage is a fact about history,
-- carried as data on the session row -- "an if (id === 'STK-001') in
-- TypeScript would be the same fact in the one place nobody can correct it."
--
-- Trigger check first, per fnbapp-bulk-data-change, re-verified live against
-- production immediately before writing this migration:
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--    where tgrelid = 'public.stocktake_sessions'::regclass and not tgisinternal;
-- Exactly one: trg_stocktake_sessions_touch, BEFORE UPDATE, calls
-- touch_updated_at(). No queue, no other automation. The backfill below
-- updates exactly 1 row and will bump that row's updated_at -- declared
-- here as the one side effect, not a risk.
--
-- Writer inventory (skill step 6): the two INSERTs into stocktake_sessions
-- (0036_stocktake_sessions.sql, 0052_stock_issues.sql -- both the same
-- open_stocktake_session_atomic function, redefined once) both name columns
-- explicitly and do not list is_shrinkage, so every future session gets the
-- column default (true) automatically. Nothing breaks.

-- 1. The flag. Default true: every session created from today forward counts
-- as shrinkage unless the owner is told otherwise about a specific one --
-- there is no screen to set it, by design (plan's Cross-impacts).
alter table public.stocktake_sessions
  add column is_shrinkage boolean not null default true;

-- 2. Backfill the one historical exception. STK-001 (2026-08-09) is four
-- months of unrecorded consumption surfacing at once, not a period loss --
-- BR-COGS-007's precondition -- so it stays in Giá vốn permanently and never
-- moves to Hao hụt. STK-002 was cancelled and produced zero stock_issues
-- rows, so leaving it at the true default is moot either way; not touched.
do $$
declare
  v_updated integer;
begin
  update public.stocktake_sessions
  set is_shrinkage = false
  where id = 'STK-001';
  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception
      'expected exactly 1 row updated backfilling STK-001.is_shrinkage, got %; STK-001 may no longer exist or the id has changed',
      v_updated;
  end if;

  raise notice 'STK-001.is_shrinkage set to false (% row updated)', v_updated;
end;
$$;
