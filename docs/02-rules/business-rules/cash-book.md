# Cash book rules

The cash book (`/admin/finance`, tables `cash_categories`, `bank_accounts`,
`cash_entries`) records money that moves outside the sale and purchase flows.
Design: `docs/superpowers/specs/2026-09-08-so-thu-chi-design.md`. Flow:
`docs/03-workflows/cash-book.md`.

### BR-CASH-001 — The cash book never holds sale or purchase money, with one dated exception

**Status:** `APPROVED` — owner decision 2026-09-08; exception 2026-09-11.

Sales live in the POS, purchases in purchase orders. The cash book takes
everything else: running costs, other income, capital put in. Recording a
sale or a purchase here counts it twice.

**Exception.** Two rows dated 2026-09-02 under "Thu khác" (1.728.578đ by
transfer, 6.683.290đ in cash, 8.411.868đ together) are sales revenue whose
order data was lost while the app was being set up and rebuilt. The POS does
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

**Status:** `APPROVED` — whole đồng: owner decision 2026-09-08. The dot rule
is a reviewed invariant added 2026-09-11 after a review found `150.000` saved
as 150đ; it is not an owner decision.

An amount is a positive whole number of đồng. The screen accepts plain digits
(`150000`) or digits grouped by dots (`150.000`); anything else — a comma, a
decimal part, a minus sign — is refused with a message saying why. It is never
rounded.
