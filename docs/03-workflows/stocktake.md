# Stocktake flow

```flow-decl
routes: /admin/inventory/stocktake
files: lib/stocktake-transaction.ts
tables: stocktake_sessions, stocktake_lines, stock_issues
brCodes: BR-INV-007, BR-COGS-007
```

This flow covers the periodic physical count. Staff open a count session, walk the
shelves recording how much of each material is on hand, and close the session.
Counting follows one strict rule: **only sealed packages are counted**
(`BR-INV-007`). A package that has already been opened is not counted and not
estimated — its contents are treated as already expensed. When a session is
closed, the difference between what the count found and what stock records expected
is booked as cost of goods: a shortfall becomes one or more rows in `stock_issues`
with `source` set to `STOCKTAKE`. Every write runs through an atomic database
function called from `lib/stocktake-transaction.ts`.

## Five-question current-state description

1. **States, and how each is set.** A count session moves through open → counting
   → closed. It is set to open when a worker starts a new count from the stocktake
   screen; during counting the session collects one line per material counted; it
   becomes closed when the worker finalises it, which is the step that computes and
   books the difference. A closed session is final — there is no re-open. To correct
   a mistake after closing, a new session is started.

2. **Buttons per screen, and when to hide them.** The stocktake screen at
   `/admin/inventory/stocktake` has a button to start (open) a new session, entry
   fields to record the counted quantity per material while a session is open, and a
   button to close the session. The close button should not be available until a
   session is open, and starting a new session should not be offered while one is
   still open — the two states are mutually exclusive, so only the button matching
   the current state should show.

3. **What each list contains, and what is excluded.** The session's count list
   holds one line per material being counted, stored in `stocktake_lines`. Only
   materials whose stock is tracked appear; materials bought for immediate use are
   excluded, because a sealed pack of them never sits on a shelf to be counted
   (`BR-INV-007`, `BR-COGS-007`). Opened packages are also excluded from the count
   figure — the count reflects sealed stock only.

4. **Valid inputs, and what happens outside the range.** Each count line accepts a
   non-negative counted quantity for its material. Zero is valid (nothing sealed
   left on the shelf). The closing step compares the counted figure against the
   expected on-hand figure; a count lower than expected is a shortfall and is booked
   as cost, while a count higher than expected means sealed stock thought consumed
   has reappeared and reduces the recognised shortfall.

5. **Which data it serves, and which it deliberately does not.** This flow serves
   the periodic reconciliation of tracked, sealed materials against their recorded
   on-hand quantities, and turns the resulting shortfall into cost of goods. It
   deliberately does not count opened packages, does not estimate partial contents,
   and does not serve materials bought for immediate use. It is one of two cost-of-
   goods paths (the other being manual issue slips) and must not be confused with a
   manual issue: a stocktake difference is booked only at session close.

## How a closed count becomes cost

Closing a session writes the count itself to `stocktake_sessions` (the session
header) and `stocktake_lines` (one row per counted material), and books the
shortfall as `stock_issues` rows carrying `source = STOCKTAKE`. This is what
separates a stocktake cost from a manual issue slip, which carries `source =
MANUAL` in the same table. The generated map at `docs/generated/system-map.md`
confirms exactly these write relations for the declared file.

**A gap is loss only when the period had issue slips.** A stocktake difference is
recognised as shrinkage only if the period being closed also recorded manual issue
slips (`BR-COGS-007`). Without issue slips there is no baseline of expected
consumption to compare the count against, so the raw difference is not, on its own,
proof of loss.

**The first count carries months of accumulated difference.** The earliest count
period reconciles everything that happened before it, so its shortfall bundles
many months of accumulated difference rather than the loss of one period; see
`docs/superpowers/specs/2026-09-02-project-reset-design.md` (§10). Later periods
compare against the previous close and reflect only their own interval.

**Known stale tooling:** `lib/stocktake-transaction.ts` also still writes
`stock_ledger`, which is a dropped table (Phase D removed `stock_ledger` and
`inventory_balances`). That write no longer feeds any live figure and is left in
the RPC as leftover tooling; it is not part of this flow's declared tables.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
