# Thu chi: area audit and proposal

This page covers master-plan rows 6c, 6d and Kế hoạch A step 5 (`docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md`) for the Thu chi area: menu group "Thu chi" (Sổ thu chi, Chuyển tiền, Nhóm thu chi, Tài khoản ngân hàng, Khoản chi hằng tháng). It follows the owner's choice "Làm lại từng mảng" (2026-10-15), the same as the Bán hàng and Kho pages:
- keep the reconciled money core;
- rebuild where the root is wrong;
- the till never stops (it reads none of these tables; 0 hits in `app/pos` and `lib/pos`).

Two read-only audits ran on 2026-10-15 against the live server and the branch `chore/next-16`: data structure and balances (SQL through the management API), screens and server code (every non-test file under `app/admin/finance` and `lib/finance`). Every number below was measured that day. Re-measure before use.

Owner instruction the same day, given to fnbapp-d7 and confirmed to fnbapp-f5: *"Tạm làm tất cả theo em khuyến nghị, rồi tất cả những gì em đã khuyến nghị thì tổng hợp lại cho anh khi có kết quả cuối."* So every open design choice below takes the recommendation and is marked "chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15". Two things are not covered by that authorisation and stay as questions: one revisits a choice he made on 2026-10-04, the other needs a fact only he knows. Pushes, migrations and data writes still need his yes each time.

## Hiện trạng

1. **States.**
   - Hand rows (`cash_entries`): ACTIVE or CANCELLED. Live: 41 rows, 41 ACTIVE, CE-001 to CE-041, 2026-03-26 to 2026-10-07; 40 cash, 1 transfer (CE-033). No un-cancel; "Xoá hẳn" is the only way out, ADMIN only.
   - Transfers (`cash_transfers`): ACTIVE or CANCELLED. Live: **0 rows** since the table was built on 2026-10-04.
   - Groups (`cash_categories`): ACTIVE or INACTIVE. Live: 7, all ACTIVE: 4 Chi (Vận hành 18 rows, Điện nước gas 12, Marketing 5, Nhân sự 1), 3 Thu (Thu khác 0 rows, Vốn góp 3 rows and không tính lãi lỗ, Doanh thu ghi tay 2 rows and tính là doanh thu).
   - Bank accounts: ACTIVE or INACTIVE. Live: 1, "ACB - Phin Di", ACTIVE, used by 1 hand row, 0 transfers, 0 purchase orders.
   - Monthly items (`monthly_expense_items`): ACTIVE or INACTIVE. Live: **0 rows**; the screen went live 2026-10-15. No hand row is linked to one.
   - Day rows from the view `cash_book_daily` have no status: 283 sale days (3,448 orders, 92.980.000đ) and 107 purchase days (203 orders, 102.917.248đ).
   - Every status value can be set from a screen. No dead state.
2. **Buttons.**
   - 0 browser popups, 0 input boxes in a popup, 0 finance files on the no-popups exception list. Every yes/no goes through the app's own inline `confirm`.
   - All 5 permanent deletes sit behind `requireOwner()` (`BR-ACCESS-003`).
   - Khoản chi hằng tháng is the odd one out: "Sửa" where every other page says "Chỉnh sửa"; "Ngừng dùng" asks nothing; "Xoá" uses its own yes/no instead of the shared button; the button shows on an item whose only linked rows are cancelled, and the server then refuses.
   - Chuyển tiền detail says "Xoá", the rest say "Xoá hẳn"; it has no "Ghi sổ lúc".
   - Deleting a group checks hand rows only. A group used only by a monthly item hits the database key and the user sees the generic "Có lỗi xảy ra…".
3. **Lists.**
   - The ledger reads every hand row, transfer and day row from the beginning of time up to the range's last day (needed for Đầu kỳ), then shows the range, 20 rows a page, newest day first, hand rows newest code first (the `BR-DATA-008` exception the owner kept on 2026-10-05).
   - Two totals on one screen disagree under a Loại filter: the Đầu kỳ / Cuối kỳ / Tổng thu / Tổng chi cards cover the whole range whatever the filter; the total row under the column titles follows the filter.
   - A purchase day row is split per bank account, but its link filters the purchase-order list by method only.
   - Khoản chi hằng tháng list: sorted by name Z→A, filter defaults to Tất cả, no Mã column on a computer. The other three lists sort by code descending and open at Đang dùng.
   - A hand row's "Khoản chi hằng tháng" link is shown nowhere: not in the ledger, not on the row's page.
4. **Inputs.**
   - Amount: digits only, comma thousands, whole đồng, > 0, checked three times (box, server, database). 0 of 41 rows at or below zero.
   - Date: the server checks only "not empty" on a hand row. A future date, 2026-02-30, or a date before 2026-03-26 (the day balances start from zero, `BR-CASH-007`) all save. 0 of 41 rows are in the future.
   - Group and account on a hand row: the server checks neither exists nor is ACTIVE; a retired or Thu group posted into an expense row saves. The database key is the only guard.
   - Three different rules for a retired account: a hand row never checks; a transfer refuses even its own old account, so editing the note of an old transfer whose account was retired since is refused; a purchase order allows its own. Same for a monthly item whose group was retired.
   - Note has no length limit anywhere. Longest today: under 80 characters.
   - Group side (Thu/Chi) is locked by hand rows only; a Chi group used only by monthly items can switch to Thu, after which its reminders can never be cleared.
   - A monthly item can move to another group while it has rows; its old rows then fail the "thuộc nhóm khác" check on edit.
   - Every number box has `inputMode="numeric"`. 0 missing.
5. **Data served.**
   - Balances today (2026-10-15), counting from zero on 2026-03-26 as the owner chose on 2026-10-04 ("1b"): **Tiền mặt −3.593.751đ, Ngân hàng 31.485.578đ, Tổng 27.891.827đ.** Month ends: cash went negative in June (−5.606.495đ), July −15.528.644đ, September −7.351.887đ.
   - Why the split is off: 203 of 203 purchase orders are "Tiền mặt" (102.917.248đ), 876 completed sales are "Chuyển khoản" (29.712.000đ), and 0 transfers were ever recorded. So money that arrived by transfer never leaves the bank side, and money that left the bank never leaves the cash side. The owner saw the September figures before choosing "2b" (no back-filling) on 2026-10-04.
   - **It is still drifting after that choice.** Since 2026-10-04: 263 sales, 91 of them by transfer; 5 purchase orders (860.000đ), all "Tiền mặt"; 0 transfers. Nothing on the screen tells the owner the cash figure is a book figure.
   - The 53 Shopee purchase orders (26.048.237đ, 2026-03-26 to 2026-09-30, imported from his sheet on 2026-08-27) are all "Tiền mặt". Moving them to "Chuyển khoản" on ACB would make September read cash +18.696.350đ, bank 1.924.341đ, total unchanged 20.620.691đ. Example: PO-195, 30/09/2026, Bột cà phê MR.PHIN Robusta Dak Mil from Phương Vy Official Store, 2.443.400đ.
   - Lãi lỗ reads hand rows and their groups only (never payment method, accounts, transfers or day rows). Changing a group's "tính vào lãi lỗ", "tính là doanh thu" or side re-classifies every past month there.
   - Legal: at under 1 tỷ a year of revenue the shop is in the no-VAT, no-PIT group of Thông tư 152/2025/TT-BTC, which requires only the sales book S1a-HKD. No cash-book form is required. The ledger is a management tool and can take any shape.

**Clean results:**
- Cancelled rows and transfers are excluded from every balance and total (`BR-CASH-002`, `BR-CASH-008`), with tests.
- Every finance write touches one table; no two-table write needs a Postgres function.
- Backup covers all 5 tables.
- 0 "N/A", 0 English sentences shown to the user inside finance screens. (The shared role message "Chỉ Admin hoặc Manager…" is outside the area.)

Seen: the SQL results (scratchpad `thuchi-1.sql`, `thuchi-2.sql`), every non-test file under `app/admin/finance` and `lib/finance`, `lib/dashboard/monthly-reminders.ts`, migrations 0101, 0102, 0107, 0109, the cash-book rules and workflow, `lib/purchasing/purchase-order-payment.ts`.

Not seen:
- any Thu chi screen in a browser (no dev server was running on 8386);
- RLS and grants;
- the purchase-order list's date filter (whether it uses `transaction_date` like the view);
- test bodies (names only);
- KiotViet's exact "Số dư đầu kỳ" steps (its page says the balance exists and must be re-synced after a change; the step-by-step was not found).

## Verdict: the root of the area

- **Keep:**
  - the rule set `BR-CASH-001` to `BR-CASH-009` and the money core: sales and purchases read from their own documents, never retyped; Thu and Chi never netted; groups carry the P&L flags;
  - `summariseCashBook` and the Đầu kỳ / Cuối kỳ cards: they are already a direct-method cash-flow statement for any range;
  - the shared list, detail, form and time-filter templates the screens already wear;
  - the three-way amount check.
- **Wrong at the root, so fix before anything else:**
  1. **The cash figure is wrong and the screen does not say so.** −3.593.751đ in the drawer is impossible, and it keeps drifting because no screen leads the owner to record a deposit, a withdrawal, or a transfer-paid purchase. KiotViet, Sapo and Toast all anchor the book to a counted figure: KiotViet FnB keeps a "Số dư đầu kỳ" per fund (cash, each bank account) and a "Tổng quỹ = Tiền mặt + Ngân hàng"; Toast closes every drawer on "Expected Closeout Cash" against "Actual Closeout Cash" and shows the "Cash Overage/Shortage". Direction, see Q1: a "Kiểm quỹ" row that records what was counted and lets the book continue from it. Until then: the Tiền mặt card says "theo sổ" and, when negative, "sổ chưa ghi tiền gửi ngân hàng".
  2. **Server checks are thinner than the Kho side.** A hand row saves with a future date, a retired group, a Thu group as an expense, or a date before the book starts; the database key is the only guard. 0 rows are affected today, so this is prevention, not repair.
  3. **Monthly items were bolted on without the cross-checks** the other entities have: side change, retirement and deletion of a group ignore them; the delete button and the server disagree. 0 rows today, so fix before the owner creates the first one.

## Owner decisions

Two questions, asked once at the end with the summary. Everything else is taken by recommendation.

| # | Question | Options | Recommendation | Source |
|---|---|---|---|---|
| Q1 | On 2026-10-04 the owner chose to count balances from zero with no opening amount ("1b"). The cash figure now reads −3.593.751đ and keeps drifting. Add "Kiểm quỹ": a page where he types the counted drawer cash and the bank balance on a date; the book shows "theo sổ", "đếm được", "lệch", and continues from the counted figure? | (a) yes, build Kiểm quỹ (one new table, four steps); (b) only a one-time opening balance per fund, typed in settings; (c) leave as is | **(a).** A one-time figure drifts again within a month (it did in 11 days). A count can be repeated whenever the drawer is emptied. The difference stays out of Thu, Chi and Lãi lỗ, on its own line, because today's difference is a bookkeeping gap, not a loss. Not auto-taken: it revisits his 2026-10-04 choice | KiotViet FnB sổ quỹ (số dư đầu kỳ per fund, Tổng quỹ); Toast cash drawer reports (expected vs actual, overage/shortage) |
| Q2 | Were the 53 Shopee purchase orders (26.048.237đ) paid from the ACB account? | (a) yes: one data write moves all 53 to "Chuyển khoản · ACB - Phin Di"; (b) he changes them one by one in Sửa phiếu; (c) no, leave | **(a) if yes.** Lãi lỗ does not change; only the cash/bank split of March to September does. Not auto-taken: it needs his fact. If Q1 is (a), the count fixes today's split anyway and Q2 only improves the monthly history | Kho page Q6 |

Taken by recommendation (chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15):

| # | Choice | Taken | Why |
|---|---|---|---|
| R1 | Cash-flow report "Báo cáo lưu chuyển tiền tệ" (master plan section 4) | A "Theo tháng" view of the ledger: one row per month with Đầu kỳ, Thu bán hàng, Thu ghi tay (by group), Chi nhập hàng, Chi ghi tay (by group), Cuối kỳ, cash and bank apart. No legal template: the shop's group needs none. Built from `summariseCashBook` per month, no new table | Both regimes the memory names (TT152/2025 for households, TT58/2026 for micro companies) require no cash-flow statement at this size; the figures already exist |
| R2 | Paying one purchase order several ways (Kho Q5) | Not built until a real order needs it. 0 of 203 orders do | A new table and a four-step design for a case that has not happened |
| R3 | Excel export of the ledger (KiotViet and Sapo export S6/S7 forms) | Not now. The list already shows totals; no form is required | Revenue under the threshold |
| R4 | "Người nộp / nhận" field (KiotViet, Sapo have it) | Drop the column instead. 0 of 41 rows use it, 0 readers | The note carries it today ("Ngoại giao - CAKV") |
| R5 | The two totals under a Loại filter | The cards keep the whole book and gain the caption "cả sổ, mọi loại"; the total row keeps following the filter | Đầu kỳ / Cuối kỳ must never follow a filter |
| R6 | One rule for a retired account or group on edit | The purchase-order rule everywhere: ACTIVE, or the row's own | It is the only one of the three that lets an old row be edited |
| R7 | Hand-row date | Must be a real calendar date, not after today (Asia/Saigon), not before 2026-03-26 | `BR-CASH-007`; the transfer form already checks the date |

## Technical work, no owner decision (Opus decides, reports)

| Item | Who | Migration | Till risk |
|---|---|---|---|
| Root 2: `parseCashEntry` checks the date (R7); the action checks the group exists, is ACTIVE or the row's own, and has the side the row needs; the account likewise (R6). Vietnamese messages. Tests first | Sonnet | no | none |
| Root 3: group side change and retirement refuse while an ACTIVE monthly item uses the group; `deleteCashCategory` pre-checks monthly items with a Vietnamese sentence; `updateMonthlyItem` refuses a group change once the item has rows; the delete button hides when any row, cancelled included, is linked (count all statuses) | Sonnet | no | none |
| Transfer edit uses R6 (its own retired account allowed) | Sonnet | no | none |
| Note length: 500 characters, box `maxLength` and server check, hand rows and transfers | Sonnet + Gemini | no | none |
| Purchase day row link carries the account (`&account=`), and the purchase-order list filters on it | Sonnet | no | none |
| `sideOf` in `cash-flow.ts` and the check script agree: CASH is cash, BANK_TRANSFER is bank, anything else is refused at write time, so neither needs a default | Sonnet | no | none |
| Khoản chi hằng tháng list and page on the shared templates: code descending, Đang dùng default, Mã column, "Chỉnh sửa", inline confirm on Ngừng dùng, shared delete button, no emoji | Gemini | no | none |
| Chuyển tiền page: "Xoá hẳn", "Ghi sổ lúc" | Gemini | no | none |
| Hand-row page and ledger show the monthly item ("Khoản chi hằng tháng: Tiền điện") | Gemini | no | none |
| Tiền mặt card: "theo sổ"; when negative, the line "sổ chưa ghi tiền gửi ngân hàng" (`Alert`, not a hand-drawn box); R5 caption | Gemini | no | none |
| 10 hand-drawn error boxes onto `Alert`; `CategoryForm` and `BankAccountForm` get the try/catch and double-tap guard the other three forms have | Gemini | no | none |
| Dead code: `cash_entries.payer` readers (none) and the import script line; `cashBookRowTotals.net` and `.count`; unused props `canDelete`, `categories`, `accounts` on `CashBookClient`, `canDelete` on the two other clients; exports with no importer (`AuditCreateColumns`, `AuditUpdateColumns`, `CashBookRowKind`, `CashBookRowTotals`, `CashEntryFields`, `CashTransferFields`, `CashBookTotals`, `CASH_END` or use it) | Sonnet | no | none |
| Duplication: the 5 finance `safeReturnTo` copies (2 files, 3 inline) onto the one shared helper the Kho and Bán hàng rows also need (13 copies in `app/`); the four edit-page "isOwnDetail / listReturnTo / detailHref" blocks into one | Sonnet | no | none |
| Whole-table reads: `categories/[id]/edit` loads every hand row to learn `hasEntries`; `getMonthlyItems` loads every hand row for two callers that use only `.item`. Count queries instead | Sonnet | no | none |
| R1 "Theo tháng" view of the ledger: a tab beside the list, table on a computer, month cards on a phone; `summariseCashBook` per month | Sonnet + Gemini | no | none |
| Docs: `docs/03-workflows/cash-book.md` five answers (Q3 names `getCashEntries`, removed 2026-10-15; Q5 names `summariseEntries`, removed); `BR-CASH-007` gains the "theo sổ" caption; `BR-CASH-009` gains the group cross-checks; the Kho page's Q6 points here | Opus | no | none |

### Design direction: Kiểm quỹ (only if Q1 is (a))

New table and screen, so it gets its own design page and plan (four steps):
- `/admin/finance/counts`: a list of counts, code `KQ-xxx`, date, fund (Tiền mặt or an account), "theo sổ", "đếm được", "lệch", who. Newest code first. "Tạo" opens a page that shows the book figure for the chosen fund and date and asks for the counted amount, digits only.
- A count writes one row (`cash_counts`: id, count_date, bank_account_id null for cash, book_amount, counted_amount, note, status, audit columns). `summariseCashBook` treats the row as a movement of `counted − book` on that fund, dated that day, in neither Tổng thu nor Tổng chi nor Lãi lỗ, shown on its own line "Lệch kiểm quỹ" under the cards and as a ledger row of kind "Kiểm quỹ". Cancel like a hand row; "Xoá hẳn" ADMIN only.
- The owner's first count sets the book to the drawer and the bank app. Each later count shows the real overage or shortage since the last one.
- Sources: KiotViet FnB sổ quỹ (https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/so-quy-web-fnb/so-quy/, Tiền mặt / Ngân hàng / Tổng quỹ, số dư đầu kỳ per fund); Toast cash drawer reports (https://support.toasttab.com/en/article/Cash-Drawer-Reports-Overview, Expected vs Actual Closeout Cash, Cash Overage/Shortage).

## Data writes, each needs the owner's approval to run

1. Q2 (a): 53 purchase orders with source Shopee, `payment_method` → `BANK_TRANSFER`, `bank_account_id` → BA-001. Dry run prints the 53 ids and 26.048.237đ; `--apply` writes; re-read shows 0 Shopee orders still "Tiền mặt". Lãi lỗ before and after: identical (`verify-pnl-monthly` 0 mismatches). Script under `scripts/`, so written by Sonnet and reviewed, never by hand.
2. Nothing else. 0 cancelled rows, 0 orphan links, 0 future dates.

## Structure work, one migration batch

The till is not exposed. Order "code stops reading → migration → code stops sending" applies only to `payer`, which nothing reads or sends except the import script's `null`.

- Drop `cash_entries.payer` (null on 41 of 41, 0 readers).
- `cash_counts` if Q1 is (a), with its own `RESTRICT` key to `bank_accounts`, amount checks (`counted_amount >= 0`), status check.
- No other dead column: `bank_name` and `account_number` are set on 1 of 1 and shown; `monthly_item_id` is new; `updated_by_*` are written on every edit and kept for the audit even though no screen shows them. `cash_transfers.note` is NOT NULL '' while `cash_entries.note` is nullable: left as is, 0 rows either way.

## Order of work

1. Root 2 and root 3 (server checks, monthly-item cross-checks), R6, R7. Small, tests first; protects the first monthly item the owner creates.
2. Dead code, duplication, whole-table reads, `sideOf`. No visible change.
3. Screen clean-up on the existing templates (Khoản chi hằng tháng, Chuyển tiền, error boxes, "theo sổ" caption, monthly item shown, day-row link). Waits for the common template (6c) that fnbapp-f5 is settling; only the differences above are Thu chi's own.
4. R1 "Theo tháng" view.
5. Q1 (a): Kiểm quỹ, four steps. Q2 (a): the data write, approved separately.
6. The migration batch (`payer`, and `cash_counts` if Q1 is (a)), approved separately, then the push.
