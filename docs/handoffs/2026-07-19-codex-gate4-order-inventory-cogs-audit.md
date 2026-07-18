# Task: Full System Audit — Gate 4: Order/Inventory/COGS Business Audit (Phase A)

## Context

Gates 1-3 closed 2026-07-18/19 (access exposures, access map, live database/
RLS). Gate 4 shifts domain from security/access to business-logic
correctness: does the order/inventory/COGS engine compute and persist the
right numbers, and does it stay correct when a write partially fails.

The audit-program spec has no real detail for Gate 4 either (same
placeholder pattern as Gates 2-3). Claude scoped this from two direct
investigations before writing this handoff.

### Investigation 1 — existing audit coverage is real but stale

17 correctness audit scripts already exist under `scripts/` (`audit-cogs-drift.ts`,
`audit-current-stock.ts`, `audit-order-ledger.ts`, `audit-pnl-mac-consistency.ts`,
`audit-mac-drift-baseline.ts`, `audit-negative-stock-periods.ts`,
`audit-production-stock.ts`, `audit-purchase-ledger.ts`,
`audit-stock-adjustments.ts`, and others). These were clean as of their last
run, but substantial code has changed since (Gate 1 POS actor fixes, Gate 2's
18+2 read-guard additions including 2 brand-new POS functions that
independently recompute best-seller data via `breakdownRevenueByProduct`).
None of these audits have been rerun against the current code/data state
since Gate 1 started. A fresh baseline is the first, lowest-risk, highest-
value step.

### Investigation 2 — the non-atomic order-mutation paths have a real,
### specific, previously-undocumented gap

Read `lib/sheets-db-v2-edit.ts` (`supersedeOrderV2`, used by `editOrderV2`)
directly. Its own header comment says: "Operations (in order): ... On any
failure, attempts reverse-order cleanup. **Not a true transaction.**" This
matches what `docs/FEATURE-CATALOG.md` already noted for `ORD-EDIT-SUPERSEDE`
("persistence uses sequential writes with best-effort rollback... no
production failure drill").

Read `voidOrderV2` in `app/admin/orders/actions.ts` directly (not just the
catalog note). It already has a deliberately fail-safe write order (reversal
ledger → event → order-status-update last), with an inline comment
explaining why, and an idempotency guard that checks for an existing VOIDED
event before allowing a retry. But tracing the specific failure window
between step 2 (event insert succeeds) and step 3 (order status update
fails): the idempotency guard would see the VOIDED event and **reject a
retry** ("đã có event VOIDED, không hủy lại được"), while the order's
`status` field would still incorrectly read `COMPLETED`. This is a narrower,
more specific gap than "sequential writes are risky" in general — it's a
concrete inconsistency between what the idempotency guard checks (event
existence) and what actually defines "void completed" (event + status both
updated). This has apparently never been tested; no forced-failure test
exists for `voidOrderV2` or `editOrderV2` (confirmed by search — only
`scripts/probe-pos-order-rollback.ts` exists, and it tests the already-atomic
`create_pos_order_atomic` RPC, a different code path entirely).

The same "sequential inserts, no atomic RPC, no forced-failure test" pattern
was found in `saveProductionOrder` (`app/admin/production/actions.ts`) and
`saveProduct` (`app/admin/products/actions.ts`) by inspection of their entry
points — full body review of those two is part of this task, not completed
yet by Claude.

## Scope — Phase A (this task): fresh evidence, forced-failure testing, no fixes

### 1. Rerun all existing correctness audits, produce a dated status report

Run every script matching `scripts/audit-*.ts` that concerns orders,
inventory, COGS, or stock (the ~17 named above, plus any others matching
that description you find) against current data. Produce
`docs/audits/2026-07-19-gate4-correctness-baseline.md` recording, per
script: clean / drift found (with count and magnitude) / error. Do not
investigate or fix any drift found here yet — if a script reports non-zero
drift, record it precisely and flag severity; a deep investigation into a
specific drift is separately scoped work, not this task, unless it's
trivially explained (e.g., a known, already-documented pattern from the MAC
drift saga in `docs/COMPLETED.md`).

### 2. Forced-failure testing for 5 sequential-write paths

For each of `supersedeOrderV2` (order edit), `voidOrderV2`, `saveProductionOrder`,
`saveProduct`, and `submitStockAdjustment`/`approveStockAdjustment` together:
write a **mocked, unit-test-level** forced-failure simulation (matching the
mocking pattern already used in `app/pos/actions.auth.test.ts` and
`app/admin/inventory/actions.auth.test.ts` from Gates 1-2 — mock
`lib/sheets_db`'s `insert`/`insertMany`/`update`/`remove` to throw at each
sequential step) and determine, for a failure at each step:

- Does the write path's own cleanup (if any) actually run and succeed?
- After a failure, is the system left in a state where a legitimate retry
  is safe (idempotency guards correctly recognize partial completion), or
  does it get stuck (falsely blocked) or silently produce inconsistent data
  (falsely allowed to duplicate/diverge)?

Specifically write a test that reproduces the `voidOrderV2` gap described
above: event insert succeeds, order-status update fails, then attempt a
retry — confirm whether it's rejected while the order is still `COMPLETED`
with reversed stock already recorded (data says voided, status says
completed). Do the same trace-through for `supersedeOrderV2`'s cleanup path:
does its reverse-order cleanup actually restore the old order to a valid
state in every failure position, or are there positions where cleanup
itself would need to fail silently and leave a real gap?

Do **not** use live database probes with real financial writes for this
(unlike `probe-pos-order-rollback.ts`, which is safe because it targets an
already-atomic RPC that guarantees rollback) — a live probe against a
non-atomic sequential-write path risks actually leaving orphaned data if
something doesn't clean up as expected. Mocked unit tests are the safe way
to answer "what happens at each failure point" without that risk.

### 3. Classify each of the 5 paths

For each, conclude one of: **safe-by-design** (failure at any step leaves a
retryable or clearly-flagged state, evidence attached), **narrow-gap**
(like the `voidOrderV2` case — a specific, describable inconsistency window,
not a general "not atomic" statement), or **needs-atomic-rpc** (failure
risk is broad enough that only converting to a single database transaction,
matching the `create_pos_order_atomic`/`save_purchase_order_atomic` pattern,
would close it). This classification is Phase B's input — do not build any
new RPC or change any write path in this task.

## Explicitly out of scope for Phase A

- Do not write or deploy any new atomic RPC.
- Do not fix `voidOrderV2`'s idempotency-guard gap or any other gap found —
  describe it precisely with a reproducing test, that's the deliverable.
- Do not deep-investigate any drift found by the reran audit scripts beyond
  recording it precisely — a specific drift investigation is separately
  scoped if warranted after this report is reviewed.
- Do not touch RLS, grants, or anything from Gate 3 Phase B (G3-A4 through
  G3-A8) — different scope, already logged separately in `docs/ROADMAP.md`.
- Do not touch Gate 1/2's already-closed access-guard code.

## Constraints

- Follow `docs/COLLABORATION.md` Section C: these are Codex-owned files
  (engine/data correctness).
- No production data write. The audit reruns are read-only by nature; the
  forced-failure tests are mocked unit tests, not live writes.
- Commit in logical groups (e.g., the audit rerun report as one commit, the
  5 forced-failure test suites as one or more further commits), not one
  giant commit.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: pass, count increased from the Gate 3 baseline (445).
3. `docs/audits/2026-07-19-gate4-correctness-baseline.md` covers all
   existing audit scripts concerning orders/inventory/COGS/stock with a
   clean/drift/error status each.
4. New forced-failure tests exist for all 5 named write paths, each ending
   in one of the 3 classifications above with the reasoning shown.
5. The specific `voidOrderV2` idempotency-guard scenario has a test that
   reproduces it explicitly (not just covered incidentally).

## Priority

P1 — business-logic correctness audit, not an active security exposure;
Gates 1-3 already closed the P0/P1 access-layer risk. This gate's severity
depends entirely on what Phase A's audit rerun and forced-failure tests
find — could surface something that needs faster follow-up.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High — financial/
inventory correctness with a defense-in-depth failure-mode analysis,
requires care, not mechanical.

## Stop-and-ping triggers

Stop and ping Claude before continuing if:

- Any rereran audit script reports drift that wasn't reported clean at its
  last known-good run — that's new, not historical, and needs prioritized
  attention rather than being logged and moved past.
- A forced-failure test reveals a gap broader than the `voidOrderV2` case
  described (e.g., a path that can silently duplicate a financial write, not
  just get stuck) — that's more severe than "narrow-gap," flag immediately.
- Any of the 5 write paths turns out to already have a mitigation Claude
  missed (e.g., a downstream reconciliation job) that changes its risk
  classification — describe it rather than reclassifying silently.
- TS/build fails for a non-trivial reason.
