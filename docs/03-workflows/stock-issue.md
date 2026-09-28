# Stock issue flow

```flow-decl
routes: /admin/inventory/issue-slips
files: lib/stock/manual-issue-transaction.ts
tables: issue_slips, stock_issues
brCodes: BR-COGS-005
```

**Reviewed — 2026-09-28:** the stock adjustment screen, its three server actions,
the adjustment transaction module and the `stock_adjustments` table are
removed (`docs/superpowers/plans/2026-09-28-go-10-bang-bo-hoang.md`, migration
`0105`). The table held 0 rows when measured on 2026-09-28; nothing that
produced a number used it.
**Reviewed, no behaviour change — 2026-09-07 (Task 9):** a declared source file's import path only -- sheets_db.ts/supabase.ts/shared-actions.ts/backup-restore.ts moved to `lib/db/` (spec D6), rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-04:** Phase 6 dead-reference cleanup touched a declared source file's comments only (dead docs/... citations repointed or stripped); no logic changed.

This flow covers the one way stock leaves the warehouse by hand: an **issue
slip** (a worker records materials going out of stock). It is entered from the
admin inventory screens. Issue slips are one of the paths that generate cost of
goods: cost is measured when goods physically leave stock (`BR-COGS-005`), not
at the moment of sale. Each write runs through an atomic database function,
called from `lib/stock/manual-issue-transaction.ts`.

## Five-question current-state description

1. **States, and how each is set.** An issue slip has a single state: recorded.
   Once written it is final — there is no draft and no approval step. To reverse
   its effect a worker records an offsetting slip; the original is never edited or
   deleted.
2. **Buttons per screen, and when to hide them.** The issue-slip screen at
   `/admin/inventory/issue-slips` has a button to create a new slip. It offers no
   edit or delete for a slip already written, because slips are an append-only
   ledger; a correction is made by recording a new entry, so no edit/delete
   button should ever appear.
3. **What each list contains, and what is excluded.** The issue-slip list shows
   every recorded issue slip, one row per issue. Stocktake differences are
   excluded — they are a separate cost path booked when a count period is
   closed, not a manual issue.
4. **Valid inputs, and what happens outside the range.** Each issue-slip line
   needs a material and a positive quantity; a quantity of zero or a negative
   number is not a valid issue.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   purchased materials leaving stock by manual action. It deliberately does not
   serve stocktake differences (their own closing path), does not serve
   corrections to on-hand quantities (a stocktake does that), and does not serve
   sales — a sale does not deduct stock at the time of sale (cutover 2026-08-07).

## Where it writes

The issue-slip atomic function writes two tables: `issue_slips` (the slip header)
and `stock_issues` (one row per line of goods leaving stock). The generated map at
`docs/generated/system-map.md` confirms exactly these write relations for the
declared file.

> Measured against source: 2026-09-28 — via docs/generated/system-map.md
