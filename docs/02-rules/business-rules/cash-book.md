# Cash book rules

The cash book (`/admin/finance`, tables `cash_categories`, `bank_accounts`,
`cash_entries`, `cash_transfers`, view `cash_book_daily`) shows every movement
of money: hand-typed rows, transfers, and the sale and purchase money read from
the orders themselves.
Flow: `docs/03-workflows/cash-book.md`.

### BR-CASH-001 — Sale and purchase money shows in the cash book but is never typed into it, with one dated exception

**Status:** `APPROVED` — owner decision 2026-09-08; exception 2026-09-11;
changed 2026-10-04 and built the same day (migration `0107`).

**Changed 2026-10-04.** Owner: *"lưu tất cả các lần ảnh hưởng đến dòng tiền
vào, tức là bao gồm cả tiền thanh toán đơn nhập hàng và tiền bán hàng."* The
cash book shows every movement of money: each completed sale (cash or
transfer, split by its payment rows where it has them) and each completed
purchase order, next to the rows typed by hand. Those two kinds are read from
the orders and purchase orders themselves, never copied or retyped, so nothing
is counted twice and profit and loss does not change. A purchase order is
taken as paid in full on its own date (owner answer "3a", 2026-10-04); it
gains a payment choice, cash or transfer (labelled "Trả bằng" until 2026-10-06, then "Hình thức thanh toán", shown under the order's total, owner 2026-10-06; paying one order by several methods is approved in principle and waits for its own design), and the 198 completed orders that
exist on 2026-10-04 count as cash until the owner changes one. On a new purchase
order nothing is chosen in advance: whoever enters it must pick "Tiền mặt" or
"Chuyển khoản", so nobody forgets to switch it for a transfer (owner answer
"1a", 2026-10-04).

**One row per day and payment method, for sales and for purchases** (owner
2026-10-04). Sales: *"Theo em khuyến nghị"*, after being shown that September
2026 had 624 sales against 8 hand-typed rows, and the example for 2026-09-15:
"Bán hàng · Tiền mặt · 23 đơn · 522.000đ" and "Bán hàng · Chuyển khoản · 11 đơn
· 482.000đ". Purchases, the same day: *"Anh nghĩ nhập hàng em cũng làm giống đơn
bán hàng đi, cho nó gọn"*. A day with no cash sale has no cash row. Opening a
row lists that day's orders, or purchase orders, paid that way.

What still holds from 2026-09-08: sales live in the POS, purchases in
purchase orders, and nobody types a sale or a purchase into the cash book by
hand — that would count it twice. Hand-typed rows remain for everything else:
running costs, other income, capital put in.

**Exception.** Two rows (1.728.578đ by transfer, 6.683.290đ in cash,
8.411.868đ together) are sales revenue whose order data was lost while the app
was being set up and rebuilt. The import put them under "Thu khác" and dated
them 2026-09-02, the day the owner wrote them into his sheet. On 2026-09-11 the
owner changed both in the app himself: the date first to 2026-05-01 and then to
2026-04-30, so every monthly total counts them in April 2026, and the category
to a new income category he created, "Doanh thu ghi tay" (measured the same
day: `CE-033`, `CE-034` under `CFC-006`, which counts toward profit and loss).

**In profit and loss they are sales revenue** (owner, 2026-09-11: "Tính vào
doanh thu"). The P&L adds them to that month's revenue on a line of their own,
"Doanh thu ghi tay", so they stay distinguishable from revenue the POS
recorded; the tax-free revenue ceiling counts them too. His own sheet had left
them out of its P&L and counted them only as cash received. The POS does
not have them, so recording them here is the only record and does not double
count. Owner, 2026-09-11: "Là khoản doanh thu bị mất dữ liệu từ lúc lập app và
xây dựng lại app, nạp vào bình thường." The exception covers these two rows
only; it is not a route for future sales.

**What this took out of the first import (owner, 2026-09-11).** The owner's
sheet held 54 rows; 38 were imported. Six rows of tắc and chanh (529.000đ) were
already entered as purchase orders, matched amount for amount, so importing them
would have counted them twice. Ten rows of đá viên and túi đựng khoai
(2.967.000đ) are catalogued purchased items with no purchase order yet; the
owner chose to record them as purchase orders himself ("Chuyển sang đơn
nhập"). The rule that follows: anything bought that is in the purchased-item
catalogue goes through a purchase order, never through the cash book.

### BR-CASH-002 — Cancelled rows leave every total; income and expense are never netted

**Status:** `APPROVED` — owner decision 2026-09-08.

A row is cancelled, not deleted. It stays visible as "Đã huỷ" and counts in no
total. Income and expense are summed separately and shown side by side; the
screen never shows one figure that is income minus expense.

### BR-CASH-003 — Income outside profit and loss is shown apart and excluded from P&L

**Status:** `APPROVED` — owner decision 2026-09-08.

A category marked "không tính vào lãi lỗ" (seeded: "Vốn góp") still counts
toward total income on the cash book, shown as its own line inside it, and is
excluded from any profit-and-loss figure. The flag lives on the category, not
on each row: changing it re-classifies every past row of that category,
earlier months included. The form warns before saving such a change.

### BR-CASH-004 — A category's side is fixed once it has a row

**Status:** `APPROVED` — owner decision 2026-09-11.

A category belongs to income or expense. Once any row — cancelled rows
included — uses it, that side cannot be changed; to record the other side,
create a new category. Owner, 2026-09-11: "Khoá, tạo nhóm mới." Why: rows carry
no side of their own, so switching a used category would silently move every
past row, and every past month's totals, to the other side.

### BR-CASH-005 — Amounts are whole đồng, and a dot separates thousands

**Status:** `APPROVED` — whole đồng: owner decision 2026-09-08. How the box
behaves: owner decision 2026-09-11. **Marks swapped 2026-10-07 (`BR-UI-008`):**
the box now inserts commas (`150,000`), and refuses both a dot and a comma typed
in. Everything else below stands.

An amount is a positive whole number of đồng. The amount box takes digits only
and puts the dots in itself as the owner types: he types `150000`, the box
shows `150.000`. A letter, dot, comma or minus sign typed or pasted into it is
dropped, so nobody can add a mark of their own. Owner, 2026-09-11: "máy sẽ tự
động thêm dấu chấm cứ mỗi 3 số … và máy chỉ cho phép nhập số để đảm bảo không
có ai tự ý thêm bấy kỳ dấu gì." The server still checks the amount again and
never rounds it: it accepts plain digits or dot-grouped digits and refuses
anything else with a message saying why.

This replaces the first version of 2026-09-11, where the box accepted a typed
`150.000` as text and only refused bad input on save. The server check was
added after a review found `150.000` saved as 150đ; it stays as the backstop.

### BR-CASH-006 — A category can be marked as sales revenue

**Status:** `APPROVED` — owner decision 2026-09-11 (P&L design, `docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md`).

An income category that counts in profit and loss can carry a second flag, "Tính là doanh thu bán hàng" (`cash_categories.is_sales_revenue`). Its rows then count as sales revenue on the P&L, on the "· trong đó ghi tay" line under Doanh thu (`BR-PNL-003`), instead of under Thu khác. Owner, 2026-09-11, on the two lost-revenue rows: "Tính vào doanh thu".

- **Only an income category that counts in profit and loss** can carry it. The form hides the box otherwise and clears it when the category switches to Chi or stops counting in profit and loss; the server refuses it ("Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng."); a database check refuses it a third time (migration `0102`).
- **It sits on the category, not on each row**, like `affects_pnl` (`BR-CASH-003`). Changing it moves every past month of that category, so on a category that already has rows the form asks before saving.
- **Only the owner sets it.** The migration adds the column as false everywhere; after release the owner ticks it on "Doanh thu ghi tay" (`CFC-006`) himself. Until then that category's two rows show under Thu khác, and April's revenue reads 8.411.868đ short while net profit is unchanged.

### BR-CASH-007 — Opening and closing balances, for cash and bank apart and together

**Status:** `APPROVED` — owner decision 2026-10-04; built 2026-10-04
(`lib/finance/cash-flow.ts`).

For the date range being viewed, the cash book shows an opening balance (the
first day, before any of its movements) and a closing balance (after the last
day): one for cash, one for the bank accounts, and their total. Owner: *"2a nhưng
có số tổng không?"* — the answer is yes, three figures each.

**Starting point.** Every balance counts from zero on 2026-03-26, the date of the
first cash-book row (owner answer "1b", 2026-10-04). No opening amount is typed
in; the owner was told before choosing that the cash figure then will not match
what is physically in the drawer.

**Data before 2026-10-04 stays as it is** (owner answer "2b", 2026-10-04): no
back-filling of past deposits or withdrawals, no re-marking of old purchase
orders paid by transfer. Measured 2026-10-04 on that basis, the cash figure is
negative from June 2026 (end of September 2026: cash −7.351.887đ, bank
27.972.578đ, total 20.620.691đ); the owner saw these figures before choosing.
The total is right; only its split between cash and bank is off for those
months.

### BR-CASH-008 — Money moved between the drawer and a bank account is a transfer, not income or expense

**Status:** `APPROVED` — owner decision 2026-10-04; built 2026-10-04 (table
`cash_transfers`, migration `0107`; rules in `lib/finance/cash-transfer-rules.ts`).

Depositing cash into a bank account, or withdrawing it into the drawer, is
recorded as one "Chuyển tiền" row: from where, to where, how much, which day.
It lowers one balance and raises the other by the same amount, leaves the total
unchanged, and counts in neither Tổng thu nor Tổng chi, nor in profit and loss
(owner answer "1a", 2026-10-04, *"Làm theo em khuyến nghị"*). Example given
before choosing: 5.000.000đ deposited into ACB on 2026-09-10 shows cash −5.000.000đ,
bank +5.000.000đ, total unchanged. Why: in accounting this is one internal
transfer (cash account 111 to bank account 112), not money the shop earned or
spent; recording it as an expense row plus an income row would inflate both
totals. The owner had asked whether two rows matched accounting better; he was
told this, and chose the single row.
