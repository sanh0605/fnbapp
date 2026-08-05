-- Plan C Task 6: retire the backdated-correction machinery and the MAC-drift
-- baseline-lock system that policed per-line cost_at_sale.
-- Plan: docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md
--
-- Reordered ahead of Task 4 on 2026-08-05. Once Task 4 resets cost_at_sale to
-- 0, lib/backdated-ledger/anomaly-threshold.ts's per-line ratio check
-- (`if (change.old_cost_at_sale === 0) continue;`) stops rejecting anything,
-- which arms this machinery to silently rewrite exactly what Task 4 clears
-- the next time the cron sweeps -- so it retires first.
--
-- Confirmed before dropping: the cron has never run against production.
-- CRON_SECRET was never set in Vercel (docs/OPEN-ITEMS.md item 19), and no row
-- in either queue table has ever carried reviewed_by = 'system-auto' (the
-- literal actor string app/api/cron/apply-backdated-corrections/route.ts
-- uses) -- every one of the 522 non-PENDING rows was reviewed by a human
-- ("Claude"), none by the sweep. Measured 2026-08-05: 1.391 PENDING
-- backdated_ledger_events + 132 PENDING backdated_recipe_events = 1.523, up
-- from the 1.522 recorded 2026-08-02 (item 19) by exactly one new organic
-- detection -- consistent with zero drainage, not partial processing.
--
-- Does NOT touch trg_stock_ledger_inventory_balances
-- (0038_materialize_inventory_balances.sql) -- that trigger is not correction
-- machinery, it keeps inventory_balances correct while Task 5 deletes ledger
-- rows, and retiring it here would leave every balance stale.

-- ============================================================
-- Detection triggers that fed the queue
-- ============================================================

drop trigger if exists detect_backdated_ledger_entry on public.stock_ledger;
drop function if exists public.flag_backdated_ledger_entry();

drop trigger if exists detect_backdated_recipe_entry on public.recipes;
drop function if exists public.flag_backdated_recipe_entry();

-- ============================================================
-- MAC-drift baseline lock -- also policed per-line cost, retiring for the
-- same reason: nothing is left to protect once cost_at_sale is reset
-- everywhere (Task 4) and the ledger rows it locked are deleted (Task 5).
-- ============================================================

drop trigger if exists prevent_audit_locked_order_line_mutation on public.order_lines_v2;
drop function if exists public.prevent_audit_locked_order_line_mutation();
drop function if exists public.apply_mac_drift_recovery(text, text, jsonb, boolean);

-- ============================================================
-- Recompute / reject / recovery RPCs. Each is called only from the machinery
-- retiring here (lib/backdated-ledger/**, lib/backdated-recipe-events/**,
-- app/admin/audit/backdated-ledger/**, app/api/cron/apply-backdated-corrections) --
-- confirmed 2026-08-05, no other caller.
-- ============================================================

drop function if exists public.mark_backdated_event_recomputed(uuid, text, text, integer);
drop function if exists public.mark_backdated_recipe_event_recomputed(uuid, text, text, integer);
drop function if exists public.apply_backdated_event_recovery(uuid, text, jsonb);
drop function if exists public.apply_backdated_recipe_event_recovery(uuid, text, jsonb);
drop function if exists public.reject_backdated_event(uuid, text, text);
drop function if exists public.reject_backdated_recipe_event(uuid, text, text);

-- ============================================================
-- Queue and lock tables. No foreign key anywhere references any of the
-- three (checked 2026-08-05). The 1.523 queued events are among what this
-- task retires per the plan.
-- ============================================================

drop table if exists public.backdated_ledger_events;
drop table if exists public.backdated_recipe_events;
drop table if exists public.audit_baseline_locks;
