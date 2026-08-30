-- Phase B of docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md:
-- drop the dead functions that reference stock_ledger/inventory_balances.
-- Written and committed, NOT applied -- applying to production is the
-- owner's own separate approval, and section 3b of the plan forbids
-- applying this before Phase A is deployed and confirmed working (see the
-- second block below for why that specifically matters here).
--
-- Every name below was re-derived live 2026-08-31/09-01, not carried
-- forward from any earlier count in the plan (section 2 said 8, section 2b
-- said 7, and neither count survives contact with this migration --
-- see the commit message and DEVELOPMENT-TRACKING.md for the full
-- reconciliation). Each candidate was checked individually against: (1)
-- app/, lib/ (excluding lib/historical/), scripts/ on the local working
-- tree; (2) the same on origin/main, since Phase A's own deletions have not
-- been pushed; (3) every other function's own body in supabase/migrations/,
-- for an internal SQL-to-SQL call a TypeScript-only grep cannot see.
--
-- That third check is why create_pos_order_atomic_unvalidated_0025 is NOT
-- in this migration despite being named "dead" in every version of the
-- plan since 28/08: create_pos_order_atomic (the live checkout RPC every
-- POS sale calls) is a thin wrapper that delegates to it internally
-- (0072_outlet_order_no_minting.sql:383) -- dropping it would have broken
-- every sale. It is a live writer (insert into stock_ledger at line 252 of
-- that same file), currently inert only because its one real caller
-- (app/pos/actions.ts's submitOrderV2, both locally and on origin/main)
-- always passes an empty ledger array -- Phase C's job, not this one's.
--
-- Also not in this migration, out of Phase B's scope on purpose:
-- stock_ledger_apply_inventory_balance_delta, the function backing
-- trg_stock_ledger_inventory_balances. That trigger and its function are
-- Phase D's job (drop the trigger, then the tables), not Phase B's.

-- ============================================================
-- Unconditionally dead: no caller anywhere -- not on the local working
-- tree, not on origin/main, not from another SQL function's body. Safe to
-- drop the moment this migration is ever applied, regardless of whether
-- Phase A has shipped yet.
-- ============================================================

-- Only caller anywhere is scripts/audit-gate3-database-security.ts (a
-- read-only security/RLS audit against every RPC name in the database,
-- not a business-logic caller) plus lib/historical/history-ops/
-- hong-luc-migration-transaction.ts (historical tooling, excluded by the
-- plan's own live/dead definition). Confirmed identical on origin/main.
drop function if exists public.apply_hong_to_luc_migration(text, text, text, text, jsonb);

-- Only caller anywhere is the same audit script. No historical caller, no
-- test caller beyond the audit script's own core test. Confirmed identical
-- on origin/main.
drop function if exists public.apply_purchase_cost_recovery(text, text, jsonb);
drop function if exists public.rollback_purchase_cost_recovery(text);

-- Zero callers anywhere -- not even the audit script names it. Confirmed
-- identical on origin/main.
drop function if exists public.rebuild_inventory_balances();

-- Only callers are three dated, one-time historical repair scripts
-- (scripts/apply-full-history-stock-ledger-rebuild.ts,
-- scripts/apply-phase4-stock-rebuild.ts,
-- scripts/repair-void-shortfall-ledger.ts -- each names the specific past
-- plan or incident it repaired, none is a recurring operational tool).
-- Confirmed identical on origin/main.
drop function if exists public.rebuild_stock_ledger_for_order(text, text, text, integer, jsonb, jsonb, boolean);

-- Only caller anywhere is the audit script plus
-- lib/historical/pos-inventory-state.ts (historical tooling). Confirmed
-- identical on origin/main. Resolves the plan's own section 2b.4 open
-- question: read-only, not a writer, but dead by the same caller test as
-- everything else here.
drop function if exists public.get_pos_inventory_state(timestamptz);

-- Only caller anywhere is lib/historical/production-order-transaction.ts
-- (historical tooling). The application-level production/recipe screens
-- that used to be its real caller were deleted 2026-08-27/31 (the recipes
-- removal plan), but this SQL function itself was never dropped by that
-- work -- it is still present in the schema today, not already gone, and
-- this migration is what actually removes it. Confirmed identical on
-- origin/main.
drop function if exists public.save_production_order_atomic(jsonb, jsonb, jsonb);

-- ============================================================
-- Dead on the LOCAL working tree only -- still called by what is actually
-- running in production (origin/main) right now, via
-- lib/shift-stock-check-transaction.ts, which Phase A deleted locally but
-- has not pushed. Written here because this whole migration is not applied
-- until the owner has deployed Phase A and confirmed the site works
-- (plan section 3b) -- by the time this file is ever run, that caller will
-- already be gone from production too. Applying this migration before
-- Phase A ships would break the shift stock check screen on the live site;
-- do not apply out of order.
-- ============================================================

-- Read-only in both -- confirmed by reading the body, not assumed: each
-- only ever SELECTs from stock_ledger (a theoretical-stock lookup), never
-- INSERTs. The plan's own Phase C text once speculated these "may exist
-- only to write the ledger"; they do not, and never did.
drop function if exists public.open_shift_stock_check_atomic(text, text, jsonb, text);
drop function if exists public.close_shift_stock_check_atomic(text, text, text, jsonb, text);
