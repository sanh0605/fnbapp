# Khuôn danh sách và chi tiết, đợt 5: Khuyến mãi, Thương hiệu, Điểm bán

> **For agentic workers:** UI to Gemini via `agy --model gemini-3.8-flash-high` (`agy models` checked 2026-10-03: newest generation 3.8, no Pro). The one server change (Task 1) to Sonnet. Gemini cannot run shell commands or delete files; Opus runs tests, proves them red on the old code, removes files with `git rm`, commits.

**Goal:** the three screens on the template of waves 1–4. Clicking a row opens a detail page; editing starts only there. Khuyến mãi and Điểm bán leave cards on desktop for a real table. Owner asked for this wave on 2026-10-03 (*"Nếu đợt 5 không bị ảnh hưởng khi làm song song thì cho làm luôn"*); it touches none of the files of the asset work running beside it.

**Spec:** `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md` §4 row 5 ("Thông tin", "Theo trang"), §8 (newest code first). Examples to copy: `app/admin/products/**` (wave 4), `app/admin/inventory/items/**`.

## Hiện trạng

1. **Trạng thái.**
   - **Khuyến mãi:** filters `status` (Tất cả default / Đang chạy / Tạm ngưng–Hết hạn / Chỉ đã hết hạn) and `type` (Mọi đối tượng / Giảm đơn hàng / Giảm theo món), applied on change. Kept, now applied on "Lọc"/Enter and kept in the URL with `q`, `page`, `sort`, `dir`. "Đã hết hạn" is derived: `end_date` in the past, whatever `status` says.
   - **Thương hiệu:** one state. Add "selecting" for ADMIN.
   - **Điểm bán:** today one state showing every outlet. New: filter "Trạng thái" — Đang hoạt động (default) / Ngừng hoạt động / Tất cả. Reason: the list bin is "Ngừng hoạt động", which has nothing to do on a retired outlet, and the shared list has no per-row bin; the same pattern as Món's "Đang bán". Today both outlets are active, so the default view shows the same rows as now.
   - **New detail pages:** `/admin/promotions/[id]`, `/admin/brands/[id]`, `/admin/outlets/[id]`. Unknown id gives 404. A `DELETED` brand gives 404 (the list hides them today).
2. **Nút.** "Theo trang": each keeps today's wording and rights.
   - **Khuyến mãi:** list "+ Thêm khuyến mãi"; bin "Xoá" with tick boxes only for ADMIN (`canDelete`, `requireOwner` in `deletePromotionAction`, `BR-ACCESS-003`); it deletes for good, as today. Detail: "← Khuyến mãi", "Chỉnh sửa", "Xoá" (ADMIN), back to the list after deleting. Removed from the card: "Sửa", "Xóa".
   - **Thương hiệu:** list "+ Thêm thương hiệu"; bin "Xoá" only for ADMIN (`requireOwner` in `deleteBrand`). Detail: "Chỉnh sửa", "Xoá" (ADMIN). Removed from the row: "Sửa", "Xoá".
   - **Điểm bán:** list "+ Thêm điểm bán"; bin "Ngừng hoạt động" (`retireOutlet`, every role that opens the page, as today) only while the filter is "Đang hoạt động". The server still refuses the last active outlet. Detail: "Chỉnh sửa", "Ngừng hoạt động" when active. There is no "hoạt động lại" today; none is added.
3. **Danh sách.** 20 per page, newest code first (`BR-DATA-008`).
   - **Khuyến mãi** (all rows, filtered): Mã · Tên · Thương hiệu ("Toàn hệ thống" when none) · Mức giảm ("Giảm 10%", "Giảm 10.000đ", "Đồng giá 15.000đ") · Áp dụng ("Toàn đơn" / "N món, M size") · Bắt đầu · Kết thúc · Trạng thái (Đang chạy / Tạm ngưng / Đã hết hạn). Search: name, discount code, or id. Today's card says "(N món)" but counts sizes; the new text counts both.
   - **Thương hiệu** (not `DELETED`): Mã · Tên thương hiệu · Mã đơn hàng · Ngày bắt đầu.
   - **Điểm bán** (by filter): Mã · Tên · Thương hiệu · Mã đơn · Giờ hoạt động · Bắt đầu · Trạng thái.
   - Phone: cards, as every earlier wave.
4. **Ô nhập.** Unknown filter value falls back to its default; `page` not an integer ≥ 1 becomes 1, beyond the last page the last page. Forms (`PromotionForm`, `BrandForm`, `OutletForm`) unchanged beyond their frame. Each folder's `return-to.ts` learns to accept its own detail path (`/admin/promotions/PRM-004?…`), refusing `new`, other lists, off-site.
5. **Dữ liệu.** No table change, no migration. One server change: `deleteBrand` counts what still uses the brand and refuses in Vietnamese naming the counts, instead of the database's raw refusal (CLAUDE.md "Luật dữ liệu": translate the refusal). Dates shown in Asia/Saigon; today's card formats in the browser's own zone. Deliberately not served: POS (reads promotions itself), orders.

**Real figures (measured 2026-10-03, read-only):** 2 brands (Phin Đi `BR-001`, code PHD, from 27/03/2026; Uchako `BR-002`, UCK, from 01/06/2026). 2 outlets, both active (Điểm bán 1 `OUT-001` code 001 → Phin Đi, 2.357 orders; Điểm bán 2 `OUT-002` code 002 → Uchako, 883 orders), no hours set. 2 promotions, both `ACTIVE`, both past their end date. 0 dishes carry a brand.

**Worked examples.**
- `PRM-004` "202607 - GIẢM 10K": Thương hiệu Uchako · Mức giảm "Giảm 10.000đ" (`FLAT_VND` 10000) · Áp dụng the 14 sizes in its list (`VAR-020`…`VAR-035`) · Bắt đầu 01/07/2026 00:00 · Kết thúc 15/07/2026 12:59 (stored `2026-07-15 05:59 UTC`) · Trạng thái "Đã hết hạn". Its detail page lists "Món áp dụng (14)": Món · Size · Giá áp dụng.
- `PRM-003` "KHAI TRƯƠNG ĐỒNG GIÁ": Toàn hệ thống · "Đồng giá 15.000đ" · 01/06/2026 00:00 → 30/06/2026 23:59 · "Đã hết hạn".
- Deleting Phin Đi (ADMIN): refused, *"Không xoá được thương hiệu "Phin Đi": còn 1 điểm bán, 2.357 đơn hàng."* Uchako: *"… còn 1 điểm bán, 1 khuyến mãi, 883 đơn hàng."* Only non-zero counts are named.
- Ngừng hoạt động on Điểm bán 1 while Điểm bán 2 is active: allowed, as today; on the last active one: refused, as today.

**Menu:** no new entry; three `[id]` routes. **Guard:** remove the three files from PENDING in `app/admin/list-template.test.ts`. **Docs:** add the `[id]` routes to the flow docs' `routes:` lines, with a dated "Behaviour change" paragraph.

Đã xem: the three list pages/clients, `deleteBrand`, `deletePromotionAction`, `retireOutlet`, `RetireOutletButton`, `DeleteBrandButton`, promotions `return-to.ts`, the foreign keys onto `brands`/`outlets`, the shared `DataList` (no per-row bin). Chưa xem: the three forms beyond their props; the flow docs' exact paragraphs.

## Review Focus

1. No server `[id]` page passes a function to a client component.
2. Bins: promotions/brands only for ADMIN; outlets only under "Đang hoạt động".
3. Promotion times read in Asia/Saigon (PRM-004 ends 15/07/2026 12:59).
4. Back link from a detail page returns to the same filter, page and sort.

---

### Task 1 (Sonnet): `deleteBrand` refusal in Vietnamese

`app/admin/brands/actions.ts`: before deleting, count outlets, promotions, dishes (`products`) and orders (`orders_v2`) carrying the brand; any non-zero → `fail` with the wording above. Test red first.

### Task 2 (Gemini): Khuyến mãi — list, `[id]` detail, edit frame, `return-to.ts`, tests.
### Task 3 (Gemini): Thương hiệu — list (page becomes a client list), `[id]` detail, edit frame, `return-to.ts`, tests; remove use of `DeleteBrandButton` (Opus deletes it if unused).
### Task 4 (Gemini): Điểm bán — list with status filter, `[id]` detail, edit frame, `return-to.ts`, tests; `RetireOutletButton` stays only if the detail page uses it.
### Task 5 (Opus): guard, docs, five gates, browser check, commit.
