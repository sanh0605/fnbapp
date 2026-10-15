# C10: one pricing function for the till and the server, two promotions per order

**Date:** 2026-10-15. **Area:** Bán hàng. **Source:** audit item C10 (`docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`, "Promotion pricing"; order of work step 5). **Rules served:** `BR-SALE-008`, `BR-SALE-009`, `BR-SALE-010`, `BR-SALE-011` (all approved 2026-10-14/15, none built). **Open tests it closes:** the six `it.todo` in `app/pos/actions.test.ts`.

Choices marked *(khuyến nghị)* were taken by recommendation under the owner's 2026-10-15 delegation (*"Đúng, làm vậy"*). They go into the end-of-batch summary for him.

## 1. Measured 2026-10-15

| Fact | Value |
|---|---|
| Orders | 3,507: 3,446 completed, 24 replaced, 37 voided; 2026-04-20 to 2026-10-15 |
| Promotions ever | 2, both per dish, neither with a code or a minimum: `PRM-003` "KHAI TRƯƠNG ĐỒNG GIÁ" (đồng giá 15,000, 01–30/06) and `PRM-004` "202607 - GIẢM 10K" (10,000 off per cup, 01–15/07). Both still read `ACTIVE` after their end dates |
| Orders with a promotion | 831 (`PRM-003` 704, `PRM-004` 127); 1,252 lines, 15,392,000đ in total |
| Odd order | `260618001003` (18/06, 18,000): 3,000 promotion money, no promotion recorded |
| Cashier discounts | 89 completed orders with a dish discount, 140 with a whole-order discount, 0 with both |
| Whole-order promotions ever | 0, so the gap below has cost nothing yet |
| Late orders (queued, sent later) | 2 of 1,696 arrived over a minute late; the latest 12 minutes. `pos_sync_failures`: 0 rows |
| Price history | 52 rows, none with a 0 price, last change 29/09 |

## 2. What is wrong today

The money is worked out four times: the server (`lib/sales/order-cart.ts`), the till screen (`app/pos/components/POSScreen.tsx` 296–640), the cart panel (`CartPanel.tsx` 104–124) and the dish dialog (`ItemConfigModal.tsx` 81–94). They disagree:

1. **Whole-order promotions.** The till takes them off; the server books 0. The drawer would be short against the book by the whole discount.
2. **Minimum order and code.** Only the till checks them. The server books any promotion id the browser sends.
3. **Per-size values.** For "%" and "giảm X đ" promotions, the till uses the per-size value set on the promotion form; the server uses the promotion's single value.
4. **Cashier's whole-order discount.** The till lets it *replace* a whole-order promotion; `BR-SALE-010` says they stack. A "%" cashier discount is taken on the price before dish discounts on the server and after them on the till (`BR-SALE-009`).
5. **The browser can set prices.** The server accepts `unit_price_snapshot`, `modifier_price_snapshot` and `promo_discount_snapshot` from the cart. Nothing in the app sends them any more; any crafted request can.
6. **One promotion per order.** `orders_v2.applied_promotion_id` holds one; `BR-SALE-011` needs two.
7. **No check of the till's total.** `BR-SALE-008` (refuse when the till showed a different total) has nothing to compare against: the till does not send what it showed.

## 3. How the large systems do it

- **Square Orders API**: the client sends the order with the discounts it chose; the server prices it and returns the computed totals (`OrderLineItemDiscount`, scope `ORDER` or `LINE_ITEM`, applied amount per line). Discounts applied to an order are their own rows on the order, each with its name, kind, value and the money it took. https://developer.squareup.com/reference/square/objects/OrderLineItemDiscount, https://developer.squareup.com/docs/orders-api/apply-taxes-and-discounts
- **Square auto-apply pricing rules**: with `auto_apply_discounts` on, a pricing rule (discount + product set, optionally a minimum or a time window) applies itself when the cart matches; staff can block it on a line. https://developer.squareup.com/docs/orders-api/apply-taxes-and-discounts/auto-apply-discounts
- **Shopify discount combinations**: each discount says what it combines with. Product discounts apply first, then order discounts on the subtotal after them; if discounts cannot combine, the best discount or combination for the customer is selected automatically. https://help.shopify.com/en/manual/discounts/discount-combinations
- **Toast**: a check (whole-order) discount applies to all items on the check, and several can sit on one check. https://doc.toasttab.com/doc/platformguide/adminDiscountPricing.html, https://doc.toasttab.com/doc/devguide/apiDiscountingOrders.html

What this design takes: one pricing function both sides run (Square: the client builds the order, the server prices it); applied promotions as rows on the order (Square, Toast); the "Dùng chung" box as Shopify's combine setting, already approved in `BR-SALE-011`; dish discounts before whole-order ones (Shopify, and `BR-SALE-009`); the best set for the customer pre-selected (Shopify). Spreading whole-order money over the lines is what the app already does for the cashier's whole-order discount; none of the three pages says how they spread it.

What it does not take: Square's link table for "dishes of a promotion" (`CatalogProductSet`). The audit listed it; on a second look nothing reads it. The promotion's dish list stays in `promotions.applicable_products_json`, which already holds a per-size value. A link table is worth building when a screen needs "which promotions include this dish". *Ruling (Opus): cost if wrong, one later migration and a copy of 2 rows.*

## 4. Design

### 4.1 One pricing function

`lib/sales/price-cart.ts`, a pure function with no server imports, so the till and the server import the same file:

```ts
priceCart(cart, catalog, promotions, choice) → {
  lines: { gross, promo, manualItem, orderPromo, orderManual, net }[],
  applied: { promotionId, amount }[],
  options: { promotionIds: string[], amount: number }[], // sets the cashier may choose between
  total: number,
}
```

Steps, in this order (`BR-SALE-009`, `-010`, `-011`):

1. **Line price.** `(size price + Σ option price × option qty) × qty`. Prices come from the catalogue only, never from the cart.
2. **Dish promotions** on the lines they name, each line's value taken from the per-size value when the promotion has one, otherwise the promotion's value:
   - đồng giá: `max(0, size price − value) × qty`; options keep their price (as booked today: Trà dâu 27,000 + Trân châu trắng 5,000 under đồng giá 15,000 booked 20,000, line `ol-44752083…`);
   - %: `round(line price × value / 100)`, options included (as booked today);
   - giảm X đ: `value × qty`.
   Two dish promotions on one line (both "Dùng chung"): each worked out on the line price, the second capped at what is left. *(khuyến nghị)*
3. **Cashier dish discount**: as today, capped at what is left of the line.
4. **Base** = Σ lines after steps 2–3. A promotion's minimum is checked against the base. A dish promotion whose minimum fails is dropped and the base worked out again once.
5. **Whole-order promotion**: % of the base, or a fixed amount; spread over the lines by what each has left (the existing `allocateOrderDiscount`), booked into each line's `promo_discount`, so the existing "Khuyến mãi hệ thống" figures and dish revenue include it with no report change.
6. **Cashier whole-order discount**: % of what is left after step 5, or a fixed amount; spread the same way into `order_discount_allocation`, as today.
7. **Net** per line and in total. Rounding: `Math.round`, in the same function on both sides, so the till and the server cannot differ by rounding.

`đồng giá` on a whole-order promotion means nothing; the form already offers it. The server refuses it and the form hides it.

### 4.2 Which promotions apply

A promotion is **eligible** when it is `ACTIVE`, its dates cover the moment the order was taken, its brand matches, the cart has a dish it names (dish promotions), the base reaches its minimum, and, if it has a code, the cashier typed that code.

A **valid set** is one promotion, or several that all have "Dùng chung" ticked.

- The till offers every eligible no-code promotion, plus a coded one once its code is typed. If they form one valid set, it applies them all. If not, it lists the valid sets with the money each takes off, **pre-selects the set that takes off most**, and the cashier can switch. *(khuyến nghị; Shopify selects the best combination for the customer.)*
- The till sends the chosen promotion ids, any code, and the total it showed.
- The server prices the order again with the same function and refuses it when any of these holds, with the till's message "Giá hoặc khuyến mãi đã thay đổi. Tải lại trang rồi bấm lại." (`BR-SALE-008`):
  - a sent promotion is not eligible, or the set is not valid;
  - an eligible no-code promotion was left out although adding it would still make a valid set (a till opened before that promotion existed) *(khuyến nghị: treated like a changed price; otherwise the server would book less discount than the shop advertises)*;
  - its total differs from the total the till showed.

**Late orders** (`BR-SALE-008`): dish and option prices are taken as of the moment the order was taken, from `product_price_history` (the old price of the first change after that moment). Promotions are taken as they are on arrival, as the owner chose on 2026-10-15. A refused late order lands in `pos_sync_failures` as today and shows on the "Đơn lỗi đồng bộ" page.

### 4.3 Storage

New table `order_promotions`, one row per promotion applied to an order:

| Column | Meaning |
|---|---|
| `id` text PK | `op-<uuid>` |
| `order_id` text, FK `orders_v2` RESTRICT | the order |
| `promotion_id` text, FK `promotions` RESTRICT | the promotion |
| `seq` int | 1, 2 in the order applied |
| `name`, `code`, `type`, `discount_type`, `discount_value`, `stackable` | copied at the time of sale, so a later edit of the promotion does not rewrite the order (`BR-SALE-008`) |
| `amount` bigint | money this promotion took off the order |

Unique `(order_id, promotion_id)`. Sum of `amount` = the order's `promo_discount_total` (a new invariant in `assertOrderInvariants`).

`promotions.stackable boolean not null default false`: the "Dùng chung với khuyến mãi khác" box. Existing promotions start at "không" (`BR-SALE-011`).

Backfill: 831 orders get one row each from `applied_promotion_id` and its snapshot, amount = `promo_discount_total`. The odd order `260618001003` has no promotion to point at and gets no row; the invariant is checked from the backfill date on, and that order is listed in the replay report.

Later, in the area's structure batch: drop `orders_v2.applied_promotion_id` and `applied_promotion_snapshot_json`, after every reader has moved (order detail, order list, `scripts/verify-revenue-core.ts`, `scripts/restore-order-seller-promo-core.ts`, backup restore, `lib/db/tables.ts`).

### 4.4 Screens

- **Till**: the cart summary lists each applied promotion with its amount; when there is a choice, a row of buttons, one per valid set, with the amount; the code box stays.
- **Promotion form and detail**: a "Dùng chung với khuyến mãi khác" yes/no box; "Đồng giá" hidden for a whole-order promotion.
- **Order detail**: one line per applied promotion, from `order_promotions`.
- Computer and phone, as every screen.

## 5. Proof before switching

The replay: run `priceCart` over every one of the 3,507 orders, fed from what the order stored (line prices, options, quantities, cashier discounts in đồng, its promotion as snapshotted), and compare `promo_discount`, `manual_item_discount`, `order_discount_allocation` and `net_line_total` line by line. Expected: every line equal except order `260618001003`. Any other difference is either a rule change this design names (section 2) and is listed with its order code, or a bug, which stops the switch. Script `scripts/verify-price-cart.ts`, read-only, reports "N lệch trên M dòng".

## 6. Order of work

1. `priceCart` and the replay (backend). No screen changes.
2. The server switches to `priceCart`; the three snapshot fields stop being accepted. The till, cart panel and dish dialog switch to it (frontend). One push, **outside opening hours**: the till and server must change together or every order with a promotion is priced twice differently. Still one promotion, still no refusal.
3. Migration `order_promotions` + `stackable` + backfill; the order-writing function also writes `order_promotions`, and while the till still sends one promotion it fills the row from `applied_promotion_id` (bridge, removed in the structure batch). Additive: a till on the old code keeps working.
4. Second push: two promotions, the "Dùng chung" box, the order detail lines, and the `BR-SALE-008` refusal switched on. Outside opening hours.

Each push and the migration are approved separately.

## 7. Worked example with real orders

**Today, reproduced by the replay.** Order `260714002013` (14/07): Trà dâu 27,000 (line `ol-0c1c3c48…`) and Trà xoài 27,000 (line `ol-e2f4dcaa…`), promotion "202607 - GIẢM 10K". Each line: 27,000 − 10,000 = 17,000. Order 34,000. `priceCart` must give the same four numbers.

**After step 4, two promotions.** The same cart, plus a whole-order code promotion "KHAITRUONG" 15%, both with "Dùng chung" ticked, then the cashier takes 10% off the whole order:

| Step | Trà dâu | Trà xoài | Order |
|---|---|---|---|
| Line price | 27,000 | 27,000 | 54,000 |
| "202607 - GIẢM 10K" | −10,000 | −10,000 | base 34,000 |
| KHAITRUONG 15% of 34,000 = 5,100, spread | −2,550 | −2,550 | 28,900 |
| Cashier 10% of 28,900 = 2,890, spread | −1,445 | −1,445 | |
| Net | 13,005 | 13,005 | **26,010** |

`order_promotions`: two rows, 20,000 and 5,100. `promo_discount_total` 25,100. If KHAITRUONG had "Dùng chung" off, the till shows two buttons: "202607 - GIẢM 10K: −20,000" (pre-selected) and "KHAITRUONG: −8,100" (15% of 54,000), and the cashier asks the customer.

**A refused order.** The till opens at 7:00 showing Bạc xỉu 29,000; at noon the owner changes it to 32,000. A cashier on the old page sells one Bạc xỉu and the till sends total 29,000. The server works out 32,000, refuses, and the till says to reload. After the reload it shows 32,000.

## 8. Not covered

Not seen: the full `create_pos_order_atomic_unvalidated_0025` body (0121), `app/admin/pos-sync` retry path, the promotion list page's columns, `PromotionDetailView` in full. Not served: a "promotions of this dish" screen, a promotion report per promotion, buy-X-get-Y, time-of-day promotions, customer-specific promotions.
