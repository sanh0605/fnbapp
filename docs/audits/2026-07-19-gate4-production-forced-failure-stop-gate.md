# Gate 4 production forced-failure stop gate

Date: 2026-07-19  
Mode: mocked unit tests only  
Production writes: none  
Status: paused under Item 2a stop-and-ping rule

## Verdict

`saveProductionOrder` has a failure mode broader than the already-confirmed
`voidOrderV2` gap. It has no cleanup and no idempotency guard. If the final
`PRODUCTION_YIELD` insert fails after ingredient consumption has been written,
a normal operator retry creates a new production order and writes ingredient
consumption a second time. The retry succeeds, so the double deduction is
silent from the operator's perspective.

Classification: **needs-atomic-rpc**, P1. This is a conditional integrity risk
requiring a mid-request storage failure; there is no evidence in this task that
it occurred in production.

Per the handoff's Item 2a stop rule, testing stopped before `saveProduct` and
`submitStockAdjustment`/`approveStockAdjustment`. No remediation was started.

## Production path evidence

Test: `app/admin/production/actions.failure.test.ts`

The stateful mock uses the real action orchestration with mocked
`findAll`/`generateNewId`/`insert`. Each retry receives fresh IDs, matching the
production action. One inventory ingredient is consumed per production run.

| Forced failure | State after failure | State after ordinary retry | Result |
|---|---|---|---|
| Insert `Production_Orders` | No rows | 1 complete order, 1 item, 1 consume, 1 yield | Retry safe only because nothing was written. |
| Insert `Production_Items` | 1 orphan production order | 2 orders, only second order complete | Partial header remains; no retry correlation. |
| Insert `PRODUCTION_CONSUME` | 1 order + 1 item, no ledger | 2 orders + 2 items; second has consume/yield | First production record falsely claims produced quantity without inventory effects. |
| Insert `PRODUCTION_YIELD` | 1 order + 1 item + 1 consume, no yield | 2 orders + 2 items + **2 consumes** + 1 yield | Silent double ingredient deduction and one incomplete production record. |

The last row is the stop trigger: a single write failure followed by the
expected operator retry duplicates a financial/inventory effect, and no guard
detects the prior partial request.

## Order-edit evidence collected before the stop

Test: `lib/sheets-db-v2-edit.failure.test.ts`

`supersedeOrderV2` was also exercised at all five sequential calls:

1. old-order status update;
2. new-order insert;
3. new-lines batch insert;
4. edit-event insert;
5. combined reversal/consume ledger batch insert.

For every single forced failure, its reverse-order cleanup restored the initial
state and an ordinary retry succeeded without duplicate rows. However, cleanup
is explicitly best-effort and swallows its own errors. A forced event-insert
failure combined with a line-cleanup failure left orphan `Order_Lines_V2`
rows; primary-key uniqueness then caused every retry to fail while the orphan
remained.

Preliminary classification: **needs-atomic-rpc**. Its common single-failure
case is safer than production and void because cleanup succeeds, but a failed
cleanup creates a durable inconsistent state that the caller cannot reconcile.
Final cross-path classification remains deferred until Item 2 resumes.

## Test-model boundaries

- Tests call the real server-action/write-helper orchestration.
- Storage methods and authentication are mocked; no live write probe ran.
- Batch calls are modeled as all-or-nothing at the mock-call boundary. Partial
  insertion inside one `insertMany` call is not claimed by this evidence.
- The edit harness models database ID uniqueness, so an orphan with an existing
  ID blocks retry rather than being duplicated.

## Decision requested from Claude

Confirm whether evidence collection may continue for the two untested paths
despite the production path having no idempotency guard:

- `saveProduct`;
- `submitStockAdjustment` and `approveStockAdjustment` as one path.

Phase A must remain evidence-only. Atomic RPC design or other remediation is a
separate reviewed Phase B.
