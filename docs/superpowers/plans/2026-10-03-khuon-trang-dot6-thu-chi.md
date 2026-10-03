# Khuôn danh sách và chi tiết, đợt 6: Sổ thu chi, Nhóm thu chi, Tài khoản ngân hàng

> **For agentic workers:** UI only, to Gemini via `agy` (newest generation at the highest level, checked with `agy models` at hand-off). No server change: every action the three screens need exists and is guarded. Opus proves tests red on the old code, removes files with `git rm`, runs the gates, commits.

**Goal:** the three Thu chi screens on the template of waves 1–5. Clicking a row opens a detail page; editing and the rarely used actions live there. Owner asked to keep going through the waves on 2026-10-03 (*"Em cứ cho làm tiếp rồi cho anh danh sách cần kiểm tra là được."*).

**Spec:** `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md` §4 row 6 ("Thông tin", "Theo trang"), §0 ("chỗ nút xoá là nút Ngừng dùng, hoặc chữ đang dùng của trang đó"; rare actions only on the detail page), §8 (sort). Examples to copy: `app/admin/products/**` (status filter, bin only under one status, rare actions on detail), `app/admin/outlets/**` (wave 5).

## Hiện trạng

1. **Trạng thái.**
   - **Sổ thu chi:** one date-range filter (`preset`, `start`, `end` in the URL; default "Tháng này"; applied on change, `FinanceFilterBar`). Rows `ACTIVE` or `CANCELLED`; a cancelled row shows dimmed among the others and is left out of the totals. New: filter "Trạng thái" — Đang dùng (default) / Đã huỷ / Tất cả — because the list bin is "Huỷ", which has nothing to do on a cancelled row, and the shared list has no per-row bin (same pattern as Món, Điểm bán). Measured 2026-10-03: 0 of 40 rows cancelled, so the default view shows the same rows as today.
   - **Nhóm thu chi, Tài khoản ngân hàng:** rows `ACTIVE` / `INACTIVE`, all shown together today. New: filter "Trạng thái" — Đang dùng (default) / Ngừng dùng / Tất cả. Measured: 0 of 6 groups, 0 of 1 account inactive.
   - **New detail pages:** `/admin/finance/[id]`, `/admin/finance/categories/[id]`, `/admin/finance/bank-accounts/[id]`. Unknown id gives 404.
2. **Nút.** "Theo trang": wording and rights as today.
   - **Sổ thu chi:** list "+ Ghi khoản mới"; bin "Huỷ" with tick boxes, every role (`cancelCashEntry`, as today), only under "Đang dùng". Detail: "← Sổ thu chi", "Chỉnh sửa" and "Huỷ" while the row is not cancelled (the edit page already 404s a cancelled row), "Xoá hẳn" for ADMIN only (`deleteCashEntry`, `requireOwner`), back to the list after. Removed from the row: "Sửa", "Huỷ", "Xoá hẳn".
   - **Nhóm thu chi / Tài khoản:** list "+ Thêm nhóm" / "+ Thêm tài khoản"; bin "Ngừng dùng" (`setCash…Status` with `INACTIVE`, every role) only under "Đang dùng". Detail: "Chỉnh sửa"; "Ngừng dùng" when active, "Dùng lại" when not (same confirm wording as today; the server re-checks the name clash on "Dùng lại"); "Xoá hẳn" ADMIN only — the server refuses a group or account any row uses, in Vietnamese, as today.
3. **Danh sách.** 20 per page.
   - **Sổ thu chi** (rows of the date range, by status): Mã · Ngày · Nhóm · Bên · Số tiền · Cách trả · Tài khoản · Ghi chú · Người tạo · Trạng thái. Secondary (hidden 768–1279px): Cách trả, Tài khoản, Người tạo. Above the table, unchanged: Tổng chi, Tổng thu (with "thu ngoài lãi lỗ"), Theo nhóm — computed over every row of the date range, whatever the status filter or page.
   - **Default order — owner question open:** `BR-DATA-008` says code, descending. The cash book sorts by entry date today (fix M2: backdated rows). Until the owner answers, the default is **Ngày, newest first, code descending within a day** (today's order); clicking "Mã" sorts by code. Measured 2026-10-03: within each month 0 of 40 rows differ between the two orders; across months 31 of 40 do (`CE-033`, `CE-034` "Doanh thu ghi tay", dated 30/04/2026, recorded 02/09/2026).
   - **Nhóm thu chi:** Mã · Tên · Bên · Tính vào lãi lỗ · Trạng thái. Newest code first.
   - **Tài khoản:** Mã · Tên · Ngân hàng · Số tài khoản · Trạng thái. Newest code first.
   - Search box: none today on any of the three; Nhóm and Tài khoản get "Tìm" (name or code) like every list since wave 1; Sổ thu chi keeps no search (its filter is the date range).
   - Phone: cards.
4. **Ô nhập.** Unknown status falls back to "Đang dùng"; omitted from the URL when it is the default. `page` not an integer ≥ 1 becomes 1, beyond the last page the last page. The date range keeps its own rules (`resolveDateRange`: bad or backwards custom range → Tháng này) and keeps applying on change. Forms unchanged beyond their frame. `components/return-to.ts` (shared by the three) learns each list's own detail path, refusing `new`, the other two lists (`/admin/finance/categories` is not a cash entry `categories`), and anything off-site.
5. **Dữ liệu.** No table, no migration, no server action change. Deliberately not served: P&L, reports (they read the same rows themselves). Dead prop removed: `usedCategoryIds` (passed to `CategoriesList`, never read).

**Real figures (measured 2026-10-03, read-only):** 40 cash rows `CE-001`…`CE-040`, 26/03/2026 → 30/09/2026, 0 cancelled. September 2026: Tổng chi 1.637.000đ, Tổng thu 2.443.400đ. 6 groups `CFC-001`…`CFC-006`, all active; rows per group: Vận hành 18, Điện, nước, gas 12, Marketing 5, Thu khác 0, Vốn góp 3, Doanh thu ghi tay 2. 1 account `BA-001` "ACB - Phin Di" (ACB), active, 1 row.

**Worked examples.**
- `CE-040`: Ngày 30/09/2026 · Nhóm Vốn góp · Bên Thu · Số tiền 2.443.400đ · Cách trả Tiền mặt · Tài khoản — · Ghi chú "Mua nguyên liệu" · Người tạo admin · Đang dùng. Its detail page shows the same fields plus "Ghi sổ lúc".
- `CE-034`: Ngày 30/04/2026, Doanh thu ghi tay, 6.683.290đ, ghi chú "Doanh thu bị mất dữ liệu", ghi sổ 02/09/2026.
- "Xoá hẳn" on Thu khác (`CFC-004`, 0 rows): deleted. On Vận hành (`CFC-001`): refused, *"Nhóm "Vận hành" đã có dòng sổ nên không xoá hẳn được. Bấm "Ngừng dùng" để ẩn nhóm này."* (wording of today's action). Not to be clicked on the real data.

**Menu:** no new entry; three `[id]` routes. **Guard:** remove the three files from PENDING in `app/admin/list-template.test.ts`. **Docs:** `[id]` routes on the flow doc's `routes:` line with a dated "Behaviour change" paragraph.

Đã xem: the three pages and list clients, `FinanceFilterBar`, `resolve-date-range.ts`, `return-to.ts`, the cancel/status/delete actions and their guards, `summariseEntries`, the three `[id]/edit` and `new` pages (all honour `returnTo`), the shared `FilterCard`, `DataList` (`secondary` columns exist). Chưa xem: the three forms beyond their props; the flow doc's exact paragraph.

## Review Focus

1. `/admin/finance/categories` must never be read as the cash entry `categories`: `safeReturnTo` and the `[id]` route.
2. Totals and "Theo nhóm" stay over the whole date range, not the page or the status filter.
3. Bins: "Huỷ" only under Đang dùng; "Ngừng dùng" only under Đang dùng; "Xoá hẳn" only on detail, only ADMIN.
4. Back link from a detail page returns to the same date range, status, page and sort.
5. No server `[id]` page passes a function to a client component.

---

### Task 1 (Gemini): Sổ thu chi — list on the template, `[id]` detail, edit frame, `return-to.ts` (all three lists), tests.
### Task 2 (Gemini): Nhóm thu chi — list with status filter, `[id]` detail, edit frame, tests.
### Task 3 (Gemini): Tài khoản ngân hàng — list with status filter, `[id]` detail, edit frame, tests.
### Task 4 (Opus): guard, docs, five gates, browser check (view only), commit.
