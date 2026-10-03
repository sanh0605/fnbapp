# Sổ thu chi: mọi dòng tiền, chuyển tiền, đầu kỳ và cuối kỳ

**Status:** approved by the owner 2026-10-04 (*"2 duyệt"*).
**Rules this implements:** `BR-CASH-001` (changed 2026-10-04), `BR-CASH-007`, `BR-CASH-008` in
`docs/02-rules/business-rules/cash-book.md`. Earlier design, still valid where not replaced here:
`docs/superpowers/specs/2026-09-08-so-thu-chi-design.md`. List template:
`docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md`.

## 1. What the owner asked

Owner, 2026-10-03: *"lưu tất cả các lần ảnh hưởng đến dòng tiền vào, tức là bao gồm cả tiền
thanh toán đơn nhập hàng và tiền bán hàng. Đồng thời, anh cần biết thêm 2 giá trị liên quan đến
đầu kỳ và cuối kỳ trong khoản thời gian đang lọc."*

Decided on 2026-10-04 (each recorded in the rules above, with his words):

| Question | Answer |
|---|---|
| Where balances start | From zero; the first money row is 2026-03-26 (1b) |
| Which balances | Cash, bank, and their total (2a + total) |
| Purchase orders | Paid in full on their own date; gain a "Trả bằng" choice; the 198 existing ones count as cash (3a) |
| Past data | Stays as it is; cash shows negative from June 2026 (2b) |
| Drawer ↔ bank | One "Chuyển tiền" row, moves the split, not the total (1a) |
| How sales and purchases appear | One row per day and payment method, for both |

## 2. Hiện trạng

1. **Trạng thái.** Hand-typed rows: `ACTIVE` / `CANCELLED` as today (`BR-CASH-002`). New transfer
   rows: the same two, set the same way ("Huỷ" on the detail page; ADMIN may also delete).
   Sale and purchase day rows have no state of their own: they are sums of completed orders
   (`orders_v2.status = 'COMPLETED'`) and completed purchase orders (`purchase_orders.status =
   'COMPLETED'`); a voided order or a draft purchase order is simply not in the sum. They show
   under the "Đang dùng" and "Tất cả" status filters, never under "Đã huỷ".
2. **Nút.**
   - List: "+ Ghi khoản mới" (as today), new "+ Chuyển tiền". Per-row bin and tick boxes only on
     hand-typed and transfer rows (ADMIN); day rows have none (`removal.canRemove`, wave 7).
   - Transfer detail: "Chỉnh sửa", "Huỷ" (while active), "Xoá" (ADMIN).
   - Day row: no buttons; clicking it opens the day's list (§6.3).
   - Purchase order form: new "Trả bằng" and, for a transfer, "Tài khoản".
   - Purchase order detail, completed order: a "Trả bằng" block with its own "Lưu" — the only
     field of a completed order that can change here (§7).
3. **Danh sách.** For the chosen date range: hand-typed rows, transfer rows, and one row per
   (day, payment method) for sales and for purchases. Excluded: orders not `COMPLETED`, purchase
   orders not `COMPLETED`, cancelled rows unless the status filter asks for them. September 2026
   measured 2026-10-04: 46 sale rows + 17 purchase rows + 8 hand-typed rows = 71 rows, where one
   row per order would have been 657.
4. **Ô nhập.**
   - Transfer: date (required, a real calendar date); amount (whole đồng > 0, the `MoneyInput`
     box of `BR-CASH-005`); "Từ" and "Đến", each "Tiền mặt (két)" or an active bank account, and
     they must differ; note (optional). Refused with a Vietnamese message otherwise.
   - Purchase order "Trả bằng": Tiền mặt / Chuyển khoản, required, **nothing chosen in advance**
     on a new order (owner answer "1a", 2026-10-04: so nobody forgets to switch it for a
     transfer); saving without a choice is refused with "Chọn cách trả tiền". "Tài khoản": active bank
     accounts, required for Chuyển khoản, hidden and cleared for Tiền mặt; with exactly one
     active account it is preselected.
   - Filters: date range (as today), status (as today), new "Loại": Tất cả / Bán hàng / Nhập hàng
     / Ghi tay / Chuyển tiền; unknown value → Tất cả.
5. **Dữ liệu.** Serves money the app can see: sales, purchase orders, hand-typed rows,
   transfers. Deliberately not served: which bank account a POS transfer went to (the POS does not
   record it, §9); money the owner moves outside the app; per-account balances (one account
   exists); anything before 2026-03-26 (nothing exists then). Profit and loss, the POS, stock and
   cost are not touched.

Thêm, riêng cho việc này:
- **No copy.** Sale and purchase money is read from the orders and purchase orders every time,
  never written into `cash_entries`. Editing a purchase order's total or voiding an order changes
  the cash book on the next load.
- **Day = Asia/Saigon calendar day** of `orders_v2.created_at` (the basis of the P&L,
  `lib/reports/profit-and-loss.ts`; measured 2026-10-04: 0 of 3.183 completed orders fall on a
  different day by `completed_at`), of `purchase_orders.transaction_date` (falling back to
  `created_at`, as the P&L does), and of `entry_date` / `transfer_date`.
- **Split payments.** An order with payment rows (`order_payments`, from 2026-07-20) counts each
  row under its own method; an order without counts its `net_total` under
  `orders_v2.payment_method`. Measured 2026-10-04: one completed order is split; it counts as one
  order in both of that day's rows.

## 3. Data

### 3.1 New table `cash_transfers` (migration with `create table`)

| Column | Type | Rule |
|---|---|---|
| `id` | text PK | `CT-001`, `CT-002`, … via `generateNewId` |
| `transfer_date` | date not null | |
| `amount` | bigint not null | `> 0` |
| `from_account_id` | text null → `bank_accounts.id` RESTRICT | null = the cash drawer |
| `to_account_id` | text null → `bank_accounts.id` RESTRICT | null = the cash drawer |
| `note` | text not null default `''` | |
| `status` | text not null default `'ACTIVE'` | `ACTIVE` / `CANCELLED` |
| audit | as `cash_entries` | `created_*`, `updated_*`, `touch_updated_at` trigger |

Check: `from_account_id is distinct from to_account_id` (cash → cash and the same account twice
are refused). Why a table of its own and not a kind of `cash_entries`: a cash entry needs a
category whose side is income or expense (`BR-CASH-004`), and every total reads that side; a
transfer has neither.

### 3.2 `purchase_orders` gains how it was paid

- `payment_method text not null default 'CASH'`, check `in ('CASH','BANK_TRANSFER')`.
- `bank_account_id text null → bank_accounts.id RESTRICT`; check: `BANK_TRANSFER` needs it,
  `CASH` must not have it.
- Adding the column with a default fills the 198 completed orders (and any draft) with `CASH`
  inside the `alter table`; no row trigger fires and `updated_at` does not move. The same
  migration then drops the default, so a writer that forgets the field fails loudly instead of
  quietly writing `CASH` (matches answer 1a: no choice made for the user).
- **Writer inventory** (`fnbapp-bulk-data-change` §6): the live `save_purchase_order_atomic`
  (last redefined in `supabase/migrations/0078_retire_ledger_purchase_order.sql`) is the only
  insert; it must take and write the two fields. Sonnet confirms no other writer before the
  migration is proposed.
- Migration runs only with the owner's separate approval, together with the code that reads it.

### 3.3 Reading sales and purchases by day

A database view `cash_book_daily` (read only) returns one row per (source, day, method):
`source` (`SALE` / `PURCHASE`), `day` (date, Asia/Saigon), `method`, `bank_account_id` (purchases
only), `doc_count`, `amount` (always positive). The app never fetches every order to add them up.
Rows since 2026-03-27 measured 2026-10-04: a few hundred, so summing all of them before the range
for the opening balance is cheap.

## 4. Calculation (`lib/finance/cash-flow.ts`, pure, Sonnet)

Every movement has a day, a side (cash or bank) and a signed amount:

| Movement | Cash side | Bank side |
|---|---|---|
| Sale, cash | + | |
| Sale, transfer | | + |
| Purchase, cash | − | |
| Purchase, transfer | | − |
| Hand row, income (`ACTIVE`) | + if Tiền mặt | + if Chuyển khoản |
| Hand row, expense (`ACTIVE`) | − if Tiền mặt | − if Chuyển khoản |
| Transfer drawer → bank | − | + |
| Transfer bank → drawer | + | − |

- **Opening** (đầu kỳ) = sum of all movements dated before the range's first day.
  **Closing** (cuối kỳ) = opening + movements in the range. Each for cash, bank, and total.
  Nothing is typed in as a starting amount; there is no starting-date constant: nothing is dated
  before 2026-03-26, so "everything before" equals "from zero on 2026-03-26" (`BR-CASH-007`).
- **Tổng thu** = sales + hand income. **Tổng chi** = purchases + hand expense. Transfers count in
  neither (`BR-CASH-008`). The "Thu ngoài lãi lỗ" line stays (`BR-CASH-003`).
- **Theo nhóm** adds "Bán hàng" and "Nhập hàng" lines beside the categories.
- **Check that must always hold:** closing total = opening total + Tổng thu − Tổng chi. A test pins it.
- Whole đồng throughout; nothing rounds (`BR-DATA-*`).

## 5. Roles

As the cash book today: ADMIN and MANAGER view, add, edit, cancel; only ADMIN deletes a hand row
or a transfer (`requireOwner`, `BR-ACCESS-003`). Changing a purchase order's "Trả bằng": whoever
may save purchase orders today (`requireAdmin`).

## 6. Screen `/admin/finance`

### 6.1 Top
Two balance blocks above the totals: **Đầu kỳ (dd/MM/yyyy)** and **Cuối kỳ (dd/MM/yyyy)**, each
with Tiền mặt, Ngân hàng, Tổng. A negative figure shows its minus sign in red. Then Tổng thu /
Tổng chi and Theo nhóm as today, with the new lines.

### 6.2 Rows

| Kind | Mã | Nhóm | Bên | Số tiền | Cách trả | Tài khoản | Ghi chú |
|---|---|---|---|---|---|---|---|
| Sale day | — | Bán hàng | Thu | sum | Tiền mặt / Chuyển khoản | — | "23 đơn" |
| Purchase day | — | Nhập hàng | Chi | sum | Tiền mặt / Chuyển khoản | account if any | "2 đơn nhập" |
| Hand row | CE-… | category | Thu / Chi | as today | | | |
| Transfer | CT-… | Chuyển tiền | Chuyển | amount | "Két → ACB - Phin Di" | | note |

Default sort: date, newest first (the one-line `parseSort(..., "date")` of today). Day rows have no
code, so sorting by code would push them all to one end; this is why date stays the default — the
open owner question from wave 6 is answered by this design unless he says otherwise.

### 6.3 Clicking a row
- Hand row: its detail page, as today. Transfer: `/admin/finance/transfers/[id]`.
- Sale day: the order list for that day and method (`/admin/orders?from=D&to=D&payment=…`).
- Purchase day: the purchase-order list for that day and method (new `pay` filter there).

**Cross-impact found while designing:** the order list (`app/admin/orders/page.tsx`) turns a day
into a time range with the server's own clock (`new Date("D T00:00:00")`); on a server running in
UTC that range starts at 07:00 Saigon time and ends at 06:59 the next morning. It also filters on
`orders_v2.payment_method`, so the one split order shows under one method only. Fix in this work:
the day range goes through `toSaigonUtcRange` (`lib/shared/report-time.ts`), so the list's count
matches the cash-book row; the split order stays a known one-off (§9).

### 6.4 Transfer pages
`/admin/finance/transfers/new`, `/admin/finance/transfers/[id]`, `/admin/finance/transfers/[id]/edit`,
on the detail template (`DetailFrame`, `DetailHeader`, `FieldList`, `RemoveRecordButton`); no popup
(`BR-DATA-007`). Phone: the same fields stacked. No menu entry of their own: reached from the cash
book's "+ Chuyển tiền" and its rows (the menu-completeness test is told so).

## 7. Purchase order "Trả bằng"

- Form (`PurchaseOrderForm.tsx`): "Trả bằng" beside the date; "Tài khoản" appears for Chuyển khoản.
- Detail page of a completed order: a small "Trả bằng" block with "Lưu", inline, no popup. It
  changes only `payment_method` and `bank_account_id`; stock, cost and the asset register do not
  read them. The deferral of completed-order edits to wave 8 (commit `fd260f46`) is about lines and
  amounts, which this does not touch.
- The purchase-order list shows "Trả bằng" as a secondary column and gains the `pay` filter.

## 8. What does not change
Profit and loss and its tax-free revenue ceiling; the POS; `cash_entries` rows (no row is added,
changed, or moved); stock, cost, assets; the two "Doanh thu ghi tay" rows (`BR-CASH-001` exception).

## 9. Known limits, told to the owner
- The POS does not record which bank account a transfer went to. All sale transfers count to the
  bank side as a whole. Fine while there is one account (`BA-001` "ACB - Phin Di"); a second account
  would need the POS to ask, a separate piece of work.
- Cash is negative from June 2026 because past deposits were never recorded (`BR-CASH-007`, 2b).
- The one split order (measured 2026-10-04) shows in only one of the two order lists the cash book
  links to.

## 10. Worked example — September 2026 (measured 2026-10-04, read only)

Filter: 01/09/2026 – 30/09/2026.

| | Tiền mặt | Ngân hàng | Tổng |
|---|---|---|---|
| Đầu kỳ 01/09/2026 | −10.341.000đ | 23.756.578đ | 13.415.578đ |
| Cuối kỳ 30/09/2026 | −7.351.887đ | 27.972.578đ | 20.620.691đ |

- Tổng thu: sales 15.442.000đ (11.226.000đ cash in 465 orders, 4.216.000đ transfer in 159 orders)
  + hand income 2.443.400đ (`CE-040`, Vốn góp) = 17.885.400đ.
- Tổng chi: purchases 9.043.287đ (25 purchase orders) + hand expense 1.637.000đ = 10.680.287đ.
- Check: 13.415.578 + 17.885.400 − 10.680.287 = 20.620.691đ = closing total.
- Rows for 15/09/2026: "Bán hàng · Tiền mặt · 23 đơn · 522.000đ", "Bán hàng · Chuyển khoản ·
  11 đơn · 482.000đ", "Nhập hàng · Tiền mặt · 2 đơn nhập · 536.023đ" (`PO-180` from "Không rõ"
  30.000đ, `PO-181` from Thế Kỷ Xanh 506.023đ).
- Had a 5.000.000đ "Chuyển tiền" Két → ACB been recorded on 10/09/2026: closing cash
  −12.351.887đ, bank 32.972.578đ, total unchanged, Tổng thu and Tổng chi unchanged.

## 11. Tests that must exist
- `cash-flow.ts`: each line of the §4 table; opening excludes the first day, closing includes the
  last; cancelled hand rows and cancelled transfers count nowhere; a transfer leaves the total and
  both Tổng unchanged; the closing = opening + thu − chi identity on a mixed fixture; a split order
  counts once in each method's row.
- The September 2026 figures above, re-measured with the view, before the screen ships: 0 lệch on
  the three closing figures and on Tổng thu / Tổng chi.
- Transfer rules: same from and to refused, amount 0 or text refused, unknown account refused.
- Purchase order: Chuyển khoản without an account refused; Tiền mặt with an account refused.
- Screen: day rows have no tick box or bin; "Loại" filter; the balance blocks; no `/edit` link in
  the list.

## 12. Split of the work
- Backend (Sonnet): migration (table, columns, view), `lib/finance/cash-flow.ts`, transfer rules and
  actions, purchase-order save and the "Trả bằng" action, order-list day range fix, tests.
- UI (Gemini via `agy`): cash book top and rows, transfer pages, purchase-order form, detail block,
  list column and filter, tests.
- Opus: plan, reviews, the five gates, migration request, owner check list.

Đã xem: `app/admin/finance/page.tsx`, `actions.ts`, `CashBookClient.tsx` (columns, totals),
`lib/finance/cash-entry-rules.ts` (`summariseEntries`), `app/admin/orders/page.tsx` and the list
query in `actions.ts`, `lib/purchasing/purchase-order-list.ts` (filters), the columns of
`purchase_orders`, `order_payments`, `bank_accounts`, `cash_entries`; which migration last defines
`save_purchase_order_atomic`. Chưa xem: the body of `save_purchase_order_atomic` in `0078`,
`PurchaseOrderForm.tsx`, the purchase-order detail page, the P&L's purchase-order date code beyond
line 189.
