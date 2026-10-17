# Sales and order rules

### BR-SALE-001 — Historical sale economics are pinned

**Status:** `RETIRED`, effective 2026-08-07 — successor `BR-COGS-005`

Order lines store the cost used at sale time in `cost_at_sale`. Historical reporting must use the pinned value rather than silently replacing it with a later recipe or purchase-cost replay.

Superseded by `BR-COGS-005` (owner decision 2026-08-04). Plan C Task 4 applied the cutover on 2026-08-07: `order_lines_v2.cost_at_sale` reset to `0` for every row, 2.590 lines. There is no longer a pinned value for this rule to protect.

### BR-SALE-002 — Transaction snapshots preserve write-time inputs

**Status:** `APPROVED`

Orders and lines preserve the relevant price, promotion, recipe, modifier, and cost snapshots required by the reviewed flow. Later catalog edits must not rewrite the meaning of an already completed transaction without an explicit historical-recovery plan.

### BR-SALE-003 — Order lifecycle changes require traceability

**Status:** `APPROVED`

Void, edit, and supersede flows must preserve an explainable event/history path and the associated inventory effect. A UI status change without corresponding transaction evidence is not sufficient.

### BR-SALE-004 — Exact operational eligibility filters are implementation contracts

**Status:** `OBSERVED`

Reports and audits apply status/supersede filters to decide which orders count. Pre-Audit C and later report audits must document those filters per capability before they are promoted into owner-facing policy.

### BR-SALE-005 — Revenue before 2026-07-19 is permanently unverifiable, not verified

**Status:** `APPROVED` — owner decision 2026-08-14 (Plan H §2).

The system records payments in `order_payments`, and **that table begins 2026-07-19**. Before that date no independent record of money received exists: the feature did not exist. Revenue for that period can only ever be checked against itself.

**The date is UTC.** The first `order_payments` row is at 2026-07-19 23:34 UTC, which is 06:34 on 20/07/2026 in Saigon, where every report buckets its days (measured 2026-09-11). A screen that names the date, such as the note under the profit-and-loss table, shows 20/07/2026.

**What was checked, and passed, across all completed orders:** `net_total` equals `gross_total` minus promotions, item discounts and order discount, with zero mismatches; `net_total` equals the sum of its own order lines, with zero mismatches; no counted order is also a superseded version of another. From 2026-07-19 onward, revenue and recorded payments agree exactly — **13.603.000đ on both sides across 513 orders, difference 0đ** at the time of the audit.

**What that leaves.** **44.229.000đ across 1.573 orders, April to mid-July 2026, has nothing to reconcile against.** Asked on 2026-08-14 whether external records — bank statements, a cash book — could close the gap, the owner confirmed **none exist**.

**Every completed order since 2026-07-20 has a payment row** (checked by `verify-revenue`, check 5; measured 2026-10-16: 1 of 1.874 lacked one, order 260723001017, a CASH version created by an edit of a BANK_TRANSFER order; the row is added by `scripts/add-missing-order-payment.ts`, after the owner's approval).

**So the figure is closed as unverifiable, and must never be quietly upgraded to "audited" later.** It is internally consistent at every level that can be tested, and it has never been compared to money that actually arrived. Any statement about the shop's first four months rests on that distinction. A later report that presents the period without the caveat is wrong even if every number in it is unchanged.

**Why this is a rule and not a note.** Cost was audited line by line in Plan C and found 7,4% wrong (`BR-COGS-006`) — an error invisible until someone checked against what was paid. The same class of error in early revenue would be invisible **permanently**, because the thing to check against was never written down. The rule exists so nobody re-derives false confidence from the internal checks passing.

**Verification is re-runnable:** `scripts/verify-revenue.ts` re-checks every structural claim above and prints the unbacked figure on each run. It is the audit, not a record of one.

### BR-SALE-006 — Order code is outlet+date+sequence; brand always follows the outlet, never the reverse

**Status:** `APPROVED` — owner decision 2026-08-25 (Plan, outlets and order code). **Applied** — measured 2026-09-07 against the live database: `outlets` holds 2 rows and `orders_v2.outlet_id` is populated, so migrations `0071`/`0072` have run. `npx supabase migration list` listed them as unapplied at the time because its tracking stopped at `0064`; that history was repaired later the same day and now records them correctly (see `data-integrity.md`, "Migration state is measured on the database").

`order_no` is 12 digits, `YYMMDD` (`Asia/Ho_Chi_Minh`) + 3-digit outlet code + 3-digit sequence — e.g. `260825001001` is 2026-08-25, outlet `001`, first order that outlet-day. The sequence resets per (outlet, date), minted under a Postgres advisory lock keyed the same way. An edited order **keeps its original code across every version** — the rename groups by `order_no`, not by row, and the date/outlet come from the group's earliest row, matching `BR-SALE-002`'s existing snapshot-freeze pattern for `created_at`.

`orders_v2.brand_id` is derived server-side from `orders_v2.outlet_id` at the moment of sale, **never accepted from the client.** The till (`/pos`) opens by picking an outlet, not a brand; a `brandId` present in the URL is ignored by both the page and `submitOrderV2`. `outlet_id` itself is frozen at sale time the same way `created_at` is — an order edit preserves the original outlet, not the editor's own.

**A stopped outlet can be reopened** — owner 2026-10-15, chose *"Thêm nút Mở lại"* over keeping a stop one-way. The page of a stopped outlet has "Mở lại hoạt động". It sets the outlet back to active, clears its end date, and keeps its code, so its order numbers continue. Not built yet.

This is a **thin slice** of the approved multi-outlet design (ARCH-1): one `brand_id` per outlet, no time-windowed brand slots, no staff-to-outlet assignment, manual outlet picker only. See `docs/04-operations/OPEN-ITEMS.md` item 5.

### BR-SALE-007 — Tổng quan's 7-day table: a cup is a drink-type line, 0đ orders count

**Status:** `APPROVED` — owner 2026-10-14. He confirmed the worked example in `docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md` section 5. He asked for a separate column for toppings sold on their own (*"nếu có topping mua riêng thì có thêm 1 cột riêng"*), and kept 0đ orders in the count (*"1c"*). Built on the branch `feat/no-popups` 2026-10-14, not yet pushed. Code: `lib/dashboard/seven-day-table.ts`.

- **Which days and orders.** The table covers today and the six days before it, by the Saigon day of the order's `created_at`. It counts `COMPLETED` orders that have not been replaced by an edit: `superseded_by` is empty, which on live data means either null or `""`.
- **0đ orders count.** These are mostly a staff member's daily Cà phê đá + Trứng luộc + Khoai lang. He was shown that they lower the average: 08/10 is 20,889 with them and 21,692 without.
- **A cup** is any line whose dish group, read from the line's snapshot, belongs to a Loại món marked "là thức uống". The owner manages Loại món himself.
- **Average per cup** is the money on the cup lines divided by the number of cups, rounded with `displayMoney`. It includes toppings ordered with that cup, because they are already in the line's money. Example: Cacao latte 23,000 + Kem muối 4,000 is one cup at 27,000.
- **Topping mua riêng** counts portions of dishes whose group belongs to the Loại món chosen in Cài đặt Tổng quan. When none is chosen, the column is not shown.
- **One column per food dish** chosen in Cài đặt Tổng quan. Each shows the quantity sold.
- **Nothing is stored.** The table is worked out each time the page opens. Changing a group's Loại món recomputes all seven days with the new type.
- Re-runnable check: `scripts/verify-dashboard-seven-days.ts` gives 0 differences on 36 cells (08/10–13/10) against the confirmed example.

### BR-SALE-008 — A price changed while the till is open: the server refuses the order and the till reloads

**Status:** `APPROVED` — owner 2026-10-14, audit item C5. He was shown this example: the till opens in the morning, Bạc xỉu goes from 29,000 to 32,000 at noon, the till still shows 29,000, the cashier takes 29,000, the book records 32,000, and the drawer is 3,000 short. He chose *"Từ chối, bắt tải lại"* over saving the price the till showed. Built 2026-10-15 (`docs/superpowers/specs/2026-10-15-tinh-khuyen-mai-design.md`), not yet pushed.

- The till sends the total it showed the customer. The server works the total out again from the prices in force. If the two differ, the order is not saved and the till says the price has changed and to reload the page. After the reload the cashier charges the new price.
- The till can never set a price. That is why he did not choose "save what the till showed".
- The cost: the order that hits the change has to be rung up again once. Until the till is reloaded, every order containing a changed dish is refused.
- An order taken before the change and sent later (sync delay) is checked against the price in force when it was taken, not when it arrived. Otherwise a correct order would be refused.
- **A promotion stays freely editable, even after orders used it** — owner 2026-10-15, chose *"Sửa thoải mái, từ chối đơn trễ"* over locking its money fields after the first order and over letting late orders through unchecked. A promotion keeps no history of its past values. So an order sent late is checked against the promotion as it is when the order arrives. If the money no longer matches, the order is refused like a changed price, and the cashier rings it again. Each order's own promotion snapshot remains the record of what it got.

### BR-SALE-009 — A percent discount on the whole order is taken after the dish discounts

**Status:** `APPROVED` — owner 2026-10-14, audit item C9, chose *"Sau giảm từng món"*. Built 2026-10-15: the till and the server price through one function (`lib/sales/price-cart.ts`), not yet pushed.

**The example he was shown.** Bạc xỉu 29,000 and Cà phê sữa 25,000 come to 54,000. The cashier takes 4,000 off Bạc xỉu, leaving 50,000, then 10% off the whole order. The till takes 10% of 50,000, so 5,000, and the customer pays 45,000. The server takes 10% of 54,000, so 5,400, and books 44,600: the book and the drawer are 400 apart.

- The base for a percent order discount is the order total after every dish discount (manual and promotion). In the example: 5,000 off, 45,000 paid and booked.
- The server is changed to match the till; the till keeps what the cashier sees today.

### BR-SALE-010 — A whole-order promotion and the cashier's whole-order discount stack

**Status:** `APPROVED` — owner 2026-10-14, audit item C3, chose *"Cộng dồn"* over locking the cashier's discount. Built 2026-10-15, not yet pushed. Measured 2026-10-14: no running promotion is a whole-order one (both are per dish), so no order has been affected.

**The example he was shown.** A "Giảm 10% hóa đơn" promotion takes a 100,000 order to 90,000; the cashier then takes another 5,000 off for a regular. The customer pays 85,000.

- Order of steps: dish discounts first, then the whole-order promotion, then the cashier's whole-order discount. A percent cashier discount is taken on what is left after the promotion (`BR-SALE-009`).
- Today the till applies such a promotion but the server ignores it, so the book would say 100,000 against 90,000 collected. The server is changed to apply it the same way.

### BR-SALE-011 — Promotions without a code apply themselves; a "Dùng chung" box on each promotion decides whether two stack

**Status:** `APPROVED` — owner 2026-10-14, audit item C4. He first answered *"máy chủ tự áp, nhưng đúng điều kiện"* for promotions without a code only, with the customer choosing when a code promotion meets another; he then confirmed the worked example below (*"Đúng vậy"*). Built 2026-10-15 (migration `0127`: table `order_promotions`, box `promotions.stackable`), not yet pushed.

**The example he confirmed.** "Giảm 10.000 Bạc xỉu" needs no code. The customer also hands over the code KHAITRUONG, 15% off the order.

- **Minimum order value is checked after the dish discounts** — owner 2026-10-15, chose *"So sau giảm món"* over the price before any discount. Example he was shown: minimum 100,000; Bạc xỉu ×4 = 116,000 with 5,000 off each cup is 96,000, so the promotion does not apply. Same base as `BR-SALE-009`.
- **Without a code.** A promotion that needs no code applies itself when the order meets its conditions, minimum order value included. The till shows it before the money is taken. The server never applies a promotion that needs a code unless the till sent that code, and never one whose conditions the order misses (today it does both).
- **"Dùng chung với khuyến mãi khác"** is a new yes/no box on each promotion, set by the owner on the promotion screen. Existing promotions start at "không".
- **Both "có":** both apply. Order of steps as in `BR-SALE-010`.
- **Either "không":** the till lists both with the money each takes off, the cashier asks the customer, and picks one. The server books the one picked.
- The server books exactly the promotions the till sent, after checking each one's conditions; any mismatch is refused like a changed price (`BR-SALE-008`).

### BR-SALE-012 — Doanh số filtered by a dish group hides the whole-order money

**Status:** `APPROVED` — owner 2026-10-14, audit item B3, chose *"Tạm ẩn khi lọc"* over showing the whole-order figures with a note and over splitting them by each group's share. Built 2026-10-14 on the branch feat/no-popups, not yet pushed.

**The example he was shown.** On 09/10 an order was Cà phê đá 36,000 + Cà phê sữa đá 20,000 + Trứng luộc 5,000, paid 61,000 in cash. Filtered to Nhóm SP = Cà phê, "Tổng doanh thu thuần" said 56,000 while the discount box and the payment-method box said 61,000, because a payment is made once for the whole order and cannot be split by dish.

- With Nhóm SP chosen, Doanh số shows only figures that belong to that group's lines. "Chi tiết giảm giá", "Doanh thu theo phương thức thanh toán" and the small "Trước giảm giá", payment-count and "Khuyến mãi hệ thống" lines under the three figure boxes are hidden, replaced by one line telling him to clear the group filter to see them.
- Without the group filter the page is unchanged.

### BR-SALE-013 — An order paid two ways shows each part on the order screens

**Status:** `APPROVED` — owner 2026-10-14, audit item C12, chose *"Giữ nút, Đơn hàng hiện từng phần"* over removing the till's "Thanh toán nhiều hình thức" button and over leaving the screens as they were.

**The example he was shown.** Order 261006002002 on 06/10, one Trà sữa truyền thống 18,000, was booked as 9,000 cash + 9,000 transfer; the order list and the order page said only "Tiền mặt". He first took the split for a fault; it is not: the till never splits by itself, the cashier types each part. Measured 2026-10-14: 2 such orders ever, both by the account tuyen2612 at Điểm bán 2 around 19:42 (27/07, 72,000 as 36,000 + 36,000; 06/10). Whether those customers really paid that way is his to check with the cashier or the bank statement.

- The till keeps the button.
- **In Doanh số** such an order counts once in each payment row it used. The column is "Lượt thanh toán", and its total row says how many orders those payments belong to (06/10: "39 lượt thanh toán của 38 đơn"). "Tổng số đơn" stays the order count. Chosen 2026-10-15 under the owner's delegation (Báo cáo proposal R2, like Toast's Payments Summary), built 2026-10-15, not yet pushed.
- The order list shows "Tiền mặt + Chuyển khoản" for such an order; the order page shows each part with its amount. A one-way order shows as before.
- **Sửa đơn edits each part** — owner 2026-10-14, chose *"Sửa được từng phần"* over merging into one method and over locking the method. Until then the page showed one "Phương thức" box and, for an order paid two ways, silently kept the old parts whatever was chosen. Now the page lists the parts it holds (method and amount); the owner may change a part's method or amount, add the other method, or remove a part down to one. One part always takes the order's whole new total. With two parts, their sum must equal the order's new total or the save is refused with both figures shown; this also lets a split order's total change, which was refused before. Example: 18,000 as 9,000 cash + 9,000 transfer can become 10,000 + 8,000, or 18,000 cash. Since `BR-SALE-014` (2026-10-15) the total itself no longer changes on this page.


### BR-SALE-014 — Sửa đơn changes only how the order was paid

**Status:** `APPROVED` — owner 2026-10-15, Bán hàng area audit, chose *"Chỉ đổi cách trả"* over keeping full editing with old values pinned, and over line refunds. Not built yet.

**What he was shown.** In four months Sửa đơn was used 25 times:
- 18 changed only cash ↔ transfer;
- 5 were tests;
- 2 changed the dishes.

Every edit rebuilt the order from today's catalog. The new version credited the sale to whoever edited it: 6 orders sold by tuyen2612 now read "admin". It dropped the order's promotion: 3 orders. It could take today's price and dish name: 0 times so far.

- Sửa đơn becomes "Đổi cách trả".
  - The order page's button still reads "Sửa đơn"; the page it opens is titled "Đổi cách trả". Owner 2026-10-15: *"Không thay đổi tên nút"*.
  - It edits only the payment parts, as `BR-SALE-013` describes. The parts must add up to the order's unchanged total.
  - Every line keeps its dish, size, price, toppings and names as sold.
  - The order keeps its promotion and its seller. Who changed it goes in the order's history.
- A wrong dish, quantity or discount is fixed by Huỷ đơn with a reason, then ringing the order again at the till. The new order carries the time it is rung.
- The 6 seller names and the 3 promotion links lost to earlier edits are restored by a separate data write that the owner approves.

### BR-SALE-015 — The till does not sell without internet

**Status:** `APPROVED` — owner 2026-10-15, chose *"Không bán khi mất mạng"* over a real offline queue, after hearing that the till had three behaviours for one state (banner "đơn vẫn được lưu", pay buttons disabled, Enter still sending) and that 0 orders ever waited for the network and 0 sync failures were ever recorded. Closes `BR-U-001`. Built 2026-10-15 (Máy bán hàng proposal R1); the table goes with migration 0129, run after the push.

- When the browser reports no network, the till says "Mất kết nối — chưa bán được, kiểm tra mạng rồi bấm lại"; the pay buttons and the Enter key are off together.
- No order is queued in the browser. The queue, the service worker and the Đồng bộ máy bán page are removed with their table.
- A send that fails while online keeps the cart and shows "Gửi lại" with the same request token, so sending twice cannot write twice.
- A rule refusal (price changed, `BR-SALE-008`) is told apart from a transport error: the first says reload, the second says retry.
- Cost accepted by the owner: a dropped connection stops sales until it is back.

### BR-SALE-016 — Each cashier sells under their own account

**Status:** `APPROVED` — owner 2026-10-15, chose *"Mỗi thu ngân một tài khoản"* after seeing 714 orders in 30 days all under one account and no logout on the till. Built 2026-10-15 (Máy bán hàng proposal R6, Q2): Đăng xuất on the till, outlet picker for STAFF; the STAFF accounts themselves are the owner's to create. `BR-U-003` stays open for the full role matrix; this fixes one row of it.

**Correction 2026-10-16 (owner):** the one account is a real person. All 720 orders from 2026-09-16 to 2026-10-15 were sold by Tài Chí Tuyền (`tuyen2612`, MANAGER), and owner 2026-10-16 says *"Chỉ Tuyền bán"*. The proposal wrongly read "one account" as "a shared account". Nothing is to be created now. The rule applies the day a second person sells: that person gets their own account and never uses someone else's.

- Each person who sells has their own account. A cashier who is not a manager gets a Nhân viên (STAFF) account in Nhân sự. STAFF opens the till only; `/admin` stays closed to it (owner decision 2026-07-22).
- The till has a Đăng xuất button. The order keeps the seller's name as today (`created_by_name`), so Doanh số filtered by Nhân viên shows who sold.
- A STAFF login with no outlet sees the outlet picker, never a redirect loop.

### BR-SALE-017 — A dish group's till icon is data the owner edits

2026-10-15 (spec R4; owner rule 2026-09-28, no hard-coding what he may change): `product_categories.icon` holds the emoji shown on a dish card at the till, set on the dish-group form. Blank means no icon on the card, not a default cup. Up to 8 characters (one emoji can be several code units), refused with "Biểu tượng tối đa 8 ký tự". Migration `0130` (run 2026-10-15, before the push that ships the form) backfills only the three groups the old keyword table really matched: Cà phê ☕, Trà 🍵, Yogurt 🥛; Giải trí, Thức ăn and Topping get no icon (the old fallback cup was wrong there).

2026-10-17 (till redo, mockup A, chosen under the owner's 2026-10-15 delegation): the icon shows on the dish-group tab at the top of the till, no longer on each dish card. The card shows the dish name and its size buttons with prices instead. The size buttons are reversed the same day by `BR-SALE-019` (`docs/02-rules/business-rules/till.md`).

### BR-SALE-018 — TIỀN MẶT sends the order at once; the till does not count change

**Status:** `APPROVED` — owner 2026-10-15, after trying the till: *"chỉ riêng phần Khách đưa trong chỗ bán hàng thì không cần bước đó"*. Reverses Máy bán hàng proposal R2 (a Khách đưa / Tiền thừa step on cash), which was built the same day and never pushed.

- TIỀN MẶT sends a cash order straight away. The Enter key asks once, "Xác nhận thanh toán TIỀN MẶT cho đơn hàng?", then sends — both as before R2. Enter does nothing while a dish or draft window is open.
- No amount the customer handed over is asked, and no change is shown.
- TIỀN MẶT stays on the left and CHUYỂN KHOẢN on the right (2026-10-17, till redo). Both send at once, so a cashier who taps by position would record cash as a transfer if the two swapped.
- **Changed 2026-10-17 (owner, `BR-SALE-020` in `docs/02-rules/business-rules/till.md`):** the two cart buttons become one Thanh toán button followed by a method step. The no-change-count part above stays.
- Nothing was ever stored by the step, so no data changes.
