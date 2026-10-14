# Bán hàng: area audit and proposal

This page covers master-plan rows 6c and 6d for the Bán hàng area. The owner chose 2026-10-15 "Làm lại từng mảng":
- keep the reconciled money and stock core;
- rebuild an area when its root is wrong;
- the till never stops.

Four read-only audits were run on 2026-10-15 against the live server: promotions and outlets, the menu catalog, the order pages, and the data structure. Every number below was measured that day. Re-measure before use.

## Hiện trạng

1. **States.**
   - Orders are COMPLETED, SUPERSEDED or VOIDED: 3,414, 24 and 37 of 3,475.
   - Dishes, sizes, options, categories, promotions and brands are ACTIVE, INACTIVE or DELETED. INACTIVE is used by 0 rows. DELETED is held only by never-sold leftovers:
     - 3 dishes (Cà phê kem dẻo CT1, Cà phê kem dẻo CT2, Cà phê đá) and their 3 sizes;
     - the category Cacao;
     - the duplicate option Dâu sấy.
   - Both promotions are ACTIVE but ended: KHAI TRƯƠNG ĐỒNG GIÁ ran 1/6–30/6 and 202607 - GIẢM 10K ran 1/7–15/7.
2. **Buttons.**
   - Sửa đơn has been used 25 times:
     - 18 changed only the payment method;
     - 5 were tests;
     - 2 changed content.
   - Huỷ đơn opens a popup with a typed reason, which breaks BR-DATA-007.
   - On a DELETED dish the page showed "Bán lại", and the server accepted it. Fixed in this batch.
3. **Lists.**
   - The order list shows COMPLETED orders only. The 37 voided orders show nowhere.
   - The Món, Nhóm món and Topping lists show codes and sort differently from one another.
4. **Inputs.**
   - The payment-method filter puts up to 1,364 order ids into the request address, and its read stops at 1,000 rows.
   - "Ngày áp dụng giá" on the dish form is never used.
   - The order-page "Giảm giá đơn" box is about 68 px wide.
5. **Data served.**
   - 3,414 live orders and 4,824 lines, about 24 orders a day.
   - Promotions: KHAI TRƯƠNG ĐỒNG GIÁ is on 691 orders and 202607 - GIẢM 10K on 122.
   - The till reads dishes, sizes, options and groups. It does not read price history.

Seen: the four audit reports, plus own checks of:
- `ProductDetailView.tsx:131-149`;
- migration 0114;
- `order-edit-cart.ts:111,131`;
- `LineItemEditor.tsx:88,119`;
- price history (37 of 55 rows with new price 0).

Not seen: the full bodies of `save_product_atomic` and the 5-argument `supersede_order_v2_atomic`, the backup restore path for dropped columns, `scripts/verify-*`, and whether the payment filter fails live.

## Verdict: the root of the area

- **Keep:**
  - the order model, where an edit makes a new version and a void keeps the row (the reconciled money core);
  - the sold-option snapshot, the same shape as Square's OrderLineItemModifier;
  - the two-record topping model (BR-CATALOG-003, -005);
  - Nhóm món + Loại món.
- **Root is wrong, so rebuild:**
  1. **Sửa đơn.** It rebuilds every line from today's catalog and today's price, credits the sale to the editor, and drops the promotion. 1,100 lines of UI serve 2 content edits in four months.
  2. **Promotion pricing.** The price maths is copied in 4 places. The server ignores whole-bill promotions. Till and server disagree on per-size % and on fixed amounts. An order can hold one promotion, while BR-SALE-011 (approved 2026-10-14) needs two. Order C10, already planned:
     1. one shared pricing function on the server, replay-checked on all 3,414 orders;
     2. switch till, cart and order pages to it outside opening hours;
     3. a "promotions applied to an order" child table and a "dishes of a promotion" link table, as Square stores them (https://developer.squareup.com/reference/square/objects/OrderLineItemDiscount, https://developer.squareup.com/reference/square/objects/CatalogProductSet);
     4. only then turn on BR-SALE-008's refusal.

## Owner decisions, asked one at a time

| # | Question | Recommendation | Source |
|---|---|---|---|
| Q1 | Sửa đơn: (a) becomes "Đổi cách trả" only, and content mistakes are voided and rung again; (b) keep full editing but pin old prices, names, cashier and promotion; (c) line refunds | **Answered 2026-10-15: (a)**, `BR-SALE-014` | Toast same-day void and re-ring; Square refunds are a separate flow |
| Q2 | Dish codes on the Món, Nhóm món and Topping lists, which touches BR-DATA-008: (a) hide codes, sort by name; (b) hide codes, newest first; (c) keep | **Answered 2026-10-15: "Giữ như luật cũ"**. Codes stay; the three lists only get the same default as every list, code descending (BR-DATA-008) | Square and Toast menus list by name |
| Q3 | "Đơn tối thiểu" compares against the total before or after dish discounts | **Answered 2026-10-15: after**, written into `BR-SALE-011` | promo report Q-P1 |
| Q4 | A promotion already used: (a) lock money fields, allow only stopping; (b) edit freely | **Answered 2026-10-15: edit freely, refuse late orders that no longer match**, written into `BR-SALE-008` | promo report Q-P2 |
| Q5 | A stopped outlet: (a) add "Mở lại hoạt động"; (b) keep it one-way | **Answered 2026-10-15: (a)**, written into `BR-SALE-006` | Square reactivates locations |
| Q6 | `products.brand_id` is empty on 48 of 48: (a) both outlets sell one menu, so drop it; (b) a menu per brand | **Answered 2026-10-15: (a)**, `BR-CATALOG-006` | Square per-location presence |
| Q7 | Test11 is ACTIVE on the till; its 7 lines are all on voided or replaced orders: (a) Ngừng bán; (b) leave | **Answered 2026-10-15: leave it** ("Để nguyên") | — |
| Q8 | The unused "Ngày áp dụng giá" field: (a) remove; (b) keep | **Answered 2026-10-15: remove** | Toast "Time Specific Price" is a separate feature |

## Technical work, no owner decision (Opus decides, reports)

| Item | Who | Migration | Till risk |
|---|---|---|---|
| DELETED dish: no "Bán lại" or "Ngừng bán", server refuses | Sonnet + Gemini | no | none (done this batch) |
| Huỷ đơn becomes its own page, copying Huỷ phiếu nhập | Gemini | no | none |
| "Trạng thái" filter on the order list: Hoàn tất / Đã huỷ | Sonnet + Gemini | no | none |
| Payment filter queried on the server, not as an id list in the address | Sonnet | no | none |
| English server errors and the raw event names CREATED/EDITED/VOIDED put into Vietnamese | Sonnet + Gemini | no | none |
| "Giảm giá đơn" box width; five Bán hàng create pages onto the shared header; 7 hand-made error boxes onto `Alert`; the order list onto the list template | Gemini | no | none |
| Option detail shows "Có sẵn" and "Tối đa"; Nhóm món shows its Loại món; dish detail shows its option groups | Gemini | no | none |
| Deleting a linked topping option leaves its dish on the till: refuse while the dish is ACTIVE | Sonnet | no | none |
| Dead code: ToppingsManager, the /admin/products/toppings redirect, canDelete props, 6 copies of safeReturnTo | Sonnet | no | none |
| Tạo món / Sửa món scan every order line | Sonnet | no | none |

## Data writes, each needs the owner's approval to run

1. **Price history.** Fill the 37 rows of 55 whose new price is 0đ, all from the 28/6 import:
   - 28 sold sizes take their first sale price; 27 of those 28 equal today's price;
   - 9 never-sold sizes take today's price.

   Example: Cà phê sữa đá 500ml reads "→ 0" and becomes "→ 20.000". Then add a check that the new price is above 0. Run it with `fnbapp-bulk-data-change`.
2. **Sửa đơn leftovers.** Whatever Q1 decides:
   - give the cashier back on 6 orders sold by tuyen2612 that now read "admin" (260629002007, 260704002017, 260705002004, 260710002006, 260717002011, 260827002004);
   - give the promotion link back on 3 (260629002007, 260704002017, 260710002006).
3. **Erase the never-sold DELETED leftovers.** Then drop DELETED from the status vocabulary (Square keeps a single deleted flag).

## Structure work, one migration batch, till risk stated

These ship together so the till's order function changes once:
- **Drop dead columns.** Each is constant everywhere, with no reader:
  - `cost_at_sale`, `recipe_snapshot_json`, `payment_ref`, `order_payments.reference`, `currency`;
  - `products.description`, `manual_discount_reason`, the three `sort_order` columns;
  - the DRAFT order status.
- **Store nothing as null, not empty text,** in five order link columns, then add their foreign keys.
- **Order lines and order history:** `RESTRICT` instead of `CASCADE`.
- **Number minting must not cut.** `lpad(n,3)` turns order 1000 into 100. Today's daily high is 39.

**Till risk:** the till's order function writes four of the dead columns by name. Required order:
1. code stops reading them;
2. one migration rewrites the order functions and drops the columns;
3. code stops sending them.

If the code stops sending them before the migration runs, the till stops taking orders.

## Order of work

1. Q1, then the Sửa đơn rebuild and data write 2.
2. The technical rows above, in parallel where files do not overlap.
3. Q2–Q8 as each screen is reached.
4. Data writes 1 and 3.
5. C10 promotion pricing together with BR-SALE-011 storage. This is new tables, so it gets the full four steps.
6. The structure migration batch, outside opening hours.
