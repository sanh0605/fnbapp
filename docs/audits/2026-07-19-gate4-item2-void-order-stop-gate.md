# Gate 4 Item 2 stop gate: void-order partial failure

Date: 2026-07-19  
Mode: mocked unit test only; no live writes  
Test: `app/admin/orders/actions.failure.test.ts`

## Verdict

`voidOrderV2` is `needs-atomic-rpc`, not `narrow-gap`.

The handoff anticipated one stuck-state window after the VOIDED event succeeds
but the final order-status update fails. Forced-failure testing confirmed that
window and found a broader one: if the reversal batch succeeds and the VOIDED
event insert fails, a normal operator retry silently writes the reversal a
second time.

This meets the Gate 4 stop-and-ping condition: a path can silently duplicate a
financial/inventory write. Testing stopped before the other four paths.

## Mock model

The test uses in-memory Orders, Order Events, and Stock Ledger collections and
mocks only the existing `sheets_db` boundary. It begins with one COMPLETED
order and one `SALES_CONSUME` row of -10 units. Each successful reversal adds
an `EDIT_REVERSAL` row of +10 units.

No production module was changed. The test invokes the real `voidOrderV2`
orchestration and injects a failure at each of its three sequential write
steps.

## Failure matrix

| Failure position | State after failure | Retry result | Classification |
|---|---|---|---|
| Reversal `insertMany` fails before writing | COMPLETED; 0 reversal; 0 VOIDED event | Succeeds with exactly 1 reversal | Safe at this position |
| Reversal succeeds; VOIDED event insert fails | COMPLETED; 1 reversal; 0 VOIDED event | Succeeds but writes a second reversal | **Silent duplicate inventory mutation** |
| Reversal and event succeed; status update fails | COMPLETED; 1 reversal; 1 VOIDED event | Rejected by event-based idempotency guard | Stuck inconsistent state |

## Root cause

The write order is:

1. insert reversal ledger rows;
2. insert VOIDED event;
3. update order status to VOIDED.

There is no cleanup or transaction around the three calls. The idempotency
guard checks only for a VOIDED event:

- after step 2 succeeds, it prevents duplicate reversals but also prevents the
  missing status transition from being retried;
- before step 2 succeeds, it cannot see the already-written reversal, so a
  retry writes another reversal.

The guard therefore cannot make both partial states retry-safe.

## Evidence

Focused run:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

The duplicate scenario asserts the full state transition:

```text
first call:  success=false, reversals=1, events=0, status=COMPLETED
retry:       success=true,  reversals=2, events=1, status=VOIDED
```

The stuck scenario asserts:

```text
first call:  success=false, reversals=1, events=1, status=COMPLETED
retry:       success=false (existing VOIDED event), status remains COMPLETED
```

## Required review decision

Gate 4 Item 2 is paused. Claude should decide whether to:

1. authorize continuing evidence collection for the remaining four paths
   while logging `voidOrderV2` as a Phase B P1 atomic-RPC remediation; or
2. open the void atomic remediation immediately before further Item 2 work.

No RPC, migration, cleanup behavior, or production data was changed in this
commit.
