# Bỏ khung ô nhập — đợt 6: Khuyến mãi, thương hiệu, điểm bán, nhân sự — Implementation Plan

> **For agentic workers:** UI work goes to Gemini via `agy` (CLAUDE.md "Ai viết code"). Gemini cannot run shell commands in headless mode; Opus runs tests, proves them red on the old code, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Thêm, sửa khuyến mãi, thương hiệu, điểm bán; thêm nhân sự — mở thành trang riêng. Lưu hoặc Bỏ thì quay về danh sách, bộ lọc giữ nguyên. (Sửa nhân sự đã là trang riêng từ trước: `/admin/users/edit/[id]`.)

**Architecture:** Giống các đợt trước. Bốn màn ở bốn vùng khác nhau nên mỗi vùng một `return-to.ts` riêng, cùng luật và bộ test như `app/admin/suppliers/components/return-to.ts` (một danh sách mỗi vùng): `app/admin/promotions/components/return-to.ts` (`/admin/promotions`), `app/admin/brands/components/return-to.ts` (`/admin/brands`), `app/admin/outlets/components/return-to.ts` (`/admin/outlets`), `app/admin/users/components/return-to.ts` (`/admin/users`).

**Spec:** `docs/superpowers/specs/2026-10-01-bo-popup-design.md` (đợt 6). Luật: `BR-DATA-007`. Mẫu: `app/admin/suppliers/`, `app/admin/finance/`.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay:
     - `PromotionForm` dùng `ModalPortal`, do `PromotionsClient` mở bằng `isFormOpen` + `editingPromo`, nhận `onClose`, `onSuccess`.
     - `BrandForm`, `OutletForm`, `UserForm` dùng `FormModal`, giữ `isOpen`.
   - Sau đợt này: không còn `isOpen`, `isFormOpen`, `editingPromo`, `onClose`, `onSuccess`. Form nhận `returnTo`. Mã không tồn tại thì `notFound()`.
2. **Nút.**
   - Khuyến mãi: nút tạo sang `/admin/promotions/new`; "Sửa" sang `/admin/promotions/[id]/edit`.
   - Thương hiệu: "+ Thêm Thương Hiệu" sang `/admin/brands/new`; "Sửa" sang `/admin/brands/[id]/edit`.
   - Điểm bán: "+ Thêm Điểm Bán" sang `/admin/outlets/new`; "Sửa" sang `/admin/outlets/[id]/edit`.
   - Nhân sự: "+ Thêm Nhân Sự" sang `/admin/users/new`. "Sửa" (đã là liên kết) thêm `?returnTo=`; trang sửa nhân sự đọc `returnTo` cho `BackLink` và cho `EditUserForm` (hiện đang cứng `router.push("/admin/users")`).
   - Trên trang form: `BackLink` về `returnTo`, "Bỏ" về `returnTo` (thay "Huỷ"/"Huy" và nút X), nút lưu giữ chữ cũ.
   - Giữ nguyên: `DeleteBrandButton`, `RetireOutletButton` ("Ngừng hoạt động"), `DeleteUserButton`, nút xoá khuyến mãi, cùng khung xác nhận của chúng; khung báo lỗi.
3. **Danh sách.**
   - Khuyến mãi đã giữ bộ lọc trên địa chỉ (`useFilterForm`). `returnTo` là địa chỉ hiện tại (`usePathname()` + `useSearchParams()`).
   - Nhân sự giữ ô tìm `search` và `roleFilter` (mặc định `ALL`) trong bộ nhớ: chuyển lên địa chỉ `?q=&role=`, chỉ ghi khi khác mặc định, như `app/admin/suppliers/components/SuppliersClient.tsx`. `role` chỉ nhận các giá trị đang có trong ô chọn vai của `UsersClient`; khác thì `ALL`.
   - Thương hiệu, điểm bán: không có bộ lọc; `returnTo` là địa chỉ danh sách.
4. **Ô nhập.** Giữ nguyên mọi ô và luật.
   - Điểm bán: trang thêm vẫn hiện trước mã sẽ cấp (`nextOutletCode`), trang sửa hiện mã cũ, không gửi mã.
   - Khuyến mãi: trang thêm vẫn mặc định ngày bắt đầu, kết thúc như hiện nay (khối `useEffect` khi không có `initialData`).
   - `returnTo` chỉ nhận đúng địa chỉ danh sách của màn đó, kèm hoặc không kèm `?…`.
5. **Dữ liệu.** Không đổi server action, không đổi bảng.
   - Khuyến mãi: trang thêm, sửa gọi `getPromotionsData()`, lọc bỏ thương hiệu, món, size, nhóm `DELETED` đúng như `promotions/page.tsx`; trang sửa `find` theo `id`.
   - Thương hiệu: `getBrands()` rồi `find`. Điểm bán: `getOutlets()` + `getBrands()`, `find`. Nhân sự: trang thêm không cần dữ liệu.

Thêm:
- **Menu:** bốn trang `new` thêm vào `app/admin/nav-allowlist.ts`.
- **Tài liệu:** dòng `routes:` của `docs/03-workflows/sales.md` (khuyến mãi), `operations.md` (thương hiệu, điểm bán), `users.md` (nhân sự) thêm địa chỉ mới.
- **Khuyến mãi là form dài** (492 dòng, nhiều ô chọn món, size). Trên trang riêng bỏ giới hạn chiều cao `max-h` của khung; giữ một cột trên điện thoại.

Đã xem: `PromotionForm.tsx` (props, đầu), `PromotionsClient.tsx` (chỗ mở form), `promotions/page.tsx`, `BrandForm.tsx` (dàn ý), `brands/page.tsx` (chỗ gọi), `OutletForm.tsx` (đầu), `outlets/page.tsx`, `OutletsList.tsx` (chỗ gọi), `UserForm.tsx` (dàn ý), `UsersClient.tsx` (bộ lọc, nút Sửa), `users/edit/[id]/page.tsx`, `EditUserForm.tsx` (chỗ chuyển trang), tên hàm trong bốn `actions.ts`.

Chưa xem: thân `PromotionForm.tsx` từ dòng 60, các test có sẵn của bốn màn.

## Global Constraints

- Chữ hiển thị tiếng Việt, code và chú thích tiếng Anh.
- Máy tính và điện thoại đều dùng được; điện thoại vùng bấm 44px.
- Khung hỏi có/không và khung báo lỗi giữ nguyên (`BR-DATA-007`, 2026-10-01).
- Giữ mọi khẳng định của test cũ; chỉ bỏ bước bấm nút mở khung.

## Review Focus

1. Lọc khuyến mãi rồi Sửa, Lưu: quay về đúng bộ lọc.
2. Thêm điểm bán: mã sẽ cấp hiện trước khi lưu, đúng mã kế tiếp.
3. Lọc nhân sự theo vai, Sửa một người, Lưu: quay về vẫn đúng vai đang lọc.
4. Sửa khuyến mãi theo món: các size đã chọn và giá trị từng size hiện lại đủ.
5. Lưu thương hiệu tên trống hoặc trùng: dòng đỏ trên trang, không rời trang.

---

### Task 1: Bốn `return-to.ts`

- [ ] Mỗi tệp + test như mục Architecture.

### Task 2: Khuyến mãi

**Files:** `promotions/components/PromotionForm.tsx`, `PromotionsClient.tsx`, tạo `promotions/new/page.tsx`, `promotions/[id]/edit/page.tsx`, tests.

- [ ] Test (đỏ trên bản cũ): render `<PromotionForm … returnTo="/admin/promotions?status=ACTIVE" />` không truyền `onClose` thì thấy ô tên khuyến mãi và nút "Bỏ"; "Bỏ" thì `push("/admin/promotions?status=ACTIVE")`. Danh sách: nút Sửa là liên kết `/admin/promotions/<id>/edit?returnTo=…`.

### Task 3: Thương hiệu

**Files:** `brands/components/BrandForm.tsx`, `brands/page.tsx`, tạo `brands/new/page.tsx`, `brands/[id]/edit/page.tsx`, tests.

- [ ] Test (đỏ): form render thấy ngay ô tên thương hiệu; "Bỏ" về `/admin/brands`.

### Task 4: Điểm bán

**Files:** `outlets/components/OutletForm.tsx`, `OutletsList.tsx`, `outlets/page.tsx`, tạo `outlets/new/page.tsx`, `outlets/[id]/edit/page.tsx`, tests.

- [ ] Test (đỏ): form thêm với `outlets` có mã `"001"`, `"003"` hiện trước mã `"004"` (`lib/catalog/outlet-code.ts` `nextOutletCode`); "Bỏ" về `/admin/outlets`. Bỏ `resetForNextOpen` và `handleClose` vì không còn mở lại.

### Task 5: Nhân sự

**Files:** `users/components/UserForm.tsx`, `UsersClient.tsx`, `users/page.tsx`, `EditUserForm.tsx`, `users/edit/[id]/page.tsx`, tạo `users/new/page.tsx`, tests.

- [ ] Test (đỏ): `UserForm` render thấy ngay ô tên đăng nhập; "Bỏ" về `returnTo`. `EditUserForm` lưu xong `push(returnTo)`. Danh sách với `initialFilters={{ q: "", role: "STAFF" }}` hiện đúng vai đang lọc (dùng giá trị vai có thật trong ô chọn).

### Task 6: Menu, tài liệu

- [ ] Như mục Thêm. Opus: chứng minh đỏ, chạy đủ năm lệnh, commit.
