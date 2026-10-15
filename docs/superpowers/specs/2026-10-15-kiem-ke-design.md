# Kiểm kê rebuilt: design

Kho step 6. Rebuilds the stocktake screens around a list of sessions instead of one session (root problem 3 of `docs/superpowers/specs/2026-10-15-kho-de-xuat.md`). Owner decisions it carries: `BR-INV-022` (2026-10-15: group by Phân loại hàng; stocktake rows leave Phiếu xuất), `BR-INV-021` (count when needed), and the standing stocktake rules in `docs/02-rules/business-rules/stocktake.md` (`BR-INV-010`, `-011`, `-012`, `-017`) and `BR-INV-009` (undo). Choices not named there were taken by recommendation under the owner's 2026-10-15 authorisation and are listed in the final report.

The count engine stays: `open_stocktake_session_atomic` (0052), `save_stocktake_line_atomic` (0092), `apply_stocktake_session_atomic` (0115), `cancel_stocktake_session_atomic` (0103), `reverse_stocktake_session_atomic` (0111), `edit_confirmed_stocktake_atomic` (0122). No database change in this step; root problem 2 (a stock check when editing a confirmed count) is its own ticket in the Kho batch.

## Today (measured 2026-10-15)

- One session ever, STK-001, confirmed 09/08/2026 22:02, 50 lines: 49 differ, 1 matches, 0 found. Its 49 shortfall rows are in Phiếu xuất labelled "Kiểm kê".
- Example line SKL-00004, Bột cà phê truyền thống Phin Đậm: book 6.000 g, counted 4.000 g, short 2.000 g; at the cost per gram on 09/08 (148,02đ) that is 296.033đ.
- The landing page shows either the open count or the last confirmed session with its "Hoàn tác" box. No list, no search, no grouping, no money on any line.

## Screens

### 1. `/admin/inventory/stocktake` — list of sessions

- One row per session, newest code first: code, date and time with seconds (confirmed time, or start time while counting), state, who, lines counted out of total, Giá trị lệch.
- States shown: "Đang đếm" (OPEN), "Đã xác nhận" (CONFIRMED), "Đã hoàn tác" (REVERSED). Cancelled sessions do not exist (`BR-INV-010`).
- Giá trị lệch: for a confirmed session, the value the costing engine booked for its rows, the same figure Phiếu xuất shows today: "thiếu 296.033đ" style, shortfall and found shown apart, never netted (`BR-INV-012` third bullet of "How that row behaves"). For an open session, quantity off × the item's cost per unit now, marked "tạm tính". For an undone one, "—".
- Button "Tạo phiên kiểm kê" at the top. While a session is open it is disabled with the reason "Đang có phiên STK-… chưa xác nhận" and a link to it.
- Empty list: "Chưa có phiên kiểm kê nào" and the create button.
- Tap a row → its page.

### 2. `/admin/inventory/stocktake/[id]` — an open session (counting)

Today this route redirects an open session to the landing page. It becomes the counting screen.
- Tabs with counts: Tất cả, Chưa đếm (blank line), Lệch (counted ≠ book), Khớp (counted = book). Default Chưa đếm while any remain, otherwise Tất cả.
- Search box, accent-blind.
- Lines grouped under Phân loại hàng (Nguyên liệu 50, Vật tư tiêu hao 19 on 2026-10-15), each group header with its counted/total.
- Per line: name, book quantity at count, counted box (`inputMode="decimal"`, saved on its own as today, `BR-INV-011`: blank is not counted, 0 is a count), difference in quantity and in đồng.
- Footer: total Giá trị lệch tạm tính; "Xem trước" opens the preview (`BR-INV-017` recomputed lines), whose last step is the inline yes/no "Xác nhận". "Huỷ phiên" (owner and managers, deletes outright, `BR-INV-010`) asks yes/no inline.
- Computer: a table per group. Phone: one card per line, the number box thumb-sized, the footer pinned.

### 3. `/admin/inventory/stocktake/[id]` — a confirmed or undone session

The detail page of `BR-INV-012`, plus the same tabs (without Chưa đếm when every line was counted), grouping and đồng column. Buttons on the newest confirmed session only, owner only: "Sửa số đếm" (`/[id]/edit`, exists) and "Hoàn tác" → `/[id]/cancel`. Older or undone sessions show no buttons and say why.

### 4. `/admin/inventory/stocktake/[id]/cancel` — undo a confirmed session

A page, not a popup (`BR-DATA-007`), a copy of the purchase-order cancel page: what will change (each shortfall returns to stock on today's date, `BR-INV-009`), a required reason, "Hoàn tác" and "Quay lại". `requireOwner()` stays on the server.

## Phiếu xuất after this

The list stops showing stocktake rows and loses its "Kiểm kê" kind filter (`BR-INV-022`). Checked 2026-10-15: the Hàng đã xuất report reads stock issue rows itself, not this list, and Lãi lỗ reads the engine; neither changes. The first bullet of `BR-INV-012`'s "How that row behaves" is superseded and must say so.

## Not done on purpose

- No places in the shop ("Khu vực"): owner Q8.
- No count reminders or schedule: `BR-INV-021`.
- No scanning, no printing a count sheet.
- No change to how a count is applied, valued or undone.

## Sources

- KiotViet FnB kiểm kho: https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-hang-hoa/kiem-kho/ (a list of count sheets, each with its difference; cited by the 2026-10-15 area audit, not re-read for this page).
- Toast xtraCHEF counts: https://support.toasttab.com/en/article/xtraCHEF-Inventory-Counts (counts grouped by storage area, one open count at a time).
