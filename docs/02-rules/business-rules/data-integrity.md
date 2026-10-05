# Data integrity: backdated, audit/recovery, and backup rules

## Backdated transaction rules

### BR-BACKDATE-001 — Creation time and effective time are distinct

**Status:** `APPROVED`

A purchase, stock adjustment, or production event created later with an earlier effective time is a backdated event. Detection must preserve both timestamps and the affected historical window.

### BR-BACKDATE-002 — Backdated impact requires review

**Status:** `APPROVED`

Detected events follow the reviewed backdated-ledger path. The system must not silently recompute pinned historical sales merely because a new ledger row becomes visible in replay.

### BR-BACKDATE-003 — Historical gaps remain evidence

**Status:** `APPROVED`

Known historical gaps may be locked/classified without changing `cost_at_sale`. Operator review and any future recompute decision remain separate actions.

## Audit, recovery, and production-write rules

### BR-DATA-001 — No silent production writes

**Status:** `APPROVED`

Inspection and audit are read-only by default. Any tool capable of writing must require an explicit apply mode and print the exact target/count/payload before execution.

### BR-DATA-002 — Historical recovery requires immutable inputs

**Status:** `APPROVED`

A historical recovery requires owner approval, frozen source/payload hash, dry-run output, atomic apply, post-apply cohort checks, and rollback-ready evidence.

### BR-DATA-003 — Audit locks protect reviewed history

**Status:** `APPROVED`

Rows protected by `audit_baseline_locks` reject ordinary mutation. Any escape path must be narrow, transaction-local, reviewed, and recorded.

### BR-DATA-004 — Failure means stop and assess

**Status:** `APPROVED`

If a post-apply invariant fails, stop further writes and compare against the approved cohort before deciding whether rollback is necessary. A broad live audit that changes population is not by itself proof that the approved cohort failed.

### BR-DATA-005 — Compute exactly, round only on screen, store inputs rather than results

**Status:** `APPROVED` — owner decision 2026-09-11. Withdraws the directional display rounding of 2026-07-30 (cost rounded up, stock rounded down, "never flatter the business"). **Implemented 2026-09-11 for display and depreciation** (`lib/reports/display-rounding.ts`, `lib/assets/asset-depreciation.ts`). The items under "Where the code does not follow this yet" below are still open.

*"Tất cả mọi thứ đều phải được tính chính xác. Đối với hiển thị trên hệ thống thì làm tròn đến chữ số hàng đơn vị và không có số thập phân. Đối với dữ liệu lưu trữ thì nên lưu số để backend tính toán chứ không nên lưu kết quả."*

- **No calculation rounds an intermediate figure.** 200.000đ depreciated over 6 months is 33.333,33…đ every month, and the six add to 200.000đ — not five months of 33.333đ and a sixth of 33.335đ.
- **Rounding happens only where a number is shown:** to the nearest whole đồng, or whole base unit for a quantity, halves away from zero, no decimals (percentages and larger units: last point).
- **A shown total is the rounded exact total, never a sum of rounded cells.** A row of months can therefore differ from its total by a đồng or two — three months of 100,4đ show 100 each and a total of 301. The screen says so where it happens; no cell is nudged to hide it.
- **Store the numbers a figure comes from, not the figure.** Reports read source rows and recompute on every read.
- **Money that really changed hands stays whole đồng:** an order's total, a discount on a bill, what was paid to a supplier. Those record what happened; nobody pays half a đồng.
- **Percentages and larger-unit quantities keep decimals** (owner decision 2026-09-11, the same day: *"% thì nên hiện 2 số thập phân"*): a percentage shows exactly two decimals ("18,13%"); a quantity shown in a larger unit keeps up to two ("1,5 hộp", "20,62 cây", the 2026-08-30 rule in `lib/stock/issue-slip-onhand-display.ts`). Only money and quantities in the base unit are whole.
- **On a chart, money is shortened** (owner decision 2026-09-12: *"hiển thị có đơn vị là k, triệu thì đơn vị là tr"*): "k" for thousands, "tr" for millions, up to two decimals with a comma ("100k", "100,12k", "100tr", "100,12tr"), no space before the unit. One chart uses one unit for every figure it draws: "tr" when at least half of the months with a non-zero profit are a million or more in size, otherwise "k". The owner typed the decimals with a dot; the app writes a comma, because a dot is its thousands mark. Code: `lib/reports/compact-money.ts`.

**Where the code does not follow this yet** (measured 2026-09-11; the money items each under 1đ per line). These follow the P&L as their own plan, because the first two need a migration on `assets`:
- `lib/costing/purchase-order-cost-allocation.ts` rounds each purchase line's share of shipping and discounts to a whole đồng (`BR-COGS-006`).
- `assets.total_cost` and `assets.unit_cost` (bigint), and `purchase_order_lines.unit_price` (bigint, `round(subtotal ÷ quantity)`), store results. The depreciation band is looked up from the rounded `unit_cost`.
- `lib/sales/order-math.ts` rounds each item's and topping's share of an order discount for the sales report.
- Three percentages show one decimal instead of two: the outlet share in the sales report (`lib/reports/outlet-breakdown-table.ts`), and the change against the previous period on the dashboard (`app/admin/page.tsx`) and the daily report (`app/admin/reports/daily/page.tsx`). The last two also print a dot, not the Vietnamese comma ("12.5%").


### BR-DATA-006 — Dates show as dd/mm/yyyy; date filters pick a day, never a time

**Status:** `APPROVED` — owner decision 2026-09-29, written as a comment on the step 2–3 mockup (`docs/superpowers/specs/2026-09-28-cai-to-he-thong.md`, section 5.14). Not built yet; applied screen by screen in steps 3–7 of that overhaul.

*"Tất cả thời gian chỉ lọc theo ngày mà không cần chính xác giờ giấc. Ngoài ra, định dạng của tất cả ngày giờ đều phải theo dạng dd/mm/yyyy."*

- **Every date on screen is `dd/mm/yyyy`**, with a leading zero: 05/03/2026, never 5/3/2026, never 2026-03-05, never the month first. This includes date pickers, whose look otherwise follows the phone or computer's own language setting.
- **Every date filter chooses whole days.** "Từ 01/09/2026 đến 30/09/2026" covers both days completely, in Saigon time. No filter asks for an hour or minute.
- **A slip list shows and sorts by the date written on the slip** (for a purchase order, its `transaction_date`: completing the slip counts as the goods having come in, owner 2026-09-29; the system never records a separate arrival day), newest first — not the day the slip was typed into the machine (owner 2026-09-29, same mockup). Measured 2026-09-29: 191 of 191 purchase orders carry that date; 164 of them differ from the day they were created.
- **Outside filters, a date shows its time to the second: `dd/mm/yyyy HH:mm:ss`** (owner 2026-09-29: *"Chỉ có bộ lọc thì hiển thị theo ngày, các chỗ khác có thể hiển thị thêm giờ và nên cụ thể đến đơn vị giây"*).
- **Measured 2026-09-29, where no time was ever recorded:**
  - Four fields store a day with no time at all: a brand's start date, an asset's purchase date, an asset's disposal date, and a cash-book entry's date.
  - On purchase orders, 164 of 191 slip dates sit at exactly 00:00:00 Saigon time, because the form asks only for the day.
  - All 74 of 74 issue slips have :00 seconds, because the form asks only to the minute.
  - Sales orders do carry real seconds: 3.010 of 3.079 completed orders have non-zero seconds.
- **Where no time was recorded, the time still shows, as 00:00:00** (owner 2026-09-29, chose this over showing the day alone): "28/09/2026 00:00:00". Every date outside a filter therefore has the same shape. Day-only fields are read as midnight Saigon time; nothing is invented beyond that.
- **Every day and clock time is Saigon time, wherever the code runs** (owner 2026-10-04: *"chắc nên soát toàn diện lỗi này cho toàn hệ thống"*, after the same mistake was found a fourth time). The live server runs on UTC, seven hours behind, and a phone or laptop may be set to any zone. Code that asks the machine for "today", a month, an hour, or a date's text without saying Saigon gets the wrong day between 00:00 and 06:59 Saigon time. Measured 2026-10-04: 668 of 3.183 completed orders were created between 06:00 and 06:59, and 165 of 198 purchase orders are dated before 07:00. Example: the order list filtered to 15/09/2026 must run from 15/09 00:00:00 to 23:59:59 Saigon time, not from 07:00 to 06:59 the next morning. Every such computation goes through `lib/shared/datetime.ts` or `lib/shared/report-time.ts`. The guard test `lib/shared/timezone-guard.test.ts` reads the whole of `app/`, `lib/`, `components/` and `scripts/` and refuses the patterns that caused the four mistakes; the few places that are right on purpose are listed in it, each with its reason.

### BR-DATA-007 — On admin screens, anything with an input or for viewing is its own page; only yes/no and error boxes remain

**Status:** `APPROVED` — owner decision 2026-09-30. **Not built yet**; its own plan, screen group by screen group. Counted 2026-09-30: 91 popup or browser-dialog uses in 38 files under `app/` (POS included in that count).

*"hệ thống sẽ không bao giờ được sử dụng dạng popups. Tất cả đều phải áp dụng cách chuyển trang"*, then on the scope questions: *"1B 2B"*.

- **A box that asks for input becomes a page**, with exceptions the owner will name case by case when they come up (owner 2026-09-30: *"Cái này sẽ có một số ngoại lệ, anh sẽ đề cập vào lúc cần thiết"*); until he names one, none is assumed. Example: "Huỷ phiếu" on an issue slip opens a page with the reason field and "Xác nhận huỷ", and returns to the slip afterwards; it no longer opens a box over the slip.
- **Yes/no confirmations and error messages keep their box** (owner 2026-10-01, replacing answer 1B, on approving the design: *"2 cái này vẫn hiện theo kiểu bật khung nhé"*). Examples: "Xoá nhà cung cấp ABC?", "Xác nhận áp dụng kiểm kê", an error after Lưu. They stay the app's own box (`DeleteConfirmModal`, `confirm()`/`alert()` in `lib/shared/dialog.ts`); no browser dialog (`window.confirm`, `window.alert`) is used (none found 2026-10-01).
- **A box only for viewing becomes a page too**, e.g. a dish's price history.
- **POS is exempt** (answer 2B): choosing size, toppings and payment keep their current boxes, because a page change slows selling at a busy moment.
- **Adding a supplier while entering a purchase order** (owner 2026-10-01, *"B"*): it opens the new-supplier page. The half-entered order is kept on that device and refilled on return, with the new supplier selected (owner: *"chỗ nhà cung cấp sẽ tự chọn nhà cung cấp vừa tạo"*). It replaces any supplier picked before. Design: `docs/superpowers/specs/2026-10-01-bo-popup-design.md` §6.
- **Not popups:** a dropdown list and a date picker's calendar. They open in place and are kept (owner asked on 2026-09-30 for dropdowns to float above tables, not to become pages).

### BR-DATA-008 — Every list sorts by any column; by code by default

**Status:** `APPROVED` — owner decision 2026-10-02, typed on the Tài sản list: *"Tất cả các bạn đều có thể sort tất cả các tiêu đề của từng cột. Ví dụ bảng có 7 cột thì cả 7 cột anh đều có thể bấm vào tên để sort tăng dần hoặc giảm dần. Tuy nhiên đối với tất cả danh sách thì mặc định đều sẽ sort theo mã"*.

- **Every column header is clickable.** First click sorts ascending, the next click descending. An arrow on the header shows the column and direction in use.
- **Default order is the code, descending** (TS-065, TS-064, …: newest first), on every list, until someone clicks a header. Owner 2026-10-03, typed on the Tài sản list: *"Mã hàng sắp xếp mặc định theo chiều giảm dần"*, then chose "A" (every list, not only Tài sản). It replaces the ascending default of 2026-10-02. Clicking the code header then sorts ascending.
- **Sorting covers the whole list, not only the page on screen**, and goes back to page 1. Sort column and direction sit in the page address (`?sort=&dir=`), so returning from a detail page keeps them, like the filter.
- **Text sorts the Vietnamese way, numbers by value, dates by date**; codes compare their number part by value.
- **Phone:** there are no column headers, so the same choices sit in one "Sắp xếp" picker above the cards.
- Applies to every list on the list/detail template (`docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md`); lists not yet moved get it in their wave.
- **Exception: the cash book (Sổ thu chi) opens by date, newest first**, code descending within a day. Owner 2026-10-05: *"Làm theo em khuyến nghị"*, after being told that the day rows for sales and purchases carry no code, and that a row dated back (`CE-033`, `CE-034`, dated 30/04/2026, entered 02/09/2026) would otherwise sit among September's rows. Clicking "Mã" still sorts by code.
## Backup and retention rules

### BR-BACKUP-001 — Scheduled backups are full snapshots

**Status:** `APPROVED`

The Drive backup is a full schema-versioned snapshot of the approved table allowlist, not only the day's new rows.

### BR-BACKUP-002 — Daily and monthly retention are separate

**Status:** `APPROVED`

Keep 180 rolling daily snapshots. Keep one idempotent full snapshot for each month indefinitely. Daily and monthly files live in separate Drive child folders.

### BR-BACKUP-003 — Completeness is validated before retention

**Status:** `APPROVED`

Apps Script validates the response, schema version, and expected table keys before writing/retaining the file. A response file that fails the contract is not a successful backup.

### BR-BACKUP-004 — Storage migration uses capacity/reliability triggers

**Status:** `APPROVED`

Begin migration planning when the serialized bundle reaches the warning threshold in the backup policy (currently 20 MB), and move the production destination by 25 MB or earlier if runtime/reliability limits are reached.

### BR-BACKUP-005 — Restore requires separate approval

**Status:** `APPROVED`

Backup success does not authorize restoration. A restore needs a reviewed mapping, target environment, dry-run/validation, and explicit production approval.

## Migration state is measured on the database, not read from the CLI

`npx supabase migration list` records only migrations applied through the CLI. A migration pasted into the dashboard runs but writes no history row, so the list drifts, and each manual fix widens the gap that made the next fix manual. The 2026-09-02 reset spec recorded three batches as "not run" that had run — the same trap.

**The drift observed 2026-09-07:** the remote column stopped at `0064` while `0065`–`0096` were live — verified by probing `outlets` (exists, 2 rows), `base_ingredients` (gone), `stock_ledger` (gone). `supabase db push` was unusable: it would have replayed 32 migrations including `drop table` statements.

**Repaired the same day.** Each of the 32 was proved before being marked: 25 by a directly observable artifact, 7 inferred because a later proven migration overwrote the function they wrote, 0 unproven. `supabase migration repair --status applied` then wrote the history rows without executing any SQL, and `0097` went out through `supabase db push` as one migration. As of 2026-09-07 the list is trustworthy: 96 applied, `0097` applied, nothing pending.

**The rule survives the repair, because the drift can recur.** Any migration applied by hand from here starts the gap again. To know whether a migration has run, query the table, column or function it creates or drops; do not read the CLI list or a document, this one included. Two traps met while proving the 32, both worth knowing before trusting a probe: `information_schema` is privilege-filtered, so a role without `SELECT` on a table sees zero columns and "no permission" looks exactly like "never ran" — read `pg_catalog` instead; and an absence marker ("the new body no longer mentions X") false-fails when the new body carries a *comment* explaining why X was removed, so prefer a positive marker unique to the version you are testing for.

