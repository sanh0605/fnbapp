# Stocktake flow

```flow-decl
routes: /admin/inventory/stocktake, /admin/inventory/stocktake/[id], /admin/inventory/stocktake/[id]/edit, /admin/inventory/stocktake/[id]/cancel
files: lib/stock/stocktake-transaction.ts
tables: stocktake_sessions, stocktake_lines, stock_issues
brCodes: BR-INV-007, BR-COGS-007, BR-INV-010, BR-INV-011, BR-INV-012, BR-INV-022
```

**Behaviour change — 2026-10-15 (Kiểm kê rebuilt, `BR-INV-022`):** `/admin/inventory/stocktake` lists every session (code, time, state, lines counted, shortfall and found value apart, "tạm tính" while open); `/[id]` is the counting screen for an open session (tabs Tất cả / Chưa đếm / Lệch / Khớp, accent-blind search, lines grouped by Phân loại hàng) and the detail page otherwise; undoing is the page `/[id]/cancel`, no popup. Phiếu xuất no longer lists stocktake rows. The six database functions are unchanged; `getLastConfirmedStocktakeSession` is removed.

**Behaviour change — 2026-10-15 (Kho đợt 1, K1):** the stocktake actions' refusals are in Vietnamese (counts changed since the preview, no preview yet, another count already open). Migration `0122` (ran on the server 2026-10-15, owner approved) makes editing a confirmed count refuse a change that would leave an item below zero on any day after the count, using `issue_stock_headroom`.

**Behaviour change — 2026-10-14 (`BR-INV-017`, migration `0115`, ran on the server 2026-10-14, owner approved "Chạy cả 4"):** preview and confirm work each counted line's book out again as of its `counted_at` (a reversal row counts from its original's date) and return `recomputedLines`; the preview lists each line whose figure changed under "Số trên sổ đã tính lại theo giờ đếm", and confirm stores the recomputed figure in `theoretical_at_count`.

**Behaviour change — 2026-10-14 (audit A1; migration `0111`, ran on the server 2026-10-14 with the owner's approval):** undoing a confirmed stocktake is refused when taking found-at-count goods back out would leave an item below zero, naming the item.

**Behaviour change — 2026-10-14:** the owner can correct the counts of the most recent confirmed
session (`BR-INV-012`). Each confirmed session now has its own page listing every line; the
owner's edit page rewrites the changed lines and their `stock_issues` rows in place, still dated
at the original confirm time, through `edit_confirmed_stocktake_atomic` (migration 0110).

**Reviewed, no behaviour change — 2026-09-07 (Task 11):** a declared source file's import path only -- lib/auth.ts moved to `lib/auth/auth.ts`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 9):** a declared source file's import path only -- sheets_db.ts/supabase.ts/shared-actions.ts/backup-restore.ts moved to `lib/db/` (spec D6), rewritten by the move helper; no logic changed.

This flow covers the periodic physical count. Staff open a count session, walk the
shelves recording how much of each material is on hand, and close the session.
Counting follows one strict rule: **only sealed packages are counted**
(`BR-INV-007`). A package that has already been opened is not counted and not
estimated — its contents are treated as already expensed. When a session is
closed, the difference between what the count found and what stock records expected
is booked as cost of goods: a shortfall becomes one or more rows in `stock_issues`
with `source` set to `STOCKTAKE`. Every write runs through an atomic database
function called from `lib/stock/stocktake-transaction.ts`.

## Five-question current-state description

1. **States, and how each is set.** A count session moves through open → counting
   → closed. It is set to open when a worker starts a new count from the stocktake
   screen; during counting the session collects one line per material counted; it
   becomes closed when the worker finalises it, which is the step that computes and
   books the difference. A closed session is never re-opened for counting. The owner
   (role `ADMIN` only) can correct its counts on its edit page while it is the most
   recent confirmed session and no other session is open; the corrected shortfall
   stays on the original count date (`BR-INV-012`). An open session can instead be
   cancelled by the owner or a manager, which deletes it and its counted lines
   outright; no cancelled state is kept (`BR-INV-010`).

2. **Buttons per screen, and when to hide them.** The list at
   `/admin/inventory/stocktake` has "Tạo phiên kiểm kê", disabled with the open
   session's code and a link while one is open. An open session's page
   `/admin/inventory/stocktake/[id]` holds the count boxes, "Xem trước" then an
   inline yes/no "Xác nhận", and "Huỷ phiên" (inline yes/no). A confirmed session's own page at
   `/admin/inventory/stocktake/[id]` lists its lines and shows "Sửa số đếm" and "Hoàn tác"
   (to the page `/[id]/cancel`) only to the owner, only on the newest confirmed session; otherwise the owner sees one grey line saying
   why. The edit page has one number box per line, Lưu and Bỏ, no reason box and no
   confirmation popup.

3. **What each list contains, and what is excluded.** The session's count list
   holds one line per material being counted, stored in `stocktake_lines`. Only
   materials whose stock is tracked appear; materials bought for immediate use are
   excluded, because a sealed pack of them never sits on a shelf to be counted
   (`BR-INV-007`, `BR-COGS-007`). Opened packages are also excluded from the count
   figure — the count reflects sealed stock only.

4. **Valid inputs, and what happens outside the range.** Each count line accepts a
   non-negative counted quantity for its material. Zero is valid (nothing sealed
   left on the shelf). A line left blank is not zero: it means the item was not
   checked, and closing the session leaves that item's book quantity untouched
   (`BR-INV-011`). The closing step compares the counted figure against the
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
`BR-COGS-007` (the first count, 2026-08-09). Later periods
compare against the previous close and reflect only their own interval.

`lib/stock/stocktake-transaction.ts` calls `reverse_stocktake_session_atomic` among
others. Migration 0082 (Phase C) removed that function's `stock_ledger` write
before Phase D dropped the table itself (migration 0096); the current function
body does not reference `stock_ledger`.

A session carries no free-text note and a line carries no item type: the code stopped reading `stocktake_sessions.notes` and `stocktake_lines.item_type` (every line is a purchased item); migration 0136 drops both columns (written 2026-10-17, not yet run).

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
