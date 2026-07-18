# Gate 4 correctness baseline

Date: 2026-07-19  
Mode: read-only  
Status: paused at a new live negative-stock stop gate

## Executive result

Twenty-one current order/inventory/COGS/stock audit scripts were run against
the live database. No database write method or mutating RPC was used.

The MAC addendum is resolved: all 12 newly surfaced lines are the known
`BACKDATED_LEDGER_LIKE` mechanism, and the pre-visibility replay reproduces
stored COGS for 12/12 lines. See
`2026-07-19-gate4-mac-drift-12-line-classification.md`.

One genuine stop gate remains: `ING-003` (Sữa đặc) entered an ongoing
negative-stock period on 2026-07-18 and is currently -131 g. This is newer
than the last documented negative-stock baseline. Per the Gate 4 handoff,
forced-failure testing has not started pending Claude review.

Other non-zero outputs below are either established historical evidence,
informational secondary audits, a known order gap, rounding noise, or a stale
audit implementation. They are labeled explicitly rather than called clean.

## Audit matrix

| Script | Status | Fresh result | Interpretation |
|---|---|---|---|
| `audit-cogs-drift.ts` | INFORMATIONAL | 2,089 FIFO line mismatches; -1,677,893 VND | Expected secondary FIFO comparison after MAC migration; script states this is not the primary COGS contract. |
| `audit-current-stock.ts` | **STOP: NEW DRIFT** | 44 items; 3 negative: ING-003 -131 g, ING-021 -729.821 g, ING-024 -150 ml | ING-003 became negative on 2026-07-18. ING-021/024 are existing unresolved stock gaps. |
| `audit-mac-cogs-drift.ts` | REFERENCE DRIFT | 408 mismatches; -134,478 VND; 382 BTP_SHORTFALL + 26 MAC_REPRICE | Raw replay is not cohort-aware. Use the baseline audit for operational status. |
| `audit-mac-drift-baseline.ts` | CLASSIFIED | 408 live mismatches; 380 locked matched; 16 replay-only locked violations; 12 new; 0 stored violations | The 12 new lines are now classified `BACKDATED_LEDGER_LIKE`; 12/12 exact pre-visibility reproduction. |
| `audit-modifier-recipes.ts` | CLEAN | 8 modifiers, 9 recipes, 0 errors, 0 warnings | No issue. |
| `audit-negative-btp-orders.ts` | HISTORICAL EVIDENCE | 49 negative BTP sales rows | All printed rows are the established June BTP-negative window; no new July row in this output. |
| `audit-negative-periods-classification.ts` | **STOP: NEW DRIFT** | 51 periods: 27 DOUBLE_DEDUCT_OR_RECIPE, 1 MISSING_PO, 23 MIGRATION_GAP_NO_YIELD | Confirms ongoing ING-003 period starts 2026-07-18; historical buckets otherwise match prior migration/shortfall evidence. |
| `audit-negative-stock-periods.ts` | **STOP: NEW DRIFT** | Ongoing: ING-003 -131 g, ING-021 -729.821 g, ING-024 -150 ml | Same new ING-003 stop signal; other printed periods are historical. |
| `audit-order-ledger.ts` | KNOWN REPLAY DRIFT | 301 mismatches, 0 orphan ledger rows | Concentrated in known BTP shortfall/replay periods; no orphan ledger row. Not cohort-aware. |
| `audit-order-modifier-qty.ts` | CLEAN | 4 qty>1 modifier rows, 0 snapshot mismatch | No issue. |
| `audit-order-total-consistency.ts` | KNOWN GAP | 1/1,559 COMPLETED mismatch: UCK000269, 15,000 VND order with no lines | Already named in the 2026-07-01 Supabase integrity recovery design; not newly discovered. |
| `audit-pnl-mac-consistency.ts` | CLEAN | Product/topping delta 0; ingredient delta 0 | P&L views reconcile exactly to stored COGS. |
| `audit-po-save-ledger.ts` | **AUDIT ERROR** | False 55/55 line-count mismatches | Script still joins `line.po_id` and samples `line.qty`; current schema uses `purchase_order_id` and `quantity`. Do not interpret as production drift. |
| `audit-pos-inventory-state.ts` | CLEAN | 49 items, 0 mismatch | Current POS inventory state matches the ledger-derived state. |
| `audit-production-stock.ts` | HISTORICAL/SEMANTIC GAP | 0 production headers/items, 5 ledger yields | The five yields are existing balancing/history rows; the script cannot distinguish them from production-header-backed yields. |
| `audit-purchase-ledger.ts` | ROUNDING-ONLY | 111 expected/actual groups; 24 mismatches; max unit-cost delta 0.0028; all qty deltas 0 | Floating-point precision only; no missing/ambiguous conversions or quantity divergence. |
| `audit-purchase-order-transaction-readiness.ts` | CLEAN | Source checks 8/8; remote non-writing probe skipped | Atomic PO migration source is ready; no remote flag used. |
| `audit-report-v2-consistency.ts` | KNOWN GAP | 1 mismatch; order vs line revenue delta 15,000 VND | Same known UCK000269 line-less order, not a separate discrepancy. |
| `audit-stock-adjustments.ts` | CLEAN | 0 adjustments, 0 missing reasons/ledger rows | Empty current population; no issue. |
| `audit-stock-ledger-schema.ts` | CLEAN | 8,128 rows; 0 invalid types/signs/costs/missing required fields | Schema-level ledger integrity clean. |
| `audit-void-orders.ts` | CLEAN | 11 VOIDED; 0 reversal/event/report-integrity issues; 10 SUPERSEDED with 0 missing reversal | Current completed void/supersede records reconcile. This does not test partial-failure windows. |

## Coverage decisions

The repository currently contains 36 `audit-*.ts` files including test files.
The 21 scripts above are the reusable live correctness audits in Gate 4's
order/inventory/COGS/stock scope.

The following were not rerun because they are outside this gate or are
historical/one-off targeted audits: admin auth/read-guard audits, Gate 3
database-security audits, UI/sheet-usage audits, `audit-specific-order.ts`,
discount/revenue anomaly audits, the historical Đào miếng and water/sugar
transition audits, and `audit-recipe-history.ts` (which overwrites an
immutable 2026-07-04 evidence document). This exclusion avoids silently
rewriting frozen evidence and does not omit a current general-purpose
correctness audit.

## Stop gate and next decision

Gate 4 Phase A is paused before Item 2. Claude should decide whether the new
ING-003 -131 g period is:

- a separately scoped inventory-data investigation that must run before Gate
  4 resumes; or
- an acknowledged operational stock shortfall that may be logged while the
  mocked forced-failure tests proceed.

No production data was changed. No atomic RPC, recovery, lock, or engine fix
was attempted.
