# Stock issue and adjustment flow

```flow-decl
routes: /admin/inventory/issue-slips, /admin/inventory/stock-adjustments
files: lib/manual-issue-transaction.ts, lib/stock-adjustment-transaction.ts
tables: issue_slips, stock_issues, stock_adjustments
brCodes: BR-COGS-005
```

**Reviewed, no behaviour change — 2026-09-04:** Phase 6 dead-reference cleanup touched a declared source file's comments only (dead docs/... citations repointed or stripped); no logic changed.

This flow covers the two ways stock leaves the warehouse by hand: an **issue slip**
(a worker records materials going out of stock) and a **stock adjustment** (a
manual correction to an on-hand quantity). Both are entered from the admin
inventory screens. Issue slips are one of the paths that generate cost of goods:
cost is measured when goods physically leave stock (`BR-COGS-005`), not at the
moment of sale. Each write runs through an atomic database function, called from
`lib/manual-issue-transaction.ts` (issue slips) and
`lib/stock-adjustment-transaction.ts` (adjustments).

## Five-question current-state description

1. **States, and how each is set.** An issue slip has a single state: recorded.
   Once written it is final — there is no draft and no approval step. To reverse
   its effect a worker records an offsetting slip; the original is never edited or
   deleted. A stock adjustment is likewise a one-shot recorded correction with no
   draft or approval stage.
2. **Buttons per screen, and when to hide them.** The issue-slip screen at
   `/admin/inventory/issue-slips` has a button to create a new slip. The stock
   adjustment screen at `/admin/inventory/stock-adjustments` has a button to
   record a new adjustment. Neither screen offers edit or delete for an entry
   already written, because both are append-only ledgers; a correction is made by
   recording a new entry, so no edit/delete button should ever appear.
3. **What each list contains, and what is excluded.** The issue-slip list shows
   every recorded issue slip, one row per issue. The adjustment list shows every
   recorded quantity correction. Stocktake differences are excluded from both —
   they are a separate cost path booked when a count period is closed, not a
   manual issue or adjustment.
4. **Valid inputs, and what happens outside the range.** Each issue-slip line
   needs a material and a positive quantity; a quantity of zero or a negative
   number is not a valid issue. A stock adjustment records the corrected on-hand
   figure for a material; the correction is stored as entered and takes effect
   immediately, with no draft to revise afterward.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   purchased materials leaving stock by manual action, and manual corrections to
   on-hand quantities. It deliberately does not serve stocktake differences
   (their own closing path) and does not serve sales — a sale does not deduct
   stock at the time of sale (cutover 2026-08-07).

## Where it writes

The issue-slip atomic function writes two tables: `issue_slips` (the slip header)
and `stock_issues` (one row per line of goods leaving stock). The stock adjustment
atomic function writes `stock_adjustments`. The generated map at
`docs/generated/system-map.md` confirms exactly these write relations for the two
declared files.

`lib/stock-adjustment-transaction.ts` calls `submit_stock_adjustment_atomic` and
`approve_stock_adjustment_atomic`. Migrations 0083 and 0084 (Phase C) removed
their `stock_ledger` writes before Phase D dropped the table itself (migration
0096); the current function bodies do not reference `stock_ledger`.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
