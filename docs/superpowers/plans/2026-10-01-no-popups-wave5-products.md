# Bỏ khung ô nhập — đợt 5: Món — Implementation Plan

> **For agentic workers:** UI work goes to Gemini via `agy` (CLAUDE.md "Ai viết code"). Gemini cannot run shell commands in headless mode; Opus runs tests, proves them red on the old code, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Thêm, sửa món; xem lịch sử giá món; thêm, sửa nhóm món; thêm, sửa tuỳ chọn — mở thành trang riêng. Lưu hoặc Bỏ thì quay về danh sách, bộ lọc giữ nguyên.

**Architecture:** Giống các đợt trước.
- `safeReturnTo(raw, list)` cho vùng Món ở `app/admin/products/components/return-to.ts`, kiểu `ProductsList = "/admin/products" | "/admin/products/categories" | "/admin/products/modifiers"`, cùng luật và bộ test như `app/admin/finance/components/return-to.ts`.
- Phần dựng dữ liệu món trong `app/admin/products/page.tsx` (gom size, lịch sử giá, `neverSold`, `isLinkedTopping`, `hasNoSellableVariant`) chuyển sang `app/admin/products/load-product-rows.ts`, hàm `loadProductRows(): Promise<{ enhancedProducts; activeCategories; canDelete }>`. Trang danh sách, trang sửa, trang lịch sử cùng gọi hàm này, nên ba trang không tính lệch nhau. (Tệp `page.tsx` của Next.js chỉ được xuất một số tên cố định, nên hàm phải nằm tệp riêng.)

**Spec:** `docs/superpowers/specs/2026-10-01-bo-popup-design.md` (đợt 5). Luật: `BR-DATA-007`. Mẫu: `app/admin/finance/`, `app/admin/suppliers/`.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay:
     - `ProductForm` vừa là nút trên dòng (Sửa, Ngừng bán, Bán lại, Xoá vĩnh viễn) vừa là khung form (`ModalPortal`).
     - `HistoryModal` là khung xem lịch sử giá (`ModalPortal`).
     - `ProductCategoryForm` vừa là nút (Sửa, Xóa) vừa là khung (`FormModal`).
     - `ModifierForm` là nút và khung (`FormModal`).
   - Sau đợt này: tách nút khỏi form.
     - `app/admin/products/components/ProductRowActions.tsx`: liên kết Sửa, nút Ngừng bán / Bán lại, nút Xoá vĩnh viễn kèm khung xác nhận. Giữ nguyên cách ẩn hiện hiện nay: Xoá vĩnh viễn chỉ khi `neverSold && canDelete`.
     - `ProductForm` chỉ còn form.
     - `app/admin/products/categories/components/DeleteProductCategoryButton.tsx`: nút Xóa kèm khung xác nhận, tách từ `ProductCategoryForm`.
     - Mã không tồn tại thì `notFound()`.
2. **Nút.**
   - Món: "Thêm Món Mới" sang `/admin/products/new`; "Sửa" sang `/admin/products/[id]/edit`; "Lịch sử" sang `/admin/products/[id]/history`.
   - Nhóm món: "+ Thêm Danh Mục" sang `/admin/products/categories/new`; "Sửa" sang `/admin/products/categories/[id]/edit`.
   - Tuỳ chọn: "Thêm Tùy Chọn" sang `/admin/products/modifiers/new`; "Sửa" sang `/admin/products/modifiers/[id]/edit`.
   - Trên trang form: `BackLink` về `returnTo`, "Bỏ" về `returnTo` (thay nút "Huỷ" và nút X của khung cũ), nút lưu giữ chữ cũ ("Lưu Menu" ở món).
   - Trang lịch sử giá: chỉ `BackLink` "← Món".
   - Giữ nguyên: Ngừng bán / Bán lại một chạm; mọi khung xác nhận xoá; câu hỏi "Tên gần giống một mục đã có"; khung báo lỗi `alert(...)`; `StandaloneToppingSwitch`.
3. **Danh sách.**
   - Món đang giữ ba bộ lọc trong bộ nhớ (`searchQuery`, `categoryId`, `statusFilter` mặc định `ACTIVE`). Chuyển lên địa chỉ `?q=&category=&status=`, chỉ ghi khi khác mặc định, bằng `router.replace(…, { scroll: false })` như `app/admin/suppliers/components/SuppliersClient.tsx`. Trang danh sách đọc `searchParams` làm giá trị đầu. `status` chỉ nhận `ACTIVE`, `INACTIVE`, `DELETED` — các giá trị bộ lọc trạng thái đang có trong `ProductsClient`; khác thì coi là `ACTIVE`.
   - Nhóm món, tuỳ chọn: ô tìm `search` trong bộ nhớ chuyển lên địa chỉ `?q=` cùng cách.
   - Nội dung danh sách không đổi, kể cả dòng gợi ý "món này đang ở trạng thái khác" khi tìm không ra.
4. **Ô nhập.** Giữ nguyên mọi ô và luật. Giá size của món gắn với tuỳ chọn đang dùng vẫn chỉ đọc (`isLinkedTopping`, `BR-CATALOG-003`). Món mới mặc định một size "Mặc định" giá 0. `returnTo` chỉ nhận đúng địa chỉ danh sách của màn đó, kèm hoặc không kèm `?…`.
5. **Dữ liệu.** Không đổi server action, không đổi bảng.
   - Trang sửa món và trang lịch sử: `loadProductRows()` rồi `find` theo `id`. Trang thêm món: `loadProductRows()` lấy `activeCategories`.
   - Trang sửa nhóm món: `getCategoriesWithCounts()` rồi `find`.
   - Trang sửa tuỳ chọn: `getModifiersData()` rồi `find`; `productStatus` lấy từ `findAll("Products")` theo `product_id`, đúng cách `ModifiersClient` đang tính `productStatusById`.

Thêm:
- **Lịch sử giá trên điện thoại và máy tính:** dòng thời gian hiện tại đã co theo màn (`md:` hai bên, điện thoại một bên). Chuyển nguyên phần thân sang `app/admin/products/[id]/history/components/PriceHistoryView.tsx`, không đổi cách hiện.
- **Menu:** `/admin/products/new`, `/admin/products/categories/new`, `/admin/products/modifiers/new` thêm vào `app/admin/nav-allowlist.ts`.
- **Tài liệu:** `docs/03-workflows/product-catalog.md` dòng `routes:` thêm bảy địa chỉ mới.
- **Lệch nhỏ đang có, sửa luôn vì cùng chỗ:** trên điện thoại, nút Sửa tuỳ chọn không truyền `productStatus` (máy tính có truyền). Trang sửa mới tự tính nên hai thiết bị như nhau.

Đã xem: `products/page.tsx`, `ProductsClient.tsx` (bộ lọc, chỗ gọi), `components/ProductForm.tsx`, `components/HistoryModal.tsx`, `categories/page.tsx`, `CategoriesClient.tsx` (đầu), `ProductCategoryForm.tsx`, `modifiers/page.tsx`, `ModifiersClient.tsx` (chỗ gọi), `ModifierForm.tsx` (đầu).

Chưa xem: `ProductForm.test.tsx`, `page.test.ts`, `ToppingsManager.tsx`, `StandaloneToppingSwitch.tsx`, `DeleteModifierButton` trong `ModifiersClient.tsx`.

## Global Constraints

- Chữ hiển thị tiếng Việt, code và chú thích tiếng Anh.
- Máy tính và điện thoại đều dùng được; điện thoại vùng bấm 44px, không bảng ngang.
- Khung hỏi có/không và khung báo lỗi giữ nguyên (`BR-DATA-007`, 2026-10-01).
- Giữ mọi khẳng định của test cũ (gồm `page.test.ts`); chỉ bỏ bước bấm nút mở khung.

## Review Focus

1. Lọc "Ngừng bán" + nhóm "Cà phê", Sửa một món, Lưu: quay về vẫn "Ngừng bán" + "Cà phê".
2. Sửa món là topping đang gắn tuỳ chọn: ô giá chỉ đọc, có câu "Giá này đặt ở màn hình Topping & Tuỳ chọn."
3. Món đã bán: không có nút Xoá vĩnh viễn; món chưa bán, người không phải ADMIN: cũng không có.
4. Lịch sử giá của món chưa đổi giá lần nào: "Chưa có lịch sử thay đổi nào."
5. Lưu món trùng tên gần giống: khung hỏi "Món khác / Tôi gõ nhầm" vẫn hiện; chọn "Tôi gõ nhầm" thì ở lại trang.

---

### Task 1: `safeReturnTo` cho Món

- [ ] `app/admin/products/components/return-to.ts` + test, như mục Architecture.

### Task 2: Tách dữ liệu món

- [ ] Tạo `app/admin/products/load-product-rows.ts` chứa nguyên phần tính của `page.tsx` hiện nay (cùng `findAll`, cùng `resolveActor`). `page.tsx` gọi nó. `page.test.ts` phải xanh không đổi khẳng định nào; nếu nó mock theo tên tệp thì sửa chỗ mock, ghi lý do trong chú thích.

### Task 3: Món, nút trên dòng, lịch sử giá

**Files:** `components/ProductForm.tsx`, `ProductForm.test.tsx`, tạo `components/ProductRowActions.tsx` (+ test), `ProductsClient.tsx`, `page.tsx`, tạo `new/page.tsx`, `[id]/edit/page.tsx`, `[id]/history/page.tsx`, `[id]/history/components/PriceHistoryView.tsx` (+ test). `HistoryModal.tsx` hết người dùng: không tự xoá, báo lại cuối việc.

- [ ] Test form (đỏ trên bản cũ): render `<ProductForm categories={…} returnTo="/admin/products?status=INACTIVE" />` thấy ngay ô "Tên món *"; "Bỏ" thì `push("/admin/products?status=INACTIVE")`. Sửa test cũ: bỏ bước bấm mở khung.
- [ ] Test `ProductRowActions` (đỏ, thiếu module): món `neverSold` + `canDelete` có "Xoá vĩnh viễn"; `neverSold: false` thì không; "Sửa" là liên kết `/admin/products/<id>/edit?returnTo=…`.
- [ ] Test `PriceHistoryView` (đỏ, thiếu module): rỗng thì "Chưa có lịch sử thay đổi nào."; có dòng thì hiện giá và nhãn "Đang áp dụng" cho dòng hiện tại.
- [ ] Test danh sách: `initialFilters={{ q: "", category: "", status: "INACTIVE" }}` thì bộ lọc trạng thái hiện "Ngừng bán" ngay.

### Task 4: Nhóm món

**Files:** `categories/components/ProductCategoryForm.tsx`, tạo `DeleteProductCategoryButton.tsx`, `CategoriesClient.tsx`, `categories/page.tsx`, tạo `categories/new/page.tsx`, `categories/[id]/edit/page.tsx`, tests.

- [ ] Test (đỏ): form render thấy ngay ô tên nhóm; "Bỏ" về `returnTo`. Danh sách: nút Sửa là liên kết, nút Xóa vẫn mở khung xác nhận.

### Task 5: Tuỳ chọn

**Files:** `modifiers/components/ModifierForm.tsx`, `ModifiersClient.tsx`, `modifiers/page.tsx`, tạo `modifiers/new/page.tsx`, `modifiers/[id]/edit/page.tsx`, tests.

- [ ] Test (đỏ): form render thấy ngay ô tên tuỳ chọn; nhóm mặc định "Thêm Topping"; "Bỏ" về `returnTo`.

### Task 6: Menu, tài liệu

- [ ] Như mục Thêm. Opus: chứng minh đỏ, chạy đủ năm lệnh, commit.
