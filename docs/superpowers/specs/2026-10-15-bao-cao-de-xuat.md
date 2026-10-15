# Báo cáo and Tổng quan: area audit and proposal

This page covers master-plan rows 6c, 6d and Kế hoạch A step 6 (`docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md`) for the Báo cáo area: menu group "Báo cáo" (Doanh số, Hàng đã xuất, Lãi lỗ) and the home page Tổng quan with its Cài đặt Tổng quan. It follows the owner's choice "Làm lại từng mảng" (2026-10-15), the same as the Bán hàng, Kho and Thu chi pages:
- keep what is reconciled and recently approved;
- rebuild where the root is wrong;
- the till never stops: these pages only read. `app/pos` and `lib/pos` import nothing from `app/admin/reports` or `lib/dashboard`; the till's checkout imports one helper from `lib/reports/report-v2-allocators.ts` (`app/pos/actions.ts:12`), which this page does not touch.

Two read-only audits ran on 2026-10-15: an Opus subagent read every non-test file under `app/admin/reports`, `lib/reports`, `lib/dashboard`, `app/admin/components/DashboardView.tsx`, `app/admin/dashboard-settings` and the `scripts/verify-*` family; SQL ran against the live server through the management API, and `scripts/verify-revenue.ts` ran once (read-only). Every number below was measured that day. Re-measure before use.

Owner instruction the same day: *"Tạm làm tất cả theo em khuyến nghị, rồi tất cả những gì em đã khuyến nghị thì tổng hợp lại cho anh khi có kết quả cuối."* Every open design choice below takes the recommendation and is marked "chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15". One thing is not covered by that authorisation and is asked (Q1): a fact only his own records hold. Pushes still need his yes each time; this area has no migration and no data write.

## Hiện trạng

1. **States.**
   - Reports store nothing. 0 writes anywhere under `app/admin/reports`, `lib/reports` or `lib/dashboard`; the only table the area writes is `dashboard_settings` (1 row: lâu chưa kiểm kê 30 ngày, phiếu mở dở 2 ngày, ngày nhắc 25, cột đồ ăn Khoai lang + Trứng luộc, both ACTIVE; topping type PT-003; `updated_by` empty, never edited since migration 0109).
   - "An order that counts" is written three times: `app/admin/reports/report-helpers.ts:47` (COMPLETED and not superseded), `lib/reports/profit-and-loss.ts:131` (same), and `app/admin/reports/pnl-actions.ts:108` (same, in a file no page imports). `findCompletedOrders` (`report-helpers.ts:26`) filters COMPLETED on the server only. Measured: 0 of 3,446 completed orders are superseded, so the copies agree on live data today.
   - Live months (completed orders, Saigon day, measured 2026-10-15):

     | Month | Orders | Revenue | Cash | Transfer | Outlets |
     |---|---|---|---|---|---|
     | 2026-04 | 53 | 2.190.000 | 53 | 0 | 1 |
     | 2026-05 | 302 | 7.675.000 | 302 | 0 | 1 |
     | 2026-06 | 793 | 22.157.000 | 574 | 219 | 2 |
     | 2026-07 | 664 | 18.661.000 | 452 | 212 | 2 |
     | 2026-08 | 644 | 17.682.000 | 482 | 162 | 2 |
     | 2026-09 | 624 | 15.442.000 | 465 | 159 | 2 |
     | 2026-10 (to 15) | 366 | 9.173.000 | 242 | 124 | 2 |

   - `scripts/verify-revenue.ts` **fails today**: April to August match its owner-confirmed baselines exactly (5 of 5), September 2026 has closed and carries no baseline, and the script refuses to mint one ("REVENUE VERIFICATION FAILED -- 1 check(s) failed"). Measured for the owner to confirm: September 15.442.000đ, 624 orders; Điểm bán 1: 532 orders, 12.108.000đ, 22 sale days; Điểm bán 2: 92 orders, 3.334.000đ, 18 sale days.
2. **Buttons.**
   - Doanh số: the shared range bar (`BR-UI-007`) applies at once; Thương hiệu, Nhân viên and Nhóm SP wait for "Lọc". A range change pushes whatever is picked in the three boxes even if "Lọc" was never pressed (`SalesFilter.tsx:68-89` builds the URL from component state), so the two paths disagree on when a pick counts.
   - Hàng đã xuất: three tabs (Theo nguyên liệu, Theo lần xuất, Theo tháng), **no date range**; it reads every purchase order, line and issue since opening on each visit (`app/admin/reports/issued/actions.ts:50-52`).
   - Lãi lỗ: the range bar in whole months, opening on Năm nay (`BR-PNL-002`). On a phone the month cards show, the four summary cards and the chart are hidden (`PnlSummary.tsx:32`, `PnlChart.tsx:57`: `hidden md:…`).
   - Tổng quan: "Cần xử lý" links to Đồng bộ máy bán, Nguyên liệu, Kiểm kê, and "Nhập" on each monthly reminder (`BR-CASH-009`); the 7-day table (`BR-SALE-007`). 0 popups.
   - Cài đặt Tổng quan: saved through `requireAdmin()`, which admits ADMIN and MANAGER (`lib/auth/auth.ts:67`).
3. **Lists.**
   - Doanh số shows, top to bottom: three figure boxes (Tổng doanh thu thuần with Trước giảm giá under it, Tổng số đơn, Giá trị trung bình with Khuyến mãi hệ thống under it), each with a compare line against the previous period; Chi tiết giảm giá; Doanh thu theo phương thức thanh toán; Doanh thu theo Điểm bán; Ma trận doanh thu theo giờ; charts by date, by day of week, by hour, and a pie by dish group; Top sale Nước, Top sale Thức ăn, Top topping bán chạy. 529 lines in `page.tsx`, which also does data work: it loads every product and runs `products.find` inside loops (`page.tsx:88, 131, 137`), builds the pie by each dish's **current** group rather than the group on the line's snapshot (`BR-SALE-002`), and carries comments like "But wait, we don't have products list loaded" (`page.tsx:80-83`) and the subtitle "(V2)" (`page.tsx:154`, `loading.tsx:10`). Measured: 0 of 4,784 order lines belong to a dish whose group differs from the snapshot today, so the pie is right today and wrong the day a dish is moved.
   - Doanh thu theo phương thức thanh toán counts an order **once per method it was paid by** (`sales-actions.ts:144-157`). Example 06/10/2026: 38 completed orders (23 Tiền mặt, 15 Chuyển khoản), but the table says Tiền mặt 23 đơn, Chuyển khoản 16 đơn, because order 261006002002 (one Trà sữa truyền thống 18.000đ, paid 9.000đ cash + 9.000đ transfer, `BR-SALE-013`) sits in both rows. 2 such orders ever (the other: 260727002003, 27/07, 72.000đ as 36.000 + 36.000). The cash book's day rows have the same shape: 3,448 sale "orders" on the view against 3,446 completed orders. Revenue is split correctly (462.000 + 467.000 = 929.000đ on 06/10); only the count is off.
   - Hàng đã xuất, Theo nguyên liệu: one "đã xuất" figure per item from **every** issue, stocktake shrinkage included (`lib/reports/issued-value-report.ts:22-23` passes all issues unfiltered), while Lãi lỗ shows Hao hụt on its own line (`BR-COGS-008`). The two pages cannot be tied together by eye.
   - Tổng quan loads whole tables on each open: every hand row of the cash book, every stocktake session, every purchased item, every product (`lib/dashboard/dashboard-data.ts:49-60`), to compute a handful of alerts.
4. **Inputs.**
   - Dates come only through the shared range bar and its `from`/`to` parameters; a bad parameter falls back to the default range. Cài đặt Tổng quan: ngày nhắc 1–28, two day counts, the food dishes as a list of ids in a text column with no key (`supabase/migrations/0109…:98`): a hidden or renamed dish stays in the setting until someone edits it; the server does not check the ids on save.
5. **Data served.**
   - Doanh số and Lãi lỗ: completed, not-superseded orders by Saigon day of `created_at`; Lãi lỗ adds purchase orders, stock issues, hand rows and depreciation per `BR-COGS-007`, `BR-COGS-008`, `BR-CASH-001`, `BR-CASH-003`, computed exactly and rounded on screen (`BR-DATA-005`, `lib/reports/profit-and-loss-table.ts`). `scripts/verify-pnl-monthly.ts` gates it.
   - Legal: at under 1 tỷ a year the shop keeps only the sales book S1a-HKD of Thông tư 152/2025/TT-BTC: three columns, "Ngày tháng", "Diễn giải", "Số tiền", a daily total is acceptable (xcyber.vn/mau-so-s1a-hkd, MISA, Sapo; the annex itself not yet read). Doanh số's by-date figures are that book's content; no screen prints it in that shape.
   - Not served, by design: profit per brand (`BR-PNL-001`), customers, staff tips, tax lines; none exist in the data.

**Clean results:**
- Lãi lỗ: the owner's approved sample of 2026-09-11, rules `BR-PNL-001` to `BR-PNL-004`, exact-then-round, Luỹ kế from the first month viewed, numbered notes, month cards on a phone; `verify-pnl-monthly` reads it against the data.
- Tổng quan: spec confirmed by the owner on 2026-10-14 (`docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md`), `BR-SALE-007` with a 36-cell check script; the owner removed charts and top sellers himself on 2026-09-28. Nothing to reopen one day later.
- `BR-SALE-012` (group filter hides whole-order money) built; `BR-UI-007` range bar on all three reports; every report has a menu entry.
- 0 popups, 0 "N/A", 0 hand-drawn red boxes in the area (`border-red|bg-red|text-red`: 0 hits).

Seen: the agent's report, the SQL results (scratchpad `baocao-1.sql`, `baocao-2.sql`), `verify-revenue` output, the files named above, `docs/03-workflows/reports.md`, the P&L and Tổng quan specs. Not seen: any report page in a browser; `CompareLine` and `percentChange` decimals on screen; the exact S1a-HKD annex text; test bodies.

## Verdict: the root of the area

- **Keep:** Lãi lỗ and Tổng quan as they are (both owner-approved within the last five weeks and gated by scripts); the shared range bar; `report-helpers.selectSalesOrders` as the one definition of a counted order; the three bar charts and the hour matrix on Doanh số (Toast's Sales Summary opens with the same three: by date, by day of week, by time of day).
- **Wrong at the root, so fix before anything else:**
  1. **Doanh số is three reports stapled together with the page doing data work.** It has no frame of its own (`BR-UI-017` is approved and unbuilt: title, one filter bar, headline figures, tables with a total row), counts a two-way order in two rows, groups by today's dish group instead of the sold line's, and reads all products on every open. Rebuild it on the report frame: the same figures, in this order: Doanh thu thuần, Số đơn, Trung bình mỗi đơn (with Trước giảm giá, Tổng giảm giá, Khuyến mãi hệ thống as the small lines), the three charts, then one table each: theo ngày, theo phương thức thanh toán, theo điểm bán, theo giờ, top món (Nước, Thức ăn, Topping). All data work in `sales-actions.ts` in one pass; the page renders. Sources: Toast Sales Summary (Sales Trends, Net Sales Summary, Payments Summary, Sales Category Summary; https://support.toasttab.com/en/article/Sales-Summary-Report), Square's report list (sales summary, payment methods, item/category sales; https://squareup.com/help/us/en/article/5072-summaries-and-reports-from-the-online-dashboard), KiotViet FnB's Báo cáo Bán hàng / Hàng hoá / Kênh bán hàng (https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-bao-cao/).
  2. **Hàng đã xuất cannot be tied to Lãi lỗ.** No date range, every issue since opening on each open, shrinkage folded into usage. Give it the report frame with the range bar in whole months (like Lãi lỗ) and two lines per month, Hàng dùng and Hao hụt, whose sum for a month equals Lãi lỗ's Giá vốn + Hao hụt for that month; `verify-pnl-monthly` already computes both, so the tie can be gated.
  3. **A dead report and a red check.** `getPnLDataV2` (`app/admin/reports/pnl-actions.ts`, 299 lines, plus `actions.test.ts`) has no importer outside its own test; its own test comment says it "has never once" served a page since Plan C. `verify-revenue` has been red since 2026-10-01 for want of the September baseline (Q1).

## Owner decisions

One question, answered the same day. Everything else is taken by recommendation.

| # | Question | Options | Recommendation | Source |
|---|---|---|---|---|
| Q1 | September 2026 closed with 15.442.000đ over 624 orders (Điểm bán 1: 532 orders, 12.108.000đ, 22 days; Điểm bán 2: 92 orders, 3.334.000đ, 18 days). Do these match his own records? `verify-revenue` refuses to add a month's baseline without his confirmation | (a) yes, add them; (b) his sheet says otherwise, he gives the figures; (c) he keeps no separate record for September, take the app's figures | **(a)** if his sheet agrees. Not auto-taken: the script's rule is "have the owner confirm them against his own records" (`scripts/verify-revenue.ts:74-80`), and `BR-SALE-005` is about exactly this kind of figure | the script's own header; August was confirmed the same way on 2026-09-01. **Answer 2026-10-15: (c)** — *"Anh không có sổ riêng tháng 9"*. The app's figures become the baseline, with the script comment saying so: app figures, no outside record, owner told 2026-10-15 |

Taken by recommendation (chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15):

| # | Choice | Taken | Why |
|---|---|---|---|
| R1 | Doanh số layout | Rebuilt on `BR-UI-017` in the order under root 1; the three figure boxes keep their compare lines; the pie by dish group stays but reads the line's snapshot group | Same figures the owner uses today, one frame, no page-side data work |
| R2 | A two-way order in the payment table | The table counts **payments**, column "Lượt thanh toán", and its total row says how many orders those payments belong to; "Tổng số đơn" above stays the order count. Toast's Payments Summary counts per payment type the same way | A count that adds up to the box above it; no order is halved or hidden |
| R3 | Hàng đã xuất | Range bar in whole months, default Năm nay like Lãi lỗ; per month Hàng dùng and Hao hụt apart, plus the item and event tabs filtered to the range; a total row that equals Lãi lỗ's two lines | One figure means one thing on both pages |
| R4 | Sổ doanh thu S1a-HKD | Not now. The by-date table on Doanh số holds the three columns' content; a printable S1a-HKD view is built when the tax office or a bookkeeper asks, after reading the annex of Thông tư 152/2025 | Same stance as Thu chi R3 (no forms until asked) |
| R5 | Cài đặt Tổng quan | ADMIN only (`requireOwner()`); the server checks each chosen dish exists and is ACTIVE; column stays `text[]` | It shapes what the manager is measured on; a config, like Sửa phiếu since 2026-10-14 |
| R6 | Tổng quan "Kết quả hôm nay / so với hôm qua" box (KiotViet's Tổng quan, Toast's home) | Not added. The owner removed charts and top sellers from Tổng quan on 2026-09-28 and confirmed the 7-day table on 2026-10-14 | Do not reopen a one-day-old decision |
| R7 | Lãi lỗ on a phone | The summary figures show stacked above the month cards; the chart stays computer-only (the cards carry its numbers) | `.claude/rules/ui-devices.md`: both layouts use the space; a hidden summary is a missing one |

## Technical work, no owner decision (Opus decides, reports)

| Item | Who | Migration | Till risk |
|---|---|---|---|
| Delete `app/admin/reports/pnl-actions.ts` and `app/admin/reports/actions.test.ts` (0 importers; grep `getPnLDataV2` and `pnl-actions` across `app lib scripts tests`); reword the comment `app/pos/actions.ts:197` that names it; fix `docs/03-workflows/reports.md:114`, which says `verify-pnl-monthly` checks against `getPnLDataV2` (it does not import it; say what it does check against) | Sonnet | no | comment only in `app/pos/actions.ts`; no code line changes there |
| Q1 answered: add September 2026 (15.442.000đ, 624 orders) to `KNOWN_MONTHLY_BASELINES` in `scripts/verify-revenue.ts`, comment "2026-10-15: app figures, the owner keeps no outside record for September"; run it, expect "matches" on 6 of 6 | Sonnet | no | none |
| Root 1 backend: `getSalesDataV2` returns everything the page shows (category totals from the line snapshot's group, payments per R2, best sellers already split Nước / Thức ăn / Topping); the page does no `find` in loops and loads no product list; one order definition through `selectSalesOrders` everywhere (`findCompletedOrders` also drops superseded) | Sonnet | no | none |
| Root 1 frontend: Doanh số on the report frame `BR-UI-017`, both layouts (`.claude/rules/ui-devices.md`); "(V2)" and the stale comments gone; `SalesFilter`: a range change carries only picks already applied (read them from the URL, not component state) | Gemini | no | none |
| Root 2: `getIssuedValueReport(range)`; month figures split by issue kind using the same classification as `lib/costing/issue-costing-inputs.ts:73-81`; page on the report frame; a test that the month total equals `verify-pnl-monthly`'s Giá vốn + Hao hụt for one real month (September 2026) | Sonnet + Gemini | no | `lib/costing/issue-costing-inputs.ts` is shared with the till's costing path: change nothing in it, read it |
| R5: `requireOwner()` on the settings action; dish ids checked | Sonnet | no | none |
| R7: `PnlSummary` on a phone | Gemini | no | none |
| Tổng quan reads: hand rows only from the earliest month that can still remind (monthly item `created_at`), count queries for the alerts; same output, `verify-dashboard-seven-days` still 0 differences on its 36 cells | Sonnet | no | none |
| Duplicates: three month-label formatters (`pnl/page.tsx:20`, `profit-and-loss-table.ts:114`, `issued-value-report.ts:186`) into one in `lib/shared`; the compare-line percent and `formatPercent` share one decimals rule (`PERCENT_DECIMALS`) | Sonnet | no | none |
| `scripts/verify-dashboard-seven-days.ts` stays pinned to 08/10–13/10: it checks the owner's confirmed example, which is dated; say so in its header | Sonnet | no | none |
| Docs: `docs/03-workflows/reports.md` five answers re-read after the rebuild; `BR-SALE-013` gains one line on how reports count a two-way order (R2); `BR-UI-017` status "built" for the three reports; the master plan row 6c/6d for Báo cáo | Opus | no | none |

## Data writes

None. 0 rows change; reports only read. Q1 changes a constant in a script, not data.

## Structure work

None. No column is dead, no migration. `dashboard_settings.food_product_ids` stays `text[]` with a server check (R5) rather than a join table: 2 ids, edited by one person.

## Order of work

1. Dead report out; September baseline in (Q1, answered); `verify-revenue` green. Small, no visible change.
2. Root 1: Doanh số backend then frontend on the report frame (R1, R2). The frame itself (`BR-UI-017`) is fnbapp-f5's; the first page built on it is this one.
3. Root 2: Hàng đã xuất with a range and the two lines (R3), tie test against Lãi lỗ.
4. R5, R7, Tổng quan reads, duplicates.
5. Docs, then the push (approved separately).
