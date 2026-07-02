# MAC Ledger Index Performance Design

Date: 2026-07-02
Owner: Codex
Status: Approved by user

## Problem

P&L currently takes about 18 seconds in the CLI benchmark while the sales
report takes less than one second. Raw database reads account for only a few
seconds.

The remaining hot path repeatedly calls `getMacUnitCostWithRecipeFallback`.
Each call copies, filters, and sorts the complete stock ledger for one item.
The P&L breakdown invokes this path for many ingredients across many order
lines, producing repeated work that does not change the result.

## Goal

Reduce P&L processing time without changing:

- MAC valuation rules.
- Recipe fallback rules.
- The stored `Order_Lines_V2.cost_at_sale` contract.
- Inventory quantity calculations.
- Public behavior used by POS, order editing, and audit scripts.

The target is a P&L benchmark below two seconds when practical. Correctness is
the hard gate: performance improvements must not introduce any P&L MAC delta.

## Design

Add a `MacLedgerIndex` that groups ledger entries by `item_reference` and sorts
each group by `created_at` once.

The MAC engine will accept either:

- The existing flat `MacLedgerEntry[]` input for backward compatibility.
- A prebuilt `MacLedgerIndex` for repeated report calculations.

Report paths will build one index after loading the ledger and reuse it for all
MAC lookups. A lookup will scan only the already-sorted rows for the requested
item. Recipe fallback will reuse the same index recursively.

The index is immutable by contract for the duration of one calculation. Code
that mutates or extends a ledger must create a new index.

## API Boundary

The engine will expose a small index-construction function. Existing public
MAC functions retain their current behavior and parameter order, with the
ledger parameter widened to accept the indexed source.

No global cache or `WeakMap` memoization will be introduced. Explicit
construction keeps request lifetime and invalidation visible to callers.

## Correctness

Tests must compare flat-ledger and indexed-ledger results for:

- Multiple cost receipts at different times.
- Consumption between receipts.
- Zero or negative stock fallback to latest known MAC.
- Semi-product recipe fallback.
- As-of timestamps before and after later ledger rows.

The P&L consistency audit must remain at zero delta. Historical MAC drift is a
separate data-recovery concern and will not be modified by this change.

## Performance Verification

Verification will include:

1. A deterministic engine benchmark demonstrating that indexed repeated
   lookups avoid full-ledger filtering and sorting.
2. The existing live `scripts/benchmark-shim.ts` P&L measurement before and
   after the change.
3. Full Vitest and TypeScript verification.
4. `scripts/audit-pnl-mac-consistency.ts` with zero delta.

If P&L remains above two seconds after MAC indexing, follow-up profiling will
measure the separate inventory-balance reconstruction path. That work is out
of scope for this phase.

## Alternatives Rejected

### Implicit memoization by array identity

This requires fewer caller changes but can return stale results if a ledger
array is mutated. Cache lifetime would also be hidden.

### Precomputed MAC timeline with binary search

This can make each as-of lookup faster, but it changes more engine behavior and
adds complexity before grouping has been measured. It remains a possible
follow-up only if the simpler index does not meet the target.
