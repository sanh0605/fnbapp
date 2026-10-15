# Tồn kho page: design

New screen (Kho step 5). Owner decisions: `BR-INV-019` (2026-10-15, Q1 "Số lượng + tiền + ngày kiểm", Q2 "Tự tính đủ dùng X ngày"), `BR-INV-021` (count when needed, no schedule). Area audit: `docs/superpowers/specs/2026-10-15-kho-de-xuat.md`. Every choice below not named there was taken by recommendation under the owner's 2026-10-15 authorisation and is listed in the final report.

## What the shop gets

One page, first entry of the Kho menu group (the 2026-09-28 menu decision, `docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md`). It answers "what do I have, what is it worth, what runs out first, and how old is that figure".

Measured 2026-10-15 afternoon (re-measure before use):
- 69 tracked items (Nguyên liệu 50, Vật tư tiêu hao 19); Dụng cụ items are on Tài sản, not here.
- Total value 18.013.339đ (the morning audit read 18.118.999đ; slips entered since).
- The replay's closing quantity equals `computeOnHandByPurchasedItem()` on 69 of 69 items.

| Item | On hand | Value | Used, last 30 days | Đủ dùng | Last count |
|---|---|---|---|---|---|
| Sữa chua không đường Vinamilk | 1.100 g | 74.414đ | 5.600 g | khoảng 5 ngày | 09/08/2026 |
| Bột cà phê truyền thống Phin Đậm | 2.500 g | 368.340đ | 7.500 g | khoảng 10 ngày | 09/08/2026 |
| Trứng gà | 236 trái | 590.018đ | 484 trái | khoảng 14 ngày | 09/08/2026 |
| Ly Uchako - 700ml | 1.650 cái | 2.053.982đ | 150 cái | khoảng 330 ngày | Chưa kiểm lần nào |

## Rules of the page

1. **Rows.** Items not in an EQUIPMENT category and not "Không theo dõi tồn". Zero stock stays listed (it reads "Hết"). A stopped item shows only while its stock is not zero, tagged "Ngừng dùng". Semi-products never (`BR-INV-006`).
2. **Quantity** in the item's base unit, from the same purchased-minus-issued figure every stock writer uses. Negative stock (0 items today) shows in red and gets no "đủ dùng".
3. **Value** = the costing engine's closing value for the item (`computeIssueCosting`, landed cost per `BR-COGS-006`). The total at the top is the sum of the unrounded values, rounded once (`BR-DATA` rounding rule in `data-integrity.md`).
4. **Đủ dùng khoảng X ngày** = on hand ÷ (quantity issued by staff over the last 30 days) × 30, rounded down. Only `MANUAL` rows count, reversals included (a cancelled slip nets out); stocktake rows do not, since a count difference is not use. No use in 30 days → "—". Zero stock → "Hết". Rounded down, because a warning that comes a day early is cheaper than one a day late.
5. **Last count** = the latest confirmed, not undone, stocktake that gave the item a number (`BR-INV-011`: a blank line is not a count). None → "Chưa kiểm lần nào".
6. **Order**: "Hết" first (about 14 items on 2026-10-15), then fewest days, then "—" and negative-stock items, ties by name. One search box (`BR-UI-016`, accent-blind like the till). No other filters: the owner declined "chưa kiểm bao giờ" and "lâu chưa xuất" (Q1).
7. **Caption** under the total: "Theo sổ: đã nhập trừ đã xuất. Mỗi món đúng tới ngày kiểm gần nhất của nó."
8. Tapping a row opens the item (`/admin/inventory/items/[id]`).
9. **Who sees it:** the same roles as Hàng hoá. Read-only page: nothing is written, no button changes data.

## Not stored, recalculated

Nothing is saved. The page reads purchases, issues and counts every time, so editing a purchase order or cancelling a slip changes the figures at once. Changing an item's category moves it in or out of the page at once (today's category, not the one at purchase time). That matches a "now" page; it is different from Giá vốn's root problem 1 in the area audit, which concerns past months.

## Layouts

- **Computer:** a table with the six columns above, total and caption in a header band, sticky column titles.
- **Phone:** one card per item: name and the "đủ dùng" badge on the first line, quantity and value on the second, last count small underneath. Total pinned at the top.

## Sources

- KiotViet "Giá trị kho" and "Dự kiến hết hàng" (`docs/superpowers/specs/2026-10-15-kho-de-xuat.md` Q1, Q2).
- MarketMan inventory value; Toast and Square par levels (the per-item minimum the owner declined).

## Not done on purpose

- No per-item minimum stock to type (owner 2026-09-28 and Q2).
- No stock at a past date; the page is "now".
- No new table or migration.
