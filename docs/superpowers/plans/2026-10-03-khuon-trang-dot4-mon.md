# Khuôn danh sách và chi tiết, đợt 4: Món, Nhóm món, Topping & tuỳ chọn

> **For agentic workers:** UI only, so it all goes to Gemini via `agy --model gemini-3.8-flash-high` (`agy models` checked 2026-10-03: newest generation is 3.8, it has no Pro). There is no backend task: every page reads through functions that already exist. Gemini cannot run shell commands or delete files, so Opus runs the tests, proves them red on the old code, removes files with `git rm`, and commits.

**Goal:** Bring the three Món screens onto the template of waves 1–3. Clicking a row opens a detail page. The dish detail page holds its sizes and its price history. "Bán lại" and "Xoá vĩnh viễn" sit only on the detail page.

**Spec:** `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md`, section 4, wave 4 row; section 8 (sorting, newest code first since 2026-10-03). Examples to copy: `app/admin/inventory/items/**` (list, detail, edit), `app/admin/inventory/categories/**`.

## Hiện trạng

1. **Trạng thái.**
   - **Món:** status filter `ACTIVE` (default) / `INACTIVE` / `DELETED`, set by `?status=`. Kept. Add `?page=`, `?sort=`, `?dir=`. The filter now applies on "Lọc" (and Enter), as on the other moved lists; today it applies on every keystroke.
   - **Dish detail** is a new state, `/admin/products/[id]`. Unknown id gives 404. A `DELETED` dish still opens (today the "Đã xóa" filter shows it and its edit page opens).
   - **Nhóm món, Topping & tuỳ chọn:** one state, "viewing". Add "selecting" (tick boxes). New detail pages: `/admin/products/categories/[id]` and `/admin/products/modifiers/[id]`. Unknown or `DELETED` id gives 404 (neither list shows deleted rows today).
2. **Nút.**
   - **Món, list:**
     - "+ Thêm món" at top right.
     - Bin "Ngừng bán" (`pauseProduct`), plus tick boxes and the multi-select bar. Both appear only while the filter is "Đang bán": a paused or deleted dish has nothing to pause.
     - Removed from the row: "Sửa", "Lịch sử", "Bán lại", "Xoá vĩnh viễn".
     - Rights unchanged: `pauseProduct` already takes ADMIN or MANAGER (`requireAdmin`).
   - **Món, detail:**
     - "← Món" goes back to `returnTo`.
     - "Chỉnh sửa" opens `/edit?returnTo=<detail>`.
     - "Ngừng bán" shows when `ACTIVE`; "Bán lại" when not `ACTIVE`. Same rule as `ProductRowActions` today.
     - "Xoá vĩnh viễn" shows only when the dish was never sold **and** the viewer is ADMIN (`BR-ACCESS-003`, `requireOwner` in `eraseProduct`). It asks yes/no; after erasing it goes back to the list.
   - **Món, edit:** same frame as the detail page. Saving returns to the detail page.
   - **Nhóm món, list:** "+ Thêm nhóm", bin "Xoá" (`deleteCategory`), tick boxes, multi-select bar. Shown to everyone who can open the page, as today. Removed from the row: "Sửa", "Xóa" text button.
   - **Nhóm món, detail:** "← Nhóm món", "Chỉnh sửa", "Xoá".
   - **Topping & tuỳ chọn, list:** "+ Thêm tuỳ chọn", bin "Xoá" (`deleteModifierAction`), tick boxes, multi-select bar. Removed from the row: "Sửa", the delete button, and the "Bán độc lập" switch.
     - The switch creates a dish, so it moves to the detail page. The list shows "Có" or "Không" in its place.
   - **Topping & tuỳ chọn, detail:** "← Topping & tuỳ chọn", "Chỉnh sửa", "Xoá". The `StandaloneToppingSwitch` is unchanged, including its yes/no.
3. **Danh sách.** Same rows as today, 20 per page, default order newest code first (`BR-DATA-008`).
   - **Món:** every dish matching the filter, including `DELETED` ones when "Đã xóa" is picked. The search box matches the name, and now also the code. The empty state that says another status has a match is kept.
     - Desktop columns: Mã · Ảnh (secondary) · Tên · Nhóm · Size & giá ("360ml 20.000 · 500ml 23.000"; sorts by the lowest price) · Trạng thái. A dish with no size on sale keeps its red "Không có size nào đang bán" badge.
     - Phone card: name, group, status badge, sizes and prices.
   - **Nhóm món:** groups not `DELETED`. Columns: Mã · Tên nhóm · Số món. The list sorts by code; the old "STT" column goes.
   - **Topping & tuỳ chọn:** options not `DELETED`. Columns: Mã · Nhóm · Tên tuỳ chọn · Giá thêm · Bán độc lập (Có/Không).
4. **Ô nhập.**
   - An unknown `status` falls back to "Đang bán", as today. `page` that is not an integer ≥ 1 becomes 1; beyond the last page it becomes the last page.
   - Form fields keep today's rules (`ProductForm`, `ProductCategoryForm`, `ModifierForm` are not touched beyond their frame).
   - `returnTo`: `app/admin/products/components/return-to.ts` learns to accept a detail path (`/admin/products/PROD-005?…`, `/admin/products/categories/CAT-001?…`), copying `app/admin/inventory/components/return-to.ts`. It must still refuse `new`, other lists, and anything off-site.
5. **Dữ liệu.**
   - No table change, no migration, no new server action. Multi-delete calls the existing one-row actions in turn (spec section 5).
   - Pages read through `loadProductRows()`, `getCategoriesWithCounts()`, `getModifiersData()` and `findAll("Products")`, exactly as today's pages do.
   - Deliberately not served: recipes (they have their own screen), POS.

Thêm, riêng cho việc này:

- **Lịch sử giá chuyển vào trang chi tiết, và sửa một lỗi hiển thị.**
  - Today `/admin/products/[id]/history` draws one timeline across all sizes. "Đến" and "Đang áp dụng" are worked out across sizes, and no row says which size it is. For a dish with 3 sizes changed at the same moment, only one size reads "Đang áp dụng".
  - The detail page shows a plain table instead, newest first: Ngày áp dụng · Size · Giá cũ · Giá mới · Lý do. Each row is shown exactly as recorded; nothing is computed across rows. The current price of each size sits in the "Size & giá" table above it.
  - `/admin/products/[id]/history` becomes a redirect to the detail page, keeping `returnTo`. `PriceHistoryView.tsx` is removed.
  - `buildPriceHistoryTimeline` then had only its own test as a caller, and the orphan-modules doc gate refuses such a module, so it was removed with its test (2026-10-03). Git keeps it.
- **Real figures (measured 2026-10-03, read-only):**
  - 48 dishes: 45 `ACTIVE`, 0 `INACTIVE`, 3 `DELETED`. "Đang bán" has 3 pages (20, 20, 5).
  - 7 groups, 6 not `DELETED`. 9 options, 8 not `DELETED`. 55 price-history rows.
- **Worked example: Matcha latte, PROD-005.**
  - Group "Giải trí", already sold (so no "Xoá vĩnh viễn"). 3 sizes, all on sale: 360ml 20.000đ, 500ml 23.000đ, 700ml 27.000đ.
  - Price history: 3 rows dated 28/06/2026 23:27, one per size, "Giá cũ" —, "Giá mới" 0đ.
  - These rows are existing data, not something this wave creates. 37 of the 55 history rows are like this: all dated 28/06/2026, new price 0đ, across 28 dishes. The new table shows them as recorded; how to show or clean them is the owner's call, asked separately.
  - Detail page, top to bottom: header "Matcha latte", PROD-005, buttons "Chỉnh sửa", "Ngừng bán". "Xoá vĩnh viễn" only if never sold and ADMIN. Field block: Mã, Tên, Nhóm "Giải trí", Trạng thái "Đang bán", Đã bán "Đã có đơn" (the other value is "Chưa bán lần nào"). Then "Size & giá (3)", then "Lịch sử giá (3)".
- **A topping linked to a dish** (`isLinkedTopping`): its price is set on Topping & tuỳ chọn (`BR-CATALOG-003`). The dish detail says so under "Size & giá" and links to that option's detail page.
- **Menu:** no new entry. The three detail pages are `[id]` routes.
- **Docs:** add the three `[id]` routes to the `routes:` line of `docs/03-workflows/product-catalog.md`. The `/history` route stays, now as a redirect. Add a dated "Behaviour change" paragraph.
- **Guard:** remove the three products files from PENDING in `app/admin/list-template.test.ts`.
- **Dead code seen, not touched:** `app/admin/products/components/ToppingsManager.tsx` is imported nowhere.

Đã xem:
- The three list pages and clients, `ProductRowActions`, `load-product-rows.ts`, and the three `actions.ts`.
- The edit and history pages, `PriceHistoryView`, and the timeline helper behind it.
- `return-to.ts` (products and inventory), and how POS reads groups.
- The real figures above.

Chưa xem:
- The pages in the browser (after the merge).
- `ProductCategoryForm` and `ModifierForm` beyond their props.

## Review Focus

1. A server `[id]` page must not pass functions to a client component (the wave 1 bug).
2. Ngừng bán from the list: the dish leaves the "Đang bán" view. Bán lại from the detail page: the badge changes and it returns to "Đang bán".
3. Xoá vĩnh viễn: hidden for MANAGER and for a dish already sold. After erasing, it goes back to the list without a 404.
4. Old links: `/admin/products/PROD-005/history?returnTo=…` lands on the detail page.
5. From a detail page, the back link returns to the same filter, page and sort.

---

### Task 1 (Gemini): Món

- Modify: `app/admin/products/page.tsx`, `ProductsClient.tsx` (+test), `components/return-to.ts` (+test).
- Create: `[id]/page.tsx` (+test), `[id]/components/ProductDetailView.tsx` (+test).
- Modify: `[id]/edit/page.tsx` (frame only), `[id]/history/page.tsx` (redirect).
- Remove (Opus, `git rm`): `components/ProductRowActions.tsx` + test, `[id]/history/components/PriceHistoryView.tsx`.

### Task 2 (Gemini): Nhóm món

- Modify: `categories/page.tsx`, `categories/components/CategoriesClient.tsx` (+test), `categories/[id]/edit/page.tsx` (frame).
- Create: `categories/[id]/page.tsx` (+test), `categories/[id]/components/ProductCategoryDetailView.tsx` (+test).
- Remove (Opus): `categories/components/DeleteProductCategoryButton.tsx`.

### Task 3 (Gemini): Topping & tuỳ chọn

- Modify: `modifiers/page.tsx`, `modifiers/components/ModifiersClient.tsx` (+test), `modifiers/[id]/edit/page.tsx` (frame).
- Create: `modifiers/[id]/page.tsx` (+test), `modifiers/[id]/components/ModifierDetailView.tsx` (+test).

### Task 4 (Opus): guard, docs, five gates, browser check at 1568, 1024 and 390px, commit
