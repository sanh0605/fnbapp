# P&L Request-Scoped MAC Ledger Index

## Goal

Build the item-grouped MAC ledger index once per P&L request and reuse it for
both COGS breakdowns while preserving every existing total and allocation.

## Scope

The request-scoped index is shared by:

- `breakdownCOGSByIngredient` in `lib/report-v2-allocators.ts`.
- `splitLineCogsBySaleSource` in `app/admin/reports/actions.ts`.

POS checkout is excluded because it uses the compact
`get_pos_inventory_state` RPC and does not build a MAC ledger index.

## Design

`getPnLDataV2` creates one `MacLedgerIndex` from the request's stock-ledger
snapshot. It passes that exact object to `breakdownCOGSByIngredient` and
`splitLineCogsBySaleSource`.

Both allocators continue to build their own chronological ledger view for the
running inventory-balance window. They use the injected index only for MAC
lookups and never rebuild it.

`createMacLedgerIndex` remains the public construction API in
`lib/mac-cogs.ts`; renaming it would add unrelated churn for its other users.

There is no module-scoped mutable state, content hash, reset API, or
cross-request reuse.

## Correctness

The index and both allocators use the same ledger snapshot loaded by the
request. A later request receives a new snapshot and creates a new index.
Reusing the request-scoped index does not mutate the ledger or index.

Tests cover:

- Raw-ledger and indexed MAC result parity.
- Repeated MAC lookups do not rescan unrelated ledger rows.
- Both P&L allocators consume one shared index build.
- Existing product, topping, and ingredient COGS allocations remain unchanged.

The benchmark isolates two independent index builds against one request-scoped
build. It also compares complete P&L results across repeated live runs before
reporting success.

## Operational Boundaries

- No UI files change.
- No data is written.
- The implementation and verification diff is sent for Claude review before
  commit.
- No push is performed.
