# Gate 5 POS Draft Retry Check

Date: 2026-07-19

Scope: Gate 5, Step 3 (read-only review)

Verdict: Accept current behavior; no draft idempotency change required.

## Evidence

- `savePOSDraft` requires an authenticated actor before reading or mutating storage.
- A save with an existing draft ID updates that same row. It does not overwrite another draft.
- A save without an ID creates a new `drf-<uuid>` row.
- After the first successful save, `POSScreen` stores the returned ID in `activeDraftId`; later saves of that loaded cart pass the same ID and update the same draft.
- Loading a draft sets `activeDraftId` to that draft's ID. Deleting the active draft clears the ID.
- Targeted authentication coverage passed: `app/pos/actions.auth.test.ts` (8/8).

## Retry assessment

| Scenario | Result | Risk |
|---|---|---|
| Retry after the first response was received | Same ID is supplied; the existing draft is updated | No duplicate |
| Save a genuinely new cart with no active draft | A new UUID-backed draft is inserted | Expected |
| Ambiguous response loss on the first-ever save | The browser has not received the generated ID; a manual retry can create a second draft | Low-stakes clutter only |
| Caller supplies an ID that no longer exists | That ID is inserted as a new draft | Restores the caller's draft identity; does not overwrite another row |

The only duplicate window is an ambiguous response loss before the browser learns the first generated draft ID. A duplicate draft has no revenue, COGS, or stock-ledger effect and can be ignored or deleted by the cashier. Adding a separate draft idempotency protocol would add complexity without addressing a financial or inventory correctness risk.

## Decision

Keep the current draft implementation unchanged. Checkout idempotency remains limited to completed POS orders, where duplicate execution would otherwise duplicate revenue and inventory consumption.
