# Stock issue flow

```flow-decl
routes: /admin/inventory/issue-slips, /admin/inventory/issue-slips/[id]
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

**Updated 2026-09-29 (Phiếu xuất step 4a, `docs/superpowers/plans/2026-09-29-phieu-xuat.md`):**
`lib/stock/manual-issue-transaction.ts` gains `editIssueSlipAtomic`, which calls
`edit_issue_slip_atomic` (migration `0106`, not yet applied to the server when
written). Rules: `BR-INV-009`, `BR-INV-012`, `BR-INV-013`. Nothing is deleted:
every correction is a compensating `stock_issues` row.

1. **States, and how each is set.** Derived, not stored (`lib/stock/issue-slip-status.ts`):
   - *Active*: at least one line not reversed.
   - *Cancelled*: every line reversed (by "Huỷ phiếu"); the reason is read from the reversal note.
   - *Locked*: dated on or before the latest confirmed stocktake; it can no longer be edited or cancelled.
2. **Buttons per screen, and when to hide them.** The list page links to each slip and to "Tạo phiếu xuất". (Built in step 4a: the list page and the detail page `[id]`; the create page `/new` follows in the same plan's next UI task.)
   - The detail page has "Chỉnh sửa" and "Huỷ phiếu", both hidden when the slip is cancelled or locked.
   - The server refuses them anyway (`issue_slip_stocktake_lock`, cancelled-slip check).
3. **What each list contains, and what is excluded.** One row per slip plus one row per confirmed stocktake with a shortfall (`BR-INV-012`). Cancelled slips are hidden unless the type filter is "Đã huỷ".
4. **Valid inputs, and what happens outside the range.** Each line needs a material and a positive quantity.
   - A line dated in the past must not push stock below zero at any moment from its date to now (`issue_stock_headroom`); otherwise the save is refused with the lowest balance.
   - What each edit writes:
     - A quantity change returns the old line on the slip's own date.
     - "Xoá" on a line returns it today.
     - "Huỷ phiếu" returns every line today.
   - A new slip cannot be dated on or before the latest confirmed stocktake.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   purchased materials leaving stock by manual action. It deliberately does not
   serve stocktake differences (their own closing path), does not serve
   corrections to on-hand quantities (a stocktake does that), and does not serve
   sales — a sale does not deduct stock at the time of sale (cutover 2026-08-07).

## Where it writes

Creating a slip writes two tables: `issue_slips` (the slip header) and
`stock_issues` (one row per line of goods leaving stock). Editing, cancelling
and reversing write only `stock_issues` (compensating and added rows); the slip
header is locked during an edit but never changed. The generated map at
`docs/generated/system-map.md` confirms exactly these write relations for the
declared file.

> Measured against source: 2026-09-28 — via docs/generated/system-map.md
