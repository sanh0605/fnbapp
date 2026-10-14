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

**So the figure is closed as unverifiable, and must never be quietly upgraded to "audited" later.** It is internally consistent at every level that can be tested, and it has never been compared to money that actually arrived. Any statement about the shop's first four months rests on that distinction. A later report that presents the period without the caveat is wrong even if every number in it is unchanged.

**Why this is a rule and not a note.** Cost was audited line by line in Plan C and found 7,4% wrong (`BR-COGS-006`) — an error invisible until someone checked against what was paid. The same class of error in early revenue would be invisible **permanently**, because the thing to check against was never written down. The rule exists so nobody re-derives false confidence from the internal checks passing.

**Verification is re-runnable:** `scripts/verify-revenue.ts` re-checks every structural claim above and prints the unbacked figure on each run. It is the audit, not a record of one.

### BR-SALE-006 — Order code is outlet+date+sequence; brand always follows the outlet, never the reverse

**Status:** `APPROVED` — owner decision 2026-08-25 (Plan, outlets and order code). **Applied** — measured 2026-09-07 against the live database: `outlets` holds 2 rows and `orders_v2.outlet_id` is populated, so migrations `0071`/`0072` have run. `npx supabase migration list` listed them as unapplied at the time because its tracking stopped at `0064`; that history was repaired later the same day and now records them correctly (see `data-integrity.md`, "Migration state is measured on the database").

`order_no` is 12 digits, `YYMMDD` (`Asia/Ho_Chi_Minh`) + 3-digit outlet code + 3-digit sequence — e.g. `260825001001` is 2026-08-25, outlet `001`, first order that outlet-day. The sequence resets per (outlet, date), minted under a Postgres advisory lock keyed the same way. An edited order **keeps its original code across every version** — the rename groups by `order_no`, not by row, and the date/outlet come from the group's earliest row, matching `BR-SALE-002`'s existing snapshot-freeze pattern for `created_at`.

`orders_v2.brand_id` is derived server-side from `orders_v2.outlet_id` at the moment of sale, **never accepted from the client.** The till (`/pos`) opens by picking an outlet, not a brand; a `brandId` present in the URL is ignored by both the page and `submitOrderV2`. `outlet_id` itself is frozen at sale time the same way `created_at` is — an order edit preserves the original outlet, not the editor's own.

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

**Status:** `APPROVED` — owner 2026-10-14, audit item C5. He was shown this example: the till opens in the morning, Bạc xỉu goes from 29,000 to 32,000 at noon, the till still shows 29,000, the cashier takes 29,000, the book records 32,000, and the drawer is 3,000 short. He chose *"Từ chối, bắt tải lại"* over saving the price the till showed. Not built yet.

- The till sends the total it showed the customer. The server works the total out again from the prices in force. If the two differ, the order is not saved and the till says the price has changed and to reload the page. After the reload the cashier charges the new price.
- The till can never set a price. That is why he did not choose "save what the till showed".
- The cost: the order that hits the change has to be rung up again once. Until the till is reloaded, every order containing a changed dish is refused.
- An order taken before the change and sent later (sync delay) is checked against the price in force when it was taken, not when it arrived. Otherwise a correct order would be refused.

### BR-SALE-009 — A percent discount on the whole order is taken after the dish discounts

**Status:** `APPROVED` — owner 2026-10-14, audit item C9, chose *"Sau giảm từng món"*. Not built yet: today the till already works this way, the server does not.

**The example he was shown.** Bạc xỉu 29,000 and Cà phê sữa 25,000 come to 54,000. The cashier takes 4,000 off Bạc xỉu, leaving 50,000, then 10% off the whole order. The till takes 10% of 50,000, so 5,000, and the customer pays 45,000. The server takes 10% of 54,000, so 5,400, and books 44,600: the book and the drawer are 400 apart.

- The base for a percent order discount is the order total after every dish discount (manual and promotion). In the example: 5,000 off, 45,000 paid and booked.
- The server is changed to match the till; the till keeps what the cashier sees today.

### BR-SALE-010 — A whole-order promotion and the cashier's whole-order discount stack

**Status:** `APPROVED` — owner 2026-10-14, audit item C3, chose *"Cộng dồn"* over locking the cashier's discount. Not built yet. Measured 2026-10-14: no running promotion is a whole-order one (both are per dish), so no order has been affected.

**The example he was shown.** A "Giảm 10% hóa đơn" promotion takes a 100,000 order to 90,000; the cashier then takes another 5,000 off for a regular. The customer pays 85,000.

- Order of steps: dish discounts first, then the whole-order promotion, then the cashier's whole-order discount. A percent cashier discount is taken on what is left after the promotion (`BR-SALE-009`).
- Today the till applies such a promotion but the server ignores it, so the book would say 100,000 against 90,000 collected. The server is changed to apply it the same way.

### BR-SALE-011 — Promotions without a code apply themselves; a "Dùng chung" box on each promotion decides whether two stack

**Status:** `APPROVED` — owner 2026-10-14, audit item C4. He first answered *"máy chủ tự áp, nhưng đúng điều kiện"* for promotions without a code only, with the customer choosing when a code promotion meets another; he then confirmed the worked example below (*"Đúng vậy"*). Not built yet.

**The example he confirmed.** "Giảm 10.000 Bạc xỉu" needs no code. The customer also hands over the code KHAITRUONG, 15% off the order.

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
