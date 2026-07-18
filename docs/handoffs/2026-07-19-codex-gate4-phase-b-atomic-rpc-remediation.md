# Task: Gate 4 Phase B — Atomic RPC Remediation for 5 Sequential-Write Paths

## Context

Gate 4 Phase A (`docs/handoffs/2026-07-19-codex-gate4-order-inventory-cogs-audit.md`)
closed 2026-07-19 (see `docs/COMPLETED.md`, commits `c0be7ce`, `15e3889`,
`26b2eb8`, `159b7c9`). Mocked forced-failure tests classified all 5
sequential-write paths as `needs-atomic-rpc`: a storage call failing
mid-request can leave silent duplicates, silently lost audit data, or a
stuck state that blocks every future retry. Full evidence for each path is
in `docs/audits/2026-07-19-gate4-item2-forced-failure-final-report.md` and
`docs/ROADMAP.md` entries `G4-B1` through `G4-B5`.

Owner decision 2026-07-19: fix all 5 paths in one combined Phase B effort
(not split into a partial P1-only pass), following the existing
`create_pos_order_atomic` / `save_purchase_order_atomic` pattern
(`supabase/migrations/0006_atomic_purchase_order_write.sql` is the
reference implementation — read it first, it is the house style: a single
`security definer` plpgsql function, `revoke all` then `grant execute` to
`service_role` only, ID allocation and every write inside the function
body so one Postgres transaction covers everything).

## Scope — one atomic RPC per path, 5 total

Each of the 5 items below gets its own migration file (next number: `0017`,
increment per file — do not reuse one migration for multiple RPCs) and its
own commit, per `docs/COLLABORATION.md` Section D rule 2 ("one commit
equals one outcome plus verification. Do not mix... in the same commit").
This is one Phase B *effort*, not one Phase B *commit*.

For each path:

1. Design the RPC signature (JSONB in, JSONB result out — match the
   existing style in `0006_atomic_purchase_order_write.sql`).
2. Move every write currently done as separate sequential
   `insert`/`insertMany`/`update` calls from the TypeScript action into the
   RPC body, so they run inside one Postgres transaction.
3. Keep the existing TypeScript action function as the entry point.
   `requireAdmin()`/authorization stays in TypeScript exactly as today —
   the RPC is `service_role`-only (same as the existing atomic RPCs), it is
   not a new authorization boundary and must not weaken the current one.
4. Where the forced-failure evidence showed a retry can create a duplicate
   business record (not just a duplicate ledger row), add an idempotency
   key so a legitimate operator retry after a mid-request failure completes
   the original attempt instead of creating a new one. Decide the key
   per-path based on what's naturally unique to the request (see notes
   below); do not invent a client-generated UUID scheme if an existing
   natural key already works.
5. Write or update the forced-failure test for that path so it now asserts
   the *fixed* behavior against the RPC-backed action (retry-safe, no
   duplication, no stuck state) — the existing Phase A tests asserted the
   *broken* behavior, they need to flip to proving the fix, not just be
   deleted.

### 1. `voidOrderV2` — `app/admin/orders/actions.ts:311`

Evidence: `G4-B1`, `app/admin/orders/actions.failure.test.ts`.

Current sequence: reversal ledger insert (`insertMany`) -> `Order_Events`
VOIDED insert -> `Orders_V2` status update. Gap: reversal succeeds + event
insert fails -> retry re-inserts a second reversal batch (the idempotency
guard only checks for an existing VOIDED event, which doesn't exist yet at
that failure point).

Natural idempotency key: the order itself (`orderId`) plus the fact that a
reversal for this order should only ever be written once. Inside the
transaction, guard on "does a VOIDED event or an EDIT_REVERSAL row
referencing this order already exist" before writing the reversal, not
just "does a VOIDED event exist" as the current code does.

### 2. `saveProductionOrder` — `app/admin/production/actions.ts:40`

Evidence: `G4-B2`, `app/admin/production/actions.failure.test.ts`. Worst of
the 5 — no cleanup, no idempotency guard at all today.

Current sequence: `Production_Orders` insert -> `Production_Items` insert
-> N `Stock_Ledger` `PRODUCTION_CONSUME` inserts (one per ingredient) -> one
`Stock_Ledger` `PRODUCTION_YIELD` insert. Gap: yield insert fails after
consume rows are written -> retry creates an entirely new production order
and consumes ingredients a second time, silently.

This path has no caller-supplied identifier to dedupe on today (fresh IDs
generated every call, matching `saveProduct`'s create path). Decide whether
to add a client-supplied idempotency key (e.g., a UUID the browser
generates once per form submission and resends on retry) or rely on the
transaction itself making partial states impossible so there is nothing
left to retry against inconsistently — the RPC removes the intermediate
state where consume exists without yield.

#### 2a. Claude decision on the schema-semantics stop-gate (2026-07-19)

Codex correctly stopped rather than guessing: the current `saveProductionOrder`
writes `Production_Orders{id, apply_date, created_at}` and
`Production_Items{id, production_order_id, semi_product_id, qty_produced,
total_cost}` — columns that do not exist on the live `production_orders` /
`production_items` tables at all.

**Verified directly against the live database** (Supabase Management API
read-only query, same method as Gate 3's audit): the live schema already
matches Codex's proposed canonical shape exactly and has since
`0001_init_schema.sql` — `production_orders(id, semi_product_id not null,
batch_yield not null default 1, status not null default 'PENDING', notes,
created_by_id, created_by_name, created_at, completed_at)`;
`production_items(id, production_order_id, ingredient_id not null,
ingredient_type not null check in ('BASE_INGREDIENT','SEMI_PRODUCT'),
quantity not null, unit_id, created_at)`. **Both tables have exactly 0 rows
in production** — `saveProductionOrder` cannot have ever completed a live
write against this schema (the column names don't exist; PostgREST would
reject the insert). This is a dead/broken write path, not a live feature
with data to preserve, so there is no legacy-semantics tradeoff to weigh —
converting to the canonical shape has no migration/backward-compatibility
concern.

This is corroborated by two more signals, so Codex isn't the one restoring
canonical semantics — the rest of the codebase already assumes it:
`types/db.ts`'s `DBProductionOrder`/`DBProductionItem` already declare
`semi_product_id`/`status` and `ingredient_id`/`ingredient_type`/`quantity`/
`unit_id` respectively (not the legacy field names the action currently
writes), and `ProductionForm.tsx` already tags every consumed line with
`ingredient_type` (`BASE_INGREDIENT` check already present at line 54) — the
UI is already sending canonical-shaped data, the write path just never
mapped it through.

**Decision: approved, build the RPC against Codex's proposed canonical
mapping.** One clarification and one addition beyond what Codex listed:

- `DBProductionOrder.target_yield` (current type) vs. `batch_yield` (live
  column) is a naming mismatch, not a semantic one — keep `target_yield` as
  the form-data/API-facing name if you prefer (matches the UI field already
  in `ProductionForm.tsx`), just map it to `batch_yield` at the RPC
  boundary; don't feel obligated to rename the public-facing field to match
  the column 1:1.
- `scripts/audit-production-stock.ts` needs more than a field rename: it
  currently reads `item.semi_product_id` / `item.qty_produced` off
  `production_items` rows (`scripts/audit-production-stock.ts:30-31`) to
  compute produced quantity per semi-product. Under the canonical schema,
  produced quantity lives on `production_orders.batch_yield` (one row per
  batch, joined to `semi_product_id` on the same row), not on
  `production_items` at all — `production_items` only carries *consumed*
  ingredient rows. The aggregation needs to change from "sum
  `qty_produced` grouped by `production_items.semi_product_id`" to "sum
  `batch_yield` grouped by `production_orders.semi_product_id` where
  `status = 'COMPLETED'`". Since both tables have 0 live rows today, this
  audit has never actually been exercised against real data either — treat
  it as building the correct logic from scratch against the canonical
  schema, not patching the existing (never-tested) logic.
- Set `status = 'COMPLETED'` and `completed_at = now()` at creation time,
  not `'PENDING'` — the current UI flow does the whole batch (consume +
  yield) synchronously in one call with no separate approval step, so
  `'COMPLETED'` is the correct terminal state immediately, matching what
  the canonical schema's own status check constraint allows.

### 3. Stock adjustment `submitStockAdjustment` / `approveStockAdjustment` — `app/admin/inventory/actions.ts:463` / `:511`

Evidence: `G4-B5`, `app/admin/inventory/actions.failure.test.ts`.

`submitStockAdjustment`: `Stock_Adjustments` insert (status already
`APPROVED`) -> `Stock_Ledger` insert. `approveStockAdjustment`:
`Stock_Adjustments` status update -> `Stock_Ledger` insert, guarded by
`if (adj.status === "APPROVED") return fail(...)` (`app/admin/inventory/actions.ts:521`).
Gap in both: ledger insert fails after the adjustment write lands ->
`submitStockAdjustment` retry creates a second APPROVED adjustment;
`approveStockAdjustment` retry is rejected by the status guard while the
ledger effect never lands — approved on paper, no stock effect, permanently
stuck without manual intervention.

Fix both entry points as one combined RPC pair (or two RPCs sharing a
helper) since they write the same two tables in the same order. The status
guard needs to change from "is this already APPROVED" to "does the ledger
row for this adjustment already exist" — that's the actual completion
condition, matching the `voidOrderV2` fix's logic above.

#### 3a. Claude decision on the schema-semantics stop-gate (2026-07-19)

Same category as the `saveProductionOrder` stop-gate (section 2a): live
`stock_adjustments` has `id, reason, created_by_id, created_by_name,
status, created_at, approved_at, notes` and is missing exactly the 5
columns Codex named (`item_reference`, `theoretical_qty`, `actual_qty`,
`difference`, `approved_by`) — **verified directly against the live
database**, same read-only method as section 2a. `stock_adjustments` also
has 0 rows in production, so this write path has never completed a live
insert either (same evidence pattern as `saveProductionOrder`): no legacy
data, no tradeoff to weigh, one correct fix.

Unlike `production_orders`/`production_items`, this gap traces to
`0001_init_schema.sql` itself, not a later drift — the initial schema for
this table was simply incomplete relative to what
`app/admin/inventory/actions.ts` (`submitStockAdjustment`,
`approveStockAdjustment`) and its UI have always required. Worth noting as
a pattern now that it's shown up twice in one afternoon: check the other 3
remaining paths' live schemas early, before writing their RPCs, rather than
assuming `0001_init_schema.sql` is complete for them too.

**Decision: approved.** Add migration `0019` with the 5 columns
(`item_reference text not null`, `theoretical_qty numeric`, `actual_qty
numeric`, `difference numeric not null`, `approved_by text` — nullable
since a row can exist `PENDING` before approval) plus the two atomic RPCs
in the same migration, per Codex's own proposal. One addition: since
`submitStockAdjustment` always creates the row already `APPROVED` (per the
2026-07-18 SEC-5 policy — staff no longer submit `PENDING` adjustments,
admin/manager does it directly) while `approveStockAdjustment` still
supports approving a `PENDING` row, make sure the new `approved_by`
column's nullability and the RPCs' guard both account for both entry paths
correctly, not just the one currently exercised by the UI.

### 4. `supersedeOrderV2` (order edit) — `lib/sheets-db-v2-edit.ts:48`

Evidence: `G4-B3`, `lib/sheets-db-v2-edit.failure.test.ts`. This function's
own header already says "Not a true transaction" — read the full function
body before starting, it's the most structurally complex of the 5 (5
sequential writes with best-effort reverse-order cleanup on failure).

Gap: single-step failures clean up correctly (5/5 tested), but if the
cleanup itself fails, orphan `Order_Lines_V2` rows remain and every
subsequent retry hits a primary-key conflict — a stuck state, not a silent
duplicate, but still requires manual intervention today.

Optimistic lock (`expectedOldVersion` check at `lib/sheets-db-v2-edit.ts:58`)
must be preserved inside the RPC exactly as today — do not silently drop it
converting to SQL.

### 5. `saveProduct` — `app/admin/products/actions.ts` (`saveProduct`)

Evidence: `G4-B4`, `app/admin/products/actions.failure.test.ts`. Two
sub-paths, both need covering:

- Create: `Products` insert -> `Product_Variants` insert -> `Product_Price_History`
  insert -> `Recipes` insert, no cleanup, no idempotency key. Any failure
  after the first insert leaves an orphan row; retry always creates a new
  product/variant rather than completing the old one.
- Edit: price update to `Product_Variants` can succeed with the
  `Product_Price_History` insert failing right after — the decisive finding
  from Phase A. Retry sees no price delta (already applied) and writes no
  history row, so the price-change audit event is **permanently and
  silently lost**, not just delayed like the other 4 paths' stuck/duplicate
  patterns. This is the one case in all 5 where "make it retry-safe" is not
  enough by itself — the RPC must write the price-history row atomically
  with the price update in the same transaction, so there is no window
  where one exists without the other.

## Explicitly out of scope

- Do not touch Gate 3 Phase B items (`G3-A4` through `G3-A8`) or any RLS/grant
  work — different scope, already logged separately.
- Do not change the POS/purchase-order RPCs that are already atomic
  (`create_pos_order_atomic`, `save_purchase_order_atomic`) — reference
  only, not modification targets.
- Do not change what counts as authorized to call these actions
  (`requireAdmin()` boundaries stay exactly as they are today) — this is a
  data-integrity fix, not an access-control change.
- Do not attempt a single migration covering all 5 RPCs — 5 separate files,
  5 separate commits, matching the one-commit-per-outcome rule.

## Stop-and-ping triggers

Stop and ping Claude before continuing past a given path if:

- The RPC redesign would require changing what an existing caller (UI,
  another server action, a report/audit script) receives back from the
  action function — a return-shape change needs review before it ripples
  into callers.
- Preserving the optimistic-lock check in `supersedeOrderV2` or the
  idempotency-guard rewrite in `voidOrderV2`/stock-adjustment turns out to
  need a design decision beyond "move the existing check inside the
  transaction" (e.g., a genuinely new locking strategy).
- Any forced-failure test for the *fixed* path still shows a failure mode
  after the RPC is in place — that means the fix isn't actually closing the
  gap and needs a second look before moving to the next path.
- TS/build fails for a non-trivial reason, or the MAC/COGS drift audits
  (`docs/TESTING.md` risk gates) show any new drift after a path lands.

## Verification (per path, before moving to the next)

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: full suite passes, count unchanged or higher (baseline:
   474, from Gate 4 Phase A close).
3. The path's forced-failure test now asserts retry-safety / no data loss
   against the RPC-backed action (test is updated, not deleted).
4. `scripts/audit-current-stock.ts` and any other relevant existing
   correctness audit (`docs/audits/2026-07-19-gate4-correctness-baseline.md`
   lists all 21) still reports clean/unchanged for the affected tables.
5. Migration applies cleanly against the actual Supabase project (same way
   `0006`'s migration was verified) before the commit closes that path.

## Priority / order

Recommended order from the Phase A report (do the 3 with direct
inventory/financial exposure first, then the 2 with cleanup/audit-history
exposure):

1. `voidOrderV2`
2. `saveProductionOrder`
3. Stock adjustment submit/approve
4. `supersedeOrderV2`
5. `saveProduct`

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High —
architecture/schema/migration work touching financial and inventory
correctness, not mechanical.
