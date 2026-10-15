# Purchasing flow (purchase orders and suppliers)

```flow-decl
routes: /admin/inventory/purchase-orders, /admin/inventory/purchase-orders/new, /admin/inventory/purchase-orders/[id], /admin/inventory/purchase-orders/[id]/cancel, /admin/suppliers, /admin/suppliers/new, /admin/suppliers/[id], /admin/suppliers/[id]/edit
files: lib/purchasing/purchase-order-transaction.ts, app/admin/inventory/purchase-orders/actions.ts, app/admin/suppliers/actions.ts
tables: purchase_orders, purchase_order_lines, purchase_order_edits, Purchase_Sources, assets, Suppliers
brCodes: BR-INV-002, BR-INV-015, BR-INV-016
```

**Behaviour change — 2026-10-15 (Kho đợt 2, S1):** saving an order refuses, in Vietnamese and before writing anything, a negative or fractional amount in any money box, a total below 0 after discount and voucher, and a negative line quantity ("Phí vận chuyển không được âm."). A new source name over 100 characters is refused. A duplicate order code from `save_purchase_order_atomic` comes back as "Mã phiếu nhập này đã có rồi. Tải lại trang rồi lưu lại." The order's stored lines, assets, disposals and bands are read fresh, not from the cache. Cancelling an order also refreshes the asset list. Supplier "ID không hợp lệ" has its diacritics. Migration `0123` (ran on the server 2026-10-15, owner approved) adds the matching database checks: the six money columns at or above 0 and line quantity at or above 0 (0 stays legal for a draft's empty box, `BR-UI-009`).

**Behaviour change — 2026-10-15 (Kho đợt 1, K4):** Nguồn nhập hàng is required on the purchase form, and a new source is typed straight into its picker; the "+ Thêm" prompt is gone. `addPurchaseSource` trims the name, refuses a blank one, and returns the existing source when the name is already there. The order page shows the supplier's name, writes "—" for an empty field, and hides Sửa phiếu and Huỷ phiếu with a note when a later stocktake locks the order (`BR-INV-018`, the same check as the cancel page).

**Behaviour change — 2026-10-14 (audit A3a, A7, A8; `BR-INV-018`; migration `0112`, ran on the server 2026-10-14 with the owner's approval):** editing a COMPLETED order now takes the same stock lock as cancelling and is refused when it would leave an item below zero and lower than before; an edit of an order dated on or before the last confirmed stocktake is refused when it changes lines, quantities, amounts, extra costs or the date (compared to the second), naming the stocktake, while notes, invoice code and payment stay editable. Only `ADMIN` may edit a COMPLETED order (`requireOwner()`), drafts and new orders stay `requireAdmin()`. The order's asset rows are written inside `save_purchase_order_atomic` (new argument `p_assets`), so an order and its assets save together; an equipment line with no depreciation band now refuses the whole save instead of saving with a warning.

**Behaviour change — 2026-10-08 (editing a completed order, `BR-COGS-008` "1b", `BR-INV-015` "a"):** editing a completed order now updates the assets it created (`lib/assets/asset-purchase-reconcile.ts`): a deleted line, or a line whose item changed, retires its asset (`INACTIVE`); a changed quantity, price, shipping/voucher/discount or date patches quantity, cost and `acquired_date`; the term follows today's bands only when the unit cost moves; a new equipment line gets a new asset. It is planned before the save: if any asset it would change has a disposal, the whole edit is refused with nothing written. It is applied after the save, as asset creation is. If writing the assets fails, the order stays saved and the form opens the order's page with `?assetWarning=1`, which says the assets were not written; nothing retries it, because a later edit treats that line as an old line and never creates assets for old lines. A completed order is never saved back as a draft: its edit form has no "Lưu nháp" and `savePurchaseOrder` refuses it. A draft's form shows "Huỷ phiếu" (ADMIN, MANAGER). The screens moved to the shared templates (`BR-UI-005`, wave K3): number boxes with comma thousands, the list on `DataList` with the active filter carried back by `returnTo`.

**Behaviour change — 2026-10-06 (owner's screen notes, wave 8a-2):** the order form shows "Hình thức thanh toán" (was "Trả bằng") under the totals box instead of above the lines; the list, the order's page and the cancel page use the same name. "Thành tiền" looks like every other input and "Đơn giá" like computed text. The list's create button reads "Tạo" (`BR-UI-002`). The back arrow returns to the list as last seen, filters kept, and never steps back through history, so detail → cancel → detail no longer loops. What is saved is unchanged.

**Behaviour change — 2026-10-06 (cancel page shows the whole order):** `getPurchaseOrderCancelView` now also reads the order's lines, items, units and source, so `/admin/inventory/purchase-orders/[id]/cancel` lays out like the order's own page: lines and the assets that would stop on the left, the money box (goods, shipping, tax, voucher/discount, total, payment, invoice code, source, notes) and the reason box on the right; on a phone one column, money first. A refused cancel still shows the lines and money. What a cancel checks and writes is unchanged.

**Behaviour change — 2026-10-06 (copy a purchase order, `BR-INV-016`):** an order's page shows "Nhân bản" to ADMIN and MANAGER on any status, cancelled included, while no edit form is open. It opens `/admin/inventory/purchase-orders/new?copyFrom=<code>`, a new, unsaved order filled by `getPurchaseOrderCopySeed` (`lib/purchasing/purchase-order-copy.ts`): supplier, source, notes, lines, extra costs and payment; the transaction time and invoice code only from a cancelled order, blank otherwise; a stopped bank account blank. Nothing is written until "Lưu Nháp" or "Tạo", through the unchanged `savePurchaseOrder`. A draft kept in the browser ("Thêm nhà cung cấp" round trip) wins over the copy.

**Behaviour change — 2026-10-05 (cancel a purchase order, migration `0108`, `BR-INV-015`):**
- **Cancelling.** A draft or completed order can be cancelled by ADMIN or MANAGER from its own page, "Huỷ phiếu", which opens `/admin/inventory/purchase-orders/[id]/cancel`. That page asks for a typed reason (required, 500 characters at most) and has no popup (`BR-DATA-007`).
- **What a cancel does.** The order stays, marked `CANCELLED` ("Đã huỷ") with:
  - the reason;
  - who cancelled it and when (`cancelled_at`, `cancelled_by_id`, `cancelled_by_name`, `cancel_reason`).

  Every stock, cost, profit-and-loss and cash-book reader counts `COMPLETED` orders only, so the order drops out of all of them. Assets made from its lines become `INACTIVE`.
- **When a cancel is refused** (`purchase_order_cancel_check`, one check for the page and the cancel):
  - the order is dated on or before the last confirmed stocktake;
  - any item's stock would go below zero at any moment since the order;
  - any of its assets has a disposal.
- **Concurrency.** `cancel_purchase_order_atomic` takes the stock writers' lock and the order's row lock before checking, so an issue slip saved at the same instant waits.
- **Editing.** A cancelled order is never edited: the action refuses it, and so does `save_purchase_order_atomic`.
- **Line ids.** From this change an edit keeps each line's id, matched by item in order, so assets made from a line stay linked to it. Before, every save minted new line ids.

**Behaviour change — 2026-10-04 (cash book money flow, migration `0107`):** a purchase order gains "Hình thức thanh toán": Tiền mặt, or Chuyển khoản with a bank account (`purchase_orders.payment_method`, `bank_account_id`). Nothing is pre-selected on a new order; completing an order without a choice is refused ("Chọn cách trả tiền"), a draft may stay undecided (`BR-CASH-001`, answer 1a). Orders that existed when `0107` ran count as cash (answer 3a). A completed order's page let ADMIN or MANAGER change only these two fields; lines, amounts and stock were untouched. **Changed 2026-10-14** (owner, on PO-203: *"Chỉ được đổi trong trang sửa phiếu"*): the order's page only shows how it was paid; the payment changes in Sửa phiếu like every other field, so only ADMIN can change it, and the separate server action was removed. The list gains a "Trả bằng" column and filter (`pay`). The money shows in the cash book as one "Nhập hàng" row per day and method (`docs/03-workflows/cash-book.md`).
**Reviewed — 2026-10-08 (`BR-UI-008`):** the supplier form's links-limit message in `app/admin/suppliers/actions.ts` now writes `2,000 ký tự` (comma thousands); the limit itself is unchanged.
**Reviewed, no behaviour change — 2026-09-07 (Task 11):** a declared source file's import path only -- lib/auth.ts moved to `lib/auth/auth.ts`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 10):** a declared source file's import path only -- cross-cutting lib/ helpers (action-error, datetime, dialog, duplicate-name-guard, use-filter-form, nav-completeness, client-error-report, report-time) moved to `lib/shared/`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 9):** a declared source file's import path only -- sheets_db.ts/supabase.ts/shared-actions.ts/backup-restore.ts moved to `lib/db/` (spec D6), rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-04:** Phase 6 dead-reference cleanup touched a declared source file's comments only (dead docs/... citations repointed or stripped); no logic changed.

This flow covers buying goods into the shared warehouse: recording a **purchase
order** (what was bought, from whom, at what price) and maintaining the
**suppliers** the shop buys from. A purchase order is entered from
`/admin/inventory/purchase-orders/new`, listed at
`/admin/inventory/purchase-orders`, and reopened for edit at
`/admin/inventory/purchase-orders/[id]`. Suppliers are managed at
`/admin/suppliers`.

The header and all its lines are saved together through one atomic database
function (`save_purchase_order_atomic`), called from
`lib/purchasing/purchase-order-transaction.ts`. Purchase orders are exactly the kind of
critical multi-row write that must never partially succeed (`BR-INV-002`): either
the order and every line land, or nothing does.

**Receiving a purchase raises stock.** A completed purchase order is the shop's
"goods in" event — the quantities on its lines become on-hand stock, and their
prices are what the weighted-average cost is computed from. Costing replays the
full purchase history for each item (`lib/costing/issue-costing.ts`): every completed
purchase adds its quantity and its money, so the average unit cost used when
goods later leave stock is driven by these purchase prices.

**Durable tools bought on a purchase order create `assets` rows.** When a new
order is completed, its equipment lines are turned into asset records: the action
plans the assets (`lib/assets/asset-purchase-allocation.ts`) and inserts one `assets`
row per durable tool. This happens the first time an order becomes completed:
saved straight as completed, or saved as a draft and completed later. Editing an
already-completed order updates those assets instead (2026-10-08, see the top).

**Behaviour change — 2026-10-03:** a draft order completed later now creates its
assets too. Before, only an order saved straight as completed did, so a draft
completed later left its equipment out of depreciation. Measured that day: 83
equipment lines on completed orders, all 83 with an asset, so no past order was
affected.

## Five-question current-state description

1. **States, and how each is set.** A purchase order has three states: `DRAFT` and
   `COMPLETED`, set by the `status` field on save, and `CANCELLED`, set only by
   `cancel_purchase_order_atomic` from the cancel page (`BR-INV-015`, see the top). A draft is a work-in-progress
   order that has not yet brought goods in. Completing an order (`status` =
   `COMPLETED`) is what makes it a real receipt: it requires a supplier, a
   purchase source, and at least one line, and it is the moment stock is raised
   and assets are created. There is no separate "received" state beyond
   `COMPLETED`; a purchase order carries no per-line edit history of its own
   (unlike sales orders' `order_events`) — instead each edit is recorded as a row
   in `purchase_order_edits`.
2. **Buttons per screen, and when to hide them.** The purchase-order list at
   `/admin/inventory/purchase-orders` offers a button to create a new order
   (leading to `/admin/inventory/purchase-orders/new`) and a way to open an
   existing order at `/admin/inventory/purchase-orders/[id]`. An order's page offers "Nhân bản" (ADMIN, MANAGER; hidden while its form
   is open), leading to `/admin/inventory/purchase-orders/new?copyFrom=<code>` (`BR-INV-016`). The order form can
   save as draft or save as completed; the "save as completed" path should not be
   offered until a supplier, a source, and at least one line are present, since
   the action rejects a completed order missing any of them. Adding a supplier
   from the order form saves the order's draft to browser storage, navigates to
   `/admin/suppliers/new?from=po`, and restores the in-progress order with the
   new supplier selected upon return (`BR-DATA-007`). The suppliers screen
   at `/admin/suppliers` offers add and edit, each on its own page
   (`/admin/suppliers/new`, `/admin/suppliers/[id]/edit`, `BR-DATA-007`; the list's
   filters ride in the URL and come back after Lưu), and delete, confirmed in a box.
   The form has no status field: nothing on screen sets a supplier to "Ngừng hợp tác"
   (checked 2026-10-01; all 48 suppliers ACTIVE). Asked whether to add one, the owner
   chose to drop the list's status filter instead (2026-10-01, *"1b"*). Delete is ADMIN-only per `BR-ACCESS-003` (owner
   decision 2026-09-08, `requireOwner`), with the button hidden for anyone else
   (`canDelete` computed from `resolveActor()` in `page.tsx`).
3. **What each list contains, and what is excluded.** The purchase-order list
   shows drafts and completed orders by default ("Chưa huỷ", `status=ACTIVE`);
   cancelled orders show under "Đã huỷ" or "Tất cả". The suppliers list
   shows every supplier. There is no "Ngừng dùng" yet (2026-10-15; owner question Q3
   of `docs/superpowers/specs/2026-10-15-kho-de-xuat.md`): `ADMIN` may delete a
   supplier with no order, and the foreign key refuses the rest,
   so a supplier that historical orders still reference is never dropped from the
   data. Purchase **sources** (`Purchase_Sources`) are a small lookup of buying
   channels used to tag an order; they are maintained inline from the order form,
   not as a separate top-level screen.
4. **Valid inputs, and what happens outside the range.** Each order line needs a
   purchased item and a positive quantity and price; a completed order with no
   lines, no supplier, or no source is refused. Supplier fields are length-bound
   (name up to 120 characters, phone up to 32, tax code up to 64, address up to
   500, notes/links up to 2.000); a value over its limit is rejected with a
   message, and a new supplier whose active name duplicates an existing one is
   blocked. Because the whole order is one atomic write, a persisted line-count
   that does not match the submitted lines is treated as a failure and the save
   is reported as an error rather than silently accepted.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   purchases into the shared warehouse and the supplier and source records those
   purchases reference. On an edit of a completed order it re-derives the assets
   that order created (2026-10-08), but never creates an asset for an old line
   whose item became equipment after the purchase, and never touches an asset
   with a disposal: such an edit is refused.

## Where it writes

The atomic function writes the order header (`purchase_orders`) and one row per
line (`purchase_order_lines`). The purchase-orders action additionally writes
`assets` (one row per durable tool on an order that has just become completed),
`purchase_order_edits` (the edit trail, since purchase orders keep no
`order_events`), and `Purchase_Sources` (the buying-channel lookup). The
suppliers action writes `Suppliers`. The generated map at
`docs/generated/system-map.md` confirms exactly these write relations for the
three declared files.

`lib/purchasing/purchase-order-transaction.ts` runs the RPC `save_purchase_order_atomic`.
Migration 0078 (Phase C) removed that function's `stock_ledger` write before
Phase D dropped the table itself (migration 0096); the current function body
does not reference `stock_ledger`. `BR-INV-001` (the old "quantity movement
belongs in the stock ledger" rule) was retired in favour of the issue-based
cost path (`BR-COGS-005`).

> Reviewed, 2026-09-29: the list page calls getPurchaseOrdersPage to support server-side search, filters by status, supplier, and whole Saigon days; it sorts newest slip first, shows 20 per page, and tracks the page number in the URL.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
