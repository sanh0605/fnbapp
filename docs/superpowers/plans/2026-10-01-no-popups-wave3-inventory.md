# Bỏ khung ô nhập — đợt 3: Kho — Implementation Plan

> **For agentic workers:** UI work goes to Gemini via `agy` (CLAUDE.md "Ai viết code"). Gemini cannot run shell commands in headless mode; Opus runs tests, proves them red on the old code, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Thêm, sửa mặt hàng, phân loại hàng, đơn vị, quy đổi mở thành trang riêng. Lịch sử giá nhập của mặt hàng cũng thành trang riêng. Lưu hoặc Bỏ thì quay về danh sách, bộ lọc giữ nguyên.

**Architecture:** Giống đợt 1 và 2.
- Mỗi màn một cặp `new` và `[id]/edit`, dùng chung form cũ đã gỡ khung.
- Form nhận `returnTo`. Lưu xong `router.push(returnTo)` rồi `router.refresh()`. Bỏ thì `router.push(returnTo)`.
- Một hàm `safeReturnTo(raw, list)` cho cả vùng Kho, ở `app/admin/inventory/components/return-to.ts`, cùng hình dạng `app/admin/finance/components/return-to.ts`.

**Spec:** `docs/superpowers/specs/2026-10-01-bo-popup-design.md` (đợt 3). Luật: `BR-DATA-007`. Mẫu: đợt 2, `docs/superpowers/plans/2026-10-01-no-popups-wave2-finance.md`, và code của nó dưới `app/admin/finance/`.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay:
     - `PurchasedItemForm`, `ConversionForm`, `PurchaseHistoryButton` dùng `FormModal`.
     - `app/admin/inventory/components/CategoryForm.tsx` dùng `ModalPortal`.
     - `app/admin/inventory/units/UnitForm.tsx` tự vẽ khung (`fixed inset-0`).
     - Mỗi form giữ `isOpen`.
   - Sau đợt này: không còn `isOpen` trong năm thứ trên. Mã không tồn tại thì `notFound()`.
2. **Nút.**
   - Mặt hàng:
     - "+ Thêm Hàng Mua Vào" (chữ cũ, giữ nguyên) sang `/admin/inventory/items/new`.
     - "Sửa" sang `/admin/inventory/items/[id]/edit`.
     - "Lịch sử nhập" sang `/admin/inventory/items/[id]/history`.
     - "Bảng quy đổi" giữ nguyên.
   - Phân loại hàng: "+ Phân loại Hàng Hoá" sang `/admin/inventory/categories/new`; "Sửa" sang `/admin/inventory/categories/[id]/edit`.
   - Đơn vị: "+ Thêm Đơn vị" sang `/admin/inventory/units/new`; "Sửa" sang `/admin/inventory/units/[id]/edit`.
   - Quy đổi: "+ Thêm Quy Đổi" sang `/admin/inventory/conversions/new`; "Sửa" sang `/admin/inventory/conversions/[id]/edit`.
   - Trên trang form: `BackLink` về `returnTo`, nút "Bỏ" về `returnTo`, nút lưu giữ chữ cũ. Nút "Huỷ" trong khung cũ đổi thành "Bỏ".
   - Trang lịch sử nhập: chỉ có `BackLink` "← Hàng hoá" về `returnTo`.
   - Giữ nguyên, không đổi:
     - Mọi nút Xoá và khung xác nhận xoá. Trong đó có `ActionGroup` ở `app/admin/inventory/components/InventoryForms.tsx`: nó là khung có/không, giữ.
     - Khung báo lỗi `alert(...)` khi lưu hỏng, giữ (chủ quán 2026-10-01).
3. **Danh sách.** Không đổi nội dung.
   - Mặt hàng đã giữ bộ lọc trên địa chỉ (`useFilterForm`, `?q=&category=`). Danh sách lấy địa chỉ hiện tại (`usePathname()` + `useSearchParams()`) làm `returnTo`.
   - Quy đổi đang giữ ô tìm trong bộ nhớ (`useState`). Chuyển lên địa chỉ `?q=` giống `app/admin/suppliers/components/SuppliersClient.tsx` (`router.replace(…, { scroll: false })`). Trang danh sách đọc `searchParams.q` làm giá trị đầu.
   - Phân loại hàng, đơn vị: không có bộ lọc, `returnTo` là địa chỉ danh sách.
4. **Ô nhập.** Mọi ô giữ nguyên tên, luật, cách khoá. Ví dụ: ô đơn vị cơ bản của mặt hàng vẫn khoá khi mặt hàng đã có đơn nhập hoặc phiếu xuất (`isUnitLocked`). `returnTo` chỉ nhận đúng địa chỉ danh sách của màn đó, kèm hoặc không kèm `?…`.
5. **Dữ liệu.** Không đổi server action, không đổi bảng.
   - Trang `edit` mặt hàng gọi `getItemsData()`, tìm mặt hàng theo `id`, lấy quy đổi của nó (`conversions.filter(c => c.purchased_item_id === id)`, cùng cách `ItemsClient` đang làm), `isUnitLocked = unitLockedItemIds.includes(id)`.
   - Trang lịch sử nhập gọi `getItemPurchaseHistory(id)` phía máy chủ và `findById("Purchased_Items", id)` lấy tên.
   - Trang `edit` quy đổi gọi `getConversionsData()`, tìm theo `id`.
   - Trang `edit` phân loại: `findById("Item_Categories", id)`. Trang `edit` đơn vị: `findById("Units", id)`, bỏ qua đơn vị đã xoá mềm (`name` bắt đầu `DELETED_`) bằng `notFound()`.

Thêm:
- **Lịch sử nhập trên điện thoại:** bảng 6 cột không dùng trên điện thoại (`.claude/rules/ui-devices.md`). Máy tính giữ bảng (`hidden md:block`); điện thoại mỗi lần nhập là một thẻ (`md:hidden`): ngày, nhà cung cấp, số lượng, đơn giá, thành tiền, mã đơn nhập. Dòng báo giá tăng/giảm giữ trên cả hai.
- **Menu:** năm trang `new` (items, categories, units, conversions) thêm vào `app/admin/nav-allowlist.ts`. Trang `[id]` không bị đòi.
- **Tài liệu:** dòng `routes:` của workflow chứa các màn này thêm địa chỉ mới. Tìm bằng `grep -l "/admin/inventory/items" docs/03-workflows/*.md` và tương tự cho categories, units, conversions.

Đã xem: `ItemsClient.tsx` (nút, bộ lọc), `PurchasedItemForm.tsx` (props, đầu hàm), `PurchaseHistoryButton.tsx`, `items/page.tsx`, `items/actions.ts` (`getItemsData`, `getItemPurchaseHistory`), `components/CategoryForm.tsx`, `components/InventoryForms.tsx`, `categories/page.tsx`, `units/UnitForm.tsx`, `conversions/page.tsx`, `ConversionsClient.tsx` (đầu), `lib/shared/use-filter-form.ts`.

Chưa xem: `units/page.tsx` ngoài chỗ gọi `DeleteBtn`; `ConversionForm.tsx` ngoài props; `PurchasedItemForm.test.tsx`, `UnitForm.test.tsx` ngoài đầu file.

## Global Constraints

- Chữ hiển thị tiếng Việt, code và chú thích tiếng Anh.
- Máy tính và điện thoại đều dùng được: form một cột, vùng bấm 44px trên điện thoại, không bảng ngang trên điện thoại.
- Khung hỏi có/không và khung báo lỗi giữ nguyên (`BR-DATA-007`, 2026-10-01).
- Giữ mọi khẳng định của test cũ; chỉ bỏ bước bấm nút mở khung.

## Review Focus

1. Lọc mặt hàng theo nhóm "Nguyên liệu" rồi Sửa một mặt hàng: lưu xong vẫn đang lọc "Nguyên liệu".
2. Sửa mặt hàng đã có đơn nhập: ô đơn vị cơ bản vẫn khoá trên trang mới.
3. Sửa mặt hàng có 2 dòng quy đổi: trang sửa hiện đủ 2 dòng, đúng tên đơn vị.
4. Lịch sử nhập của mặt hàng chưa nhập lần nào: hiện "Chưa có lần nhập hàng nào đã hoàn thành cho mặt hàng này."
5. Gõ tìm ở Bảng quy đổi, Sửa, Lưu: quay về vẫn còn chữ đã gõ.

---

### Task 1: `safeReturnTo` cho Kho

- [ ] Create `app/admin/inventory/components/return-to.ts` + test. `export type InventoryList = "/admin/inventory/items" | "/admin/inventory/categories" | "/admin/inventory/units" | "/admin/inventory/conversions";` Cùng luật và cùng bộ test như `app/admin/finance/components/return-to.test.ts`, đổi địa chỉ.

### Task 2: Mặt hàng và lịch sử nhập

**Files:** `items/components/PurchasedItemForm.tsx`, `PurchasedItemForm.test.tsx`, `ItemsClient.tsx`, `PurchaseHistoryButton.tsx` (xoá sau khi trang lịch sử thay nó; không còn ai import), tạo `items/new/page.tsx`, `items/[id]/edit/page.tsx`, `items/[id]/history/page.tsx`, `items/[id]/history/components/PurchaseHistoryView.tsx` (+ test).

- [ ] Test form (đỏ trên bản cũ): render `PurchasedItemForm` với `returnTo="/admin/inventory/items?category=CAT-1"` thì thấy ngay ô tên mặt hàng; bấm "Bỏ" thì `push("/admin/inventory/items?category=CAT-1")`.
- [ ] Test `PurchaseHistoryView` (đỏ vì thiếu module): nhận `rows` và `itemName`; 0 dòng thì hiện câu "Chưa có lần nhập hàng nào…"; 2 dòng giá tăng thì hiện "Giá nhập gần nhất tăng"; mỗi dòng có liên kết tới `/admin/inventory/purchase-orders/<poId>`.
- [ ] Test danh sách: nút Sửa và Lịch sử nhập của một mặt hàng là liên kết tới đúng địa chỉ, kèm `?returnTo=` mã hoá địa chỉ hiện tại. Mock `usePathname` trả `/admin/inventory/items`, `useSearchParams` trả `category=CAT-1`.
- [ ] Code theo mục Hiện trạng.

### Task 3: Phân loại hàng

**Files:** `components/CategoryForm.tsx`, `components/InventoryForms.tsx` (chỉ bỏ dòng re-export nếu không còn ai dùng), `categories/page.tsx`, tạo `categories/new/page.tsx`, `categories/[id]/edit/page.tsx`, `components/CategoryForm.test.tsx`.

- [ ] Test (đỏ): render `CategoryForm` thấy ngay ô tên phân loại; "Bỏ" về `/admin/inventory/categories`.
- [ ] Code: gỡ `ModalPortal`, thêm `htmlFor`/`id` cho hai ô (đang thiếu nhãn gắn ô).

### Task 4: Đơn vị

**Files:** `units/UnitForm.tsx`, `units/UnitForm.test.tsx`, `units/page.tsx`, tạo `units/new/page.tsx`, `units/[id]/edit/page.tsx`.

- [ ] Test (đỏ): render `UnitForm` thấy ngay ô "Tên đơn vị"; "Bỏ" về `/admin/inventory/units`. Test `DeleteBtn` cũ giữ nguyên.

### Task 5: Quy đổi

**Files:** `conversions/components/ConversionForm.tsx`, `ConversionsClient.tsx`, `conversions/page.tsx`, tạo `conversions/new/page.tsx`, `conversions/[id]/edit/page.tsx`, `ConversionForm.test.tsx`, `ConversionsClient.test.tsx`.

- [ ] Test form (đỏ): render thấy ngay ô chọn mặt hàng; "Bỏ" về `returnTo`.
- [ ] Test danh sách: với `initialSearch="sữa"`, ô tìm hiện "sữa"; nút Sửa mang `returnTo=%2Fadmin%2Finventory%2Fconversions%3Fq%3Ds%E1%BB%AFa`.

### Task 6: Menu, tài liệu

- [ ] `app/admin/nav-allowlist.ts` và các dòng `routes:` như mục Thêm.
- [ ] Opus: chứng minh đỏ trên bản cũ, chạy đủ năm lệnh, commit trên `feat/no-popups`.
