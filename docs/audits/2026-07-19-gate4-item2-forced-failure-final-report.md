# Gate 4 Item 2: sequential-write forced-failure audit

Date: 2026-07-19

Mode: mocked unit tests only

Production writes: none

Production code changes: none

## Executive verdict

All five audited write paths are classified **`needs-atomic-rpc`**. None meets
the `safe-by-design` or `narrow-gap` standard across its complete sequence.
The risks are conditional on a storage call failing mid-request; this audit
found no evidence that any scenario has occurred in production.

| Path | Final classification | Principal forced-failure result |
|---|---|---|
| `voidOrderV2` | `needs-atomic-rpc`, P1 | Retry either duplicates the stock reversal or is blocked with `COMPLETED` status after a VOIDED event. |
| `supersedeOrderV2` | `needs-atomic-rpc` | Single failures are cleaned up, but a cleanup failure leaves orphan lines that permanently block retry. |
| `saveProductionOrder` | `needs-atomic-rpc`, P1 | A failed yield followed by retry silently doubles ingredient consumption. |
| `saveProduct` | `needs-atomic-rpc` | Create retry duplicates catalog rows; edit retry can permanently lose price history. |
| stock adjustment submit/approve | `needs-atomic-rpc`, P1 | A ledger failure leaves an approved adjustment without its stock mutation; retry duplicates the adjustment or is blocked. |

These results support one coherent Phase B transaction-remediation program,
not independent changes inside this evidence-only phase.

## Test boundary

The tests invoke the real orchestration functions and replace only the
authentication/cache/storage boundaries with stateful in-memory mocks. Each
storage method can fail at a named sequential step. A normal operator retry is
then invoked against the retained partial state.

An `insertMany` call is modeled as atomic at the mock-call boundary. The report
does not claim to simulate partial insertion inside one batch call.

## Final two paths

### `saveProduct`

Evidence: `app/admin/products/actions.failure.test.ts` (7 tests).

#### Create path

| Forced failure | State after failure | State after retry | Result |
|---|---|---|---|
| Product insert | No rows | One complete product | Safe only at the first write. |
| Variant insert | One orphan product | Two products; only the second is complete | Duplicate catalog header. |
| Price-history insert | Product + variant, no history/recipe | Two products and variants; only the second has history/recipe | Duplicate visible catalog records. |
| Initial recipe insert | Product + variant + price history, no recipe | Two products, variants, and histories; only the second has a recipe | Duplicate catalog and price history. |

Fresh IDs are generated on every create attempt. There is no request key,
cleanup, or correlation to the partial first attempt, so retry creates a new
catalog object rather than completing the old one.

#### Edit path

| Forced failure | State after failure | State after retry | Result |
|---|---|---|---|
| Price-history insert after variant price update | New price persisted; no history row | Retry sees no price change and writes no history | Price-change audit history is permanently lost. |
| New recipe insert after old recipe is closed | No active recipe | Retry creates a new active recipe | Retry repairs the state, but a real no-active-recipe window exists. |
| Removed-variant soft delete | Removed variant remains ACTIVE | Retry marks it DELETED | Retryable at this position, but the failed request exposes partial state. |

The lost price-history scenario is decisive: an ordinary retry returns success
but cannot reconstruct the skipped audit row because the price mutation is
already visible. The path therefore requires a transaction around product,
variant, price-history, recipe-version, and deletion writes.

### `submitStockAdjustment` / `approveStockAdjustment`

Evidence: `app/admin/inventory/actions.failure.test.ts` (4 tests).

#### Direct submit

`submitStockAdjustment` creates an already-`APPROVED` adjustment, then creates
its `STOCK_ADJUST` ledger row.

| Forced failure | State after failure | State after retry | Result |
|---|---|---|---|
| Adjustment insert | No rows | One adjustment + one ledger row | Safe only at the first write. |
| Ledger insert | One APPROVED adjustment, no ledger | Two APPROVED adjustments; ledger references only the second | Orphan approved audit record and duplicate business request. |

The first adjustment falsely records an approved stock correction that never
reached the stock ledger. Since retry receives a new adjustment ID, it cannot
repair or identify the first row.

#### Approve existing adjustment

| Forced failure | State after failure | State after retry | Result |
|---|---|---|---|
| Approval-status update | PENDING, no ledger | APPROVED + one ledger row | Retry safe at this position. |
| Ledger insert after approval | APPROVED, no ledger | Rejected as already approved; still no ledger | Durable stuck state. |

The status guard treats `APPROVED` as completion even when the ledger effect is
missing. Status transition and ledger insertion must commit together.

## Prior three paths incorporated into the final classification

### `voidOrderV2`

Evidence: `app/admin/orders/actions.failure.test.ts` and
`2026-07-19-gate4-item2-void-order-stop-gate.md`.

- Reversal failure before any write is retry-safe.
- Event failure after reversal causes retry to write a second reversal.
- Status failure after event causes the event-based guard to block retry while
  the order remains `COMPLETED`.

### `supersedeOrderV2`

Evidence: `lib/sheets-db-v2-edit.failure.test.ts` and
`2026-07-19-gate4-production-forced-failure-stop-gate.md`.

Reverse-order cleanup restores the initial state for each isolated primary
failure. Cleanup itself is best-effort, however. An event-insert failure plus
a line-cleanup failure leaves orphan new-order lines; uniqueness checks then
block every retry.

### `saveProductionOrder`

Evidence: `app/admin/production/actions.failure.test.ts` and
`2026-07-19-gate4-production-forced-failure-stop-gate.md`.

- Item failure leaves an orphan production header.
- Consume failure leaves a production header/item with no inventory effect.
- Yield failure leaves a consume without yield; retry creates another order
  and another consume, silently doubling the ingredient deduction.

## Phase B input

Recommended remediation order:

1. `voidOrderV2`, `saveProductionOrder`, and both stock-adjustment paths:
   direct inventory/financial integrity and blocked/duplicated retries.
2. `supersedeOrderV2`: order, inventory, and COGS integrity currently depend
   on best-effort cleanup.
3. `saveProduct`: catalog/recipe consistency and loss of price-change history.

Each design should follow the established single database-transaction pattern
used by `create_pos_order_atomic` and `save_purchase_order_atomic`, include an
idempotency key where operator retry is possible, and preserve the existing
authorization boundary. This report does not design or implement those RPCs.

## Verification expectations

- Focused forced-failure tests for all five paths pass.
- Full Vitest suite passes with the new tests included.
- `tsc --noEmit` reports zero errors.
- `git diff --check` is clean.

Gate 4 Phase A should remain open for Claude review. No Phase B remediation is
authorized by this report.
