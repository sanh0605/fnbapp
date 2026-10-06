# Purchasing flow (purchase orders and suppliers)

```flow-decl
routes: /admin/inventory/purchase-orders, /admin/inventory/purchase-orders/new, /admin/inventory/purchase-orders/[id], /admin/inventory/purchase-orders/[id]/cancel, /admin/suppliers, /admin/suppliers/new, /admin/suppliers/[id], /admin/suppliers/[id]/edit
files: lib/purchasing/purchase-order-transaction.ts, app/admin/inventory/purchase-orders/actions.ts, app/admin/suppliers/actions.ts
tables: purchase_orders, purchase_order_lines, purchase_order_edits, Purchase_Sources, assets, Suppliers
brCodes: BR-INV-002, BR-INV-015, BR-INV-016
```

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

**Behaviour change — 2026-10-04 (cash book money flow, migration `0107`):** a purchase order gains "Hình thức thanh toán": Tiền mặt, or Chuyển khoản with a bank account (`purchase_orders.payment_method`, `bank_account_id`). Nothing is pre-selected on a new order; completing an order without a choice is refused ("Chọn cách trả tiền"), a draft may stay undecided (`BR-CASH-001`, answer 1a). Orders that existed when `0107` ran count as cash (answer 3a). A completed order's page lets ADMIN or MANAGER change only these two fields (`setPurchaseOrderPayment`); lines, amounts and stock are untouched. The list gains a "Trả bằng" column and filter (`pay`). The money shows in the cash book as one "Nhập hàng" row per day and method (`docs/03-workflows/cash-book.md`).
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
saved straight as completed, or saved as a draft and completed later. It does not
happen when an already-completed order is edited — see question 5.

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
   shows suppliers; deactivated suppliers are marked inactive rather than removed,
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
   purchases reference. It deliberately does **not** re-derive assets on an
   **edit**: assets are created only when an order first becomes completed, so editing an
   already-completed order does not create, overwrite, or remove the asset rows
   that its original completion produced. It also does not manage what happens to
   an already-created asset when its source order is later edited — that is out of
   scope here and handled (if at all) by the assets flow, not this one.

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
