# Sales flow (POS, orders, promotions)

```flow-decl
routes: /pos, /admin/orders, /admin/orders/[id], /admin/orders/[id]/edit, /admin/orders/[id]/void, /admin/promotions, /admin/promotions/new, /admin/promotions/[id], /admin/promotions/[id]/edit
files: app/pos/actions.ts, lib/sales/void-order-transaction.ts, app/admin/promotions/actions.ts
tables: POS_Drafts, Pos_Sync_Failures, orders_v2, order_events, Promotions
brCodes: BR-SALE-002, BR-SALE-003, BR-SALE-004, BR-SALE-005, BR-SALE-006
```

**Behaviour change — 2026-10-15 (Bán hàng đợt 2, design in `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`):**
- Huỷ đơn is its own page, `/admin/orders/[id]/void`, with a required reason, instead of a popup (`BR-DATA-007`). The page refuses an order that is not COMPLETED, and so does `voidOrderV2`; the database stays idempotent for a retry.
- `voidOrderV2` answers in Vietnamese and no longer passes raw database text.
- The order list has a "Trạng thái" filter (Hoàn tất, the default, or Đã huỷ, which shows each order's reason). Voided orders never count in the total.
- The payment filter no longer puts every matching order id in the request. It matches `payment_method` and adds only the orders paid two ways.
- The list and detail pages use the shared list and detail template. Dates show seconds, and event names read Tạo, Sửa, Huỷ, Chuyển dữ liệu cũ.
- Removed: the dead "#" order-code branch.

**Behaviour change — 2026-10-15 (`BR-SALE-014`):** Sửa đơn becomes "Đổi cách trả" (`/admin/orders/[id]/edit`), which changes only the payment parts.
- `changeOrderPayments` in `order-edit-actions.ts` copies the old row and its lines unchanged into the new version: same seller, promotion, prices, names and total. It never reads the catalogue.
- The new version's parent is the order it replaces, as `supersede_order_v2_atomic` requires. So an order can now be changed more than once, and the order page lists every version by walking that chain.
- The messages "Không tìm thấy đơn" and, on a version clash, "Đơn vừa được người khác sửa…" are in Vietnamese.
- The line, add-dish and discount editors are gone. A wrong dish is fixed by Huỷ đơn and ringing the order again.

**Behaviour change — 2026-10-14 (audit B1, B4, C2, C6, C7, C13, E12):** an order's payment method follows one rule everywhere (`lib/sales/payment-method.ts`): empty is cash, and an order paid two ways is found under both methods through `order_payments` (Doanh số no longer shows "UNKNOWN"). Doanh số's hour map applies the staff and dish-group filters. The till resends waiting orders every 60 seconds and after each checkout, never two sends at once, and shows "N đơn chờ gửi"; a per-dish promotion code applies; loading a draft first waits for the current cart to save and stops with a message if it cannot. The server refuses a zero, negative or fractional quantity and a negative dish discount. Sửa đơn checks `ADMIN` before reading the order.

**Behaviour change — 2026-10-14 (`BR-UI-004`):** the Đơn hàng list shows a total row under the column titles, "Tổng (không tính huỷ)", the net total of every order the filter keeps, not only the page shown (`sumFilteredOrders` in `app/admin/orders/actions.ts`); cancelled orders are left out (`BR-ACCESS-003`). The order actions are split into `order-detail-actions.ts`, `order-edit-actions.ts`, `order-void-actions.ts` and `order-helpers.ts` with no logic change. `app/pos/actions.ts` comment only: it now points at `app/admin/reports/pnl-actions.ts`.

**Behaviour change — 2026-10-03 (list/detail template, wave 5):** `/admin/promotions` is a
table on desktop (cards before) and cards on phone; each row opens
`/admin/promotions/[id]`, which lists the dishes and sizes a dish discount applies to, and
editing starts only from there. Times read in Asia/Saigon (the old cards used the browser's
zone). "Áp dụng" counts dishes and sizes; the old card's "(N món)" counted sizes. The bin
"Xoá" is ADMIN-only, as before.
**Reviewed, no behaviour change — 2026-10-06:** `app/pos/actions.ts` comment only -- a pointer to a deleted plan now names `BR-CATALOG-003`; no logic changed.

**Reviewed, no behaviour change — 2026-09-08:** `app/pos/actions.ts` changed
(`getPOSBestSellerProductIds` now excludes standalone toppings from quick-add
via the real `modifiers.product_id` join, BR-CATALOG-003). Nothing this doc
describes -- `POS_Drafts`, `Pos_Sync_Failures`, the order write path -- is
touched; quick-add best-seller ranking is read-only and outside this flow's
scope.
**Reviewed, no behaviour change — 2026-09-07 (Task 21):** a declared source file's comment path reference only -- components/POSScreen.tsx moved to `app/pos/components/POSScreen.tsx`, comment updated by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 18):** a declared source file's import path only -- lib/report-v2-allocators.ts moved to `lib/reports/`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 11):** a declared source file's import path only -- lib/auth.ts moved to `lib/auth/auth.ts`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 10):** a declared source file's import path only -- cross-cutting lib/ helpers (action-error, datetime, dialog, duplicate-name-guard, use-filter-form, nav-completeness, client-error-report, report-time) moved to `lib/shared/`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 9):** a declared source file's import path only -- sheets_db.ts/supabase.ts/shared-actions.ts/backup-restore.ts moved to `lib/db/` (spec D6), rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-04:** Phase 6 dead-reference cleanup touched a declared source file's comments only (dead docs/... citations repointed or stripped); no logic changed.

This flow covers selling: the till screen at `/pos` where an order is built and
sent, the order history at `/admin/orders`, and the promotion catalog at
`/admin/promotions`. The key thing to understand is that **the web app is not
where a completed sale is written.** The `/pos` screen only persists drafts and
records a failure marker when a submit does not go through; the finished,
`COMPLETED` order arrives in `orders_v2` through the POS device sync, not through
these server actions. Voids are the one order-lifecycle write the web app makes,
and they run through the `void_order_atomic` database function called from
`lib/sales/void-order-transaction.ts`.

## Five-question current-state description

1. **States, and how each is set.** An order in `orders_v2` is versioned, not
   overwritten. A fresh sale is `COMPLETED`. Editing an order does **not** mutate
   the existing row: it writes a **new** `COMPLETED` row and flips the previous
   one to `SUPERSEDED`, and **both versions keep the same order code**
   (`BR-SALE-002`, `BR-SALE-006`). So one order code can map to several rows, exactly one of
   which is the live `COMPLETED` version (its `superseded_by` empty). A void marks
   the order voided and books the matching inventory effect through
   `void_order_atomic`, leaving an event trail rather than a silent status flip
   (`BR-SALE-003`). A POS draft (`POS_Drafts`) is a separate, pre-sale state: open
   while the cashier is still building the cart, deleted once the cart is sent.
2. **Buttons per screen, and when to hide them.** `/pos` builds a cart, saves and
   restores drafts, and sends the order; its brand is derived server-side from the
   chosen outlet and is never taken from the client (`BR-SALE-006`), so no
   brand picker drives the sale. `/admin/orders` lists past orders and offers void
   and "Sửa đơn" (opens "Đổi cách trả": payment parts only, `BR-SALE-014`) on a live order; void and edit should not be offered on a row that is
   already `SUPERSEDED` or already voided, since acting on a stale version would
   fork the order's history. `/admin/promotions` creates, edits, deactivates, and
   deletes promotions. Delete is ADMIN-only per `BR-ACCESS-003` (owner decision
   2026-09-08, `requireOwner`), with the button hidden for anyone else
   (`canDelete` computed from `resolveActor()` in `page.tsx`). Measured
   2026-09-09: that delete is unconditional — `deletePromotionAction` checks no
   references first, and no foreign key points at `promotions` from the order
   tables, so a promotion used by historical orders can be destroyed. Past
   totals still explain themselves because each order carries its own
   `applied_promotion_snapshot_json`; what is lost is the ability to look the
   promotion up by id. An earlier version of this paragraph claimed such a
   promotion is deactivated rather than deleted. That was never true of the
   code.
3. **What each list contains, and what is excluded.** `/admin/orders` shows
   orders; revenue and audit views over it must filter to the live version only —
   `status = 'COMPLETED'` **and** `superseded_by` empty — or the same sale is
   counted once per version (`BR-SALE-004`, `BR-SALE-002`). `SUPERSEDED` and voided rows
   are kept for traceability but excluded from revenue. `/admin/promotions` lists
   promotion definitions, including deactivated ones, because they are still needed
   to interpret older orders.
4. **Valid inputs, and what happens outside the range.** The order code is 12
   digits — `YYMMDD` (`Asia/Ho_Chi_Minh`) + 3-digit outlet + 3-digit daily
   sequence — minted under a per-(outlet, date) lock; an edit reuses the original
   group's code, date and outlet rather than the editor's own (`BR-SALE-006`,
   `BR-SALE-002`). A promotion needs a value and a validity window; the till
   applies only an active promotion whose window covers the sale. A submit that
   cannot reach the sync path is not lost silently: `/pos` writes a row to
   `Pos_Sync_Failures` so the failure is visible and recoverable rather than a
   dropped sale.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   order capture, order history, and promotions. It deliberately does **not**
   write the completed sale from the web app — that is the POS device sync's job;
   the web `/pos` action only touches `POS_Drafts` and `Pos_Sync_Failures`. It
   deliberately does **not** deduct stock or compute cost at sale time: since the
   2026-08-07 cutover a sale records no cost of goods, which is measured later when
   stock leaves the warehouse (see `docs/03-workflows/stock-issue.md`). And it does
   not re-derive revenue for the earliest months: money received before 2026-07-19
   has no independent record and is closed as unverifiable, never silently upgraded
   to audited (`BR-SALE-005`).

## Where it writes

- `app/pos/actions.ts` writes only `POS_Drafts` (insert/update/remove of the
  in-progress cart) and `Pos_Sync_Failures` (a marker when a submit does not sync).
  It does not write `orders_v2`.
- `lib/sales/void-order-transaction.ts` calls the `void_order_atomic` RPC, whose body
  writes `orders_v2` and `order_events` — the two write relations the generated
  map attributes to this file.
- `app/admin/promotions/actions.ts` writes `Promotions`.

The completed sale itself lands in `orders_v2` via the POS device sync path, which
is outside this flow's declared files; the supersede/void model above governs how
those rows are versioned once they arrive.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
