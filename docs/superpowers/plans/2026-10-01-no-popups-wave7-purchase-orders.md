# Bỏ khung ô nhập — đợt 7: Thêm nhà cung cấp trong lúc nhập phiếu nhập — Implementation Plan

> **For agentic workers:** UI work goes to Gemini via `agy` (CLAUDE.md "Ai viết code"). Gemini cannot run shell commands in headless mode; Opus runs tests, proves them red on the old code, deletes files, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Trên phiếu nhập, gõ tên nhà cung cấp chưa có rồi bấm tạo mới thì sang trang Thêm nhà cung cấp (không bật khung). Lưu thì quay về đúng phiếu, mọi thứ đã gõ còn nguyên, nhà cung cấp vừa tạo được chọn sẵn. Bỏ thì quay về phiếu, mọi thứ còn nguyên, không chọn thêm gì.

**Architecture:**
- Bản nháp phiếu nằm trong bộ nhớ trình duyệt (`localStorage`) của máy đó, khoá `fnb:po-draft:<mã phiếu hoặc "new">`. Hàm thuần ở `app/admin/inventory/purchase-orders/components/po-draft.ts`:
  - `draftKey(poId: string | undefined): string`
  - `saveDraft(storage: Storage | null, key: string, state: PoDraftState, now: number): boolean` — ghi `{ savedAt: now, state }`; lỗi hoặc `storage` null thì trả `false`.
  - `takeDraft(storage: Storage | null, key: string, now: number): PoDraftState | null` — đọc, xoá khoá, trả `null` nếu không có, hỏng JSON, hoặc `now - savedAt > 24*60*60*1000`.
  - `PoDraftState = { supplierId; sourceId; supplierInvoiceCode; transactionDate: string | null (ISO); notes; lines: any[]; shippingFee; taxAmount; voucherAmount; discountAmount }`. Lưu hết các ô trên phiếu, không chỉ nhà cung cấp, ngày, dòng — để không mất gì đã gõ.
  - Mọi lần đụng `localStorage` bọc `try/catch` (trình duyệt chặn bộ nhớ thì ném lỗi khi truy cập).
- Địa chỉ đi: `/admin/suppliers/new?from=po&name=<chữ đã gõ>&returnTo=<địa chỉ phiếu hiện tại + draft=1>`. Địa chỉ phiếu hiện tại là `/admin/inventory/purchase-orders/new` hoặc `/admin/inventory/purchase-orders/<mã>` kèm `?edit=1` nếu đang có (lấy từ `usePathname()` + `useSearchParams()`), nên mã phiếu nằm trong địa chỉ như đặc tả §5 đòi.
- Trang Thêm nhà cung cấp: khi `from=po`, `returnTo` chỉ nhận địa chỉ khớp `^/admin/inventory/purchase-orders/(new|[A-Za-z0-9_-]+)(\?[^#]*)?$`; sai thì về `/admin/inventory/purchase-orders/new?draft=1`. Hàm `safePoReturnTo(raw)` đặt cạnh `safeReturnTo` trong `app/admin/suppliers/components/return-to.ts`.
  - Lưu: `router.push(returnTo + "&newSupplier=<id>")` (nối bằng `?` nếu `returnTo` chưa có `?`), rồi `router.refresh()`. `addSupplier` đã trả `id`.
  - Bỏ và `BackLink`: `router.push(returnTo)`. `BackLink` ghi "← Phiếu nhập".
  - Ô tên điền sẵn `name`.
- Phiếu nhập khi mở với `draft=1`:
  - `takeDraft(...)` có bản nháp: điền lại mọi ô từ bản nháp (đè giá trị máy chủ nạp).
  - Có `newSupplier=<id>` và `id` có trong `suppliers`: chọn nhà cung cấp đó, đè cái trong bản nháp.
  - Không lấy được bản nháp (máy khác, bộ nhớ bị chặn, quá 1 ngày): hiện dòng báo vàng trên đầu phiếu "Không khôi phục được phiếu đang nhập dở". Vẫn chọn sẵn `newSupplier` nếu có.
  - Xong thì `router.replace` bỏ `draft` và `newSupplier` khỏi địa chỉ (giữ `edit=1`), để tải lại trang không chạy lại.
  - Chạy một lần trong `useEffect` lúc mở, không chạy lúc dựng trên máy chủ.

**Spec:** `docs/superpowers/specs/2026-10-01-bo-popup-design.md` §5 (chủ quán chọn cách B, 2026-10-01). Luật: `BR-DATA-007`.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay: `PurchaseOrderForm` giữ `isSupplierModalOpen`, `newSupplierName`; `SupplierQuickAddModal.tsx` (`SupplierModal`) bật khung `ModalPortal`, lưu xong chọn nhà cung cấp mới và hiện khung "Đã thêm nhà cung cấp thành công!".
   - Sau đợt này: bỏ hai trạng thái đó và khung. Thêm một trạng thái `restoreFailed: boolean` cho dòng báo vàng. `SupplierQuickAddModal.tsx` hết người dùng: Opus xoá.
   - Khung "Đã thêm nhà cung cấp thành công!" bỏ, vì nhà cung cấp hiện sẵn trong ô là đủ báo.
2. **Nút.**
   - "Tạo mới" trong ô chọn nhà cung cấp (`SearchableSelect` `onCreateNew`): lưu bản nháp rồi chuyển trang. Không có nút mới.
   - Trang Thêm nhà cung cấp: Lưu, Bỏ, `BackLink` như mục Architecture.
   - Không đổi: Lưu nháp, Hoàn thành, mọi nút khác trên phiếu.
3. **Danh sách.** Ô chọn nhà cung cấp không đổi cách lọc. Nhà cung cấp mới có trong ô vì trang phiếu nạp lại từ máy chủ sau `router.refresh()`.
4. **Ô nhập.** Không đổi ô nào trên phiếu. Bản nháp cũ hơn 24 giờ bỏ. `newSupplier` không có trong danh sách nhà cung cấp thì bỏ qua. `returnTo` lạ thì về phiếu mới.
5. **Dữ liệu.** Không đổi server action, không đổi bảng. Bản nháp chỉ nằm trên trình duyệt; không gửi lên máy chủ. Cố ý không phục vụ: mở phiếu trên máy khác vẫn tiếp được — đặc tả §5 chấp nhận báo "Không khôi phục được…".

Thêm:
- **Câu hỏi riêng của việc này:**
  - Hai tab cùng phiếu mới? Khoá là `new` nên tab lưu sau đè tab trước. Chấp nhận: chủ quán nhập một phiếu một lúc.
  - Bấm Back của trình duyệt trên trang Thêm nhà cung cấp? Địa chỉ trước đó không có `draft=1`, nên phiếu mở trắng và bản nháp nằm lại tới lần sau mở với `draft=1` hoặc quá 24 giờ. Chấp nhận; không đoán.
- **Menu, tài liệu:** không thêm trang mới, không đổi menu. `docs/03-workflows/purchasing.md` (hoặc workflow chứa `/admin/inventory/purchase-orders`, tìm bằng `grep -l`) ghi một câu về bước thêm nhà cung cấp.

Đã xem: `PurchaseOrderForm.tsx` (đầu tới dòng 125, chỗ `onCreateNew` dòng ~226, chỗ `SupplierModal` dòng ~500), `SupplierQuickAddModal.tsx`, `purchase-orders/new/page.tsx`, `purchase-orders/[id]/page.tsx`, `lib/purchasing/purchase-order-edit-gate.ts`, `app/admin/suppliers/new/page.tsx`, `SupplierForm.tsx` (chỗ lưu, Bỏ), `suppliers/components/return-to.ts`.

Chưa xem: thân `PurchaseOrderForm.tsx` dòng 125–215 và 240–495, `SearchableSelect` ngoài prop `onCreateNew`.

## Global Constraints

- Chữ hiển thị tiếng Việt, code và chú thích tiếng Anh.
- Máy tính và điện thoại đều dùng được; dòng báo vàng không che ô nào.
- Khung hỏi có/không và khung báo lỗi giữ nguyên (`BR-DATA-007`, 2026-10-01).
- Giữ mọi khẳng định của test cũ.

## Review Focus

1. Phiếu mới, chọn nguồn, thêm 3 dòng, gõ "Đại Phát" ở nhà cung cấp, tạo mới, Lưu: về phiếu, 3 dòng còn đủ, nguồn còn, "Đại Phát" được chọn.
2. Như trên nhưng bấm Bỏ: về phiếu, 3 dòng còn, nhà cung cấp trống (hoặc cái đã chọn trước đó).
3. Phiếu nháp cũ đã có nhà cung cấp A, tạo nhà cung cấp B: về đúng phiếu đó (không phải phiếu mới), B thay A.
4. Lưu tên trùng trên trang Thêm nhà cung cấp: dòng đỏ, không rời trang, bản nháp chưa bị lấy đi.
5. Tải lại phiếu sau khi đã khôi phục: không hiện báo vàng, không chạy khôi phục lần hai.

---

### Task 1: Bản nháp phiếu

**Files:** tạo `app/admin/inventory/purchase-orders/components/po-draft.ts`, `po-draft.test.ts`.

- [ ] Test (đỏ, thiếu module), dùng một `Storage` giả bằng `Map`:
  - `saveDraft` rồi `takeDraft` cùng `now` trả đúng `state`; gọi `takeDraft` lần hai trả `null` (đã xoá).
  - `takeDraft` với `now = savedAt + 24h + 1` trả `null`.
  - `storage` ném lỗi ở `setItem`: `saveDraft` trả `false`. `storage` null: `takeDraft` trả `null`.
  - JSON hỏng: `takeDraft` trả `null`.
  - `draftKey(undefined) === "fnb:po-draft:new"`, `draftKey("PO-1") === "fnb:po-draft:PO-1"`.
- [ ] Code như mục Architecture.

### Task 2: Trang Thêm nhà cung cấp nhận `from=po`

**Files:** `app/admin/suppliers/components/return-to.ts` (+ test), `app/admin/suppliers/new/page.tsx`, `app/admin/suppliers/components/SupplierForm.tsx` (+ test).

- [ ] Test `safePoReturnTo` (đỏ, thiếu hàm): `/admin/inventory/purchase-orders/new?draft=1` giữ; `/admin/inventory/purchase-orders/PO-7?edit=1&draft=1` giữ; `https://x.com`, `//x.com`, `/admin/suppliers` đều thành `/admin/inventory/purchase-orders/new?draft=1`.
- [ ] Test form (đỏ): `<SupplierForm returnTo="/admin/inventory/purchase-orders/new?draft=1" returnMode="po" initialName="Đại Phát" />` — ô tên hiện "Đại Phát"; lưu thành công với `addSupplier` trả `{ success: true, id: "SUP-9" }` thì `push("/admin/inventory/purchase-orders/new?draft=1&newSupplier=SUP-9")`; "Bỏ" thì `push("/admin/inventory/purchase-orders/new?draft=1")`.
- [ ] Code: `SupplierForm` thêm prop `returnMode?: "list" | "po"` (mặc định `"list"`, giữ nguyên hành vi cũ) và `initialName?: string`. Với `"po"` dùng `safePoReturnTo`. Trang `new` đọc `from`, `name`, `returnTo`; `from=po` thì `BackLink` "Phiếu nhập".

### Task 3: Phiếu nhập dùng trang thay khung

**Files:** `PurchaseOrderForm.tsx`, tạo `PurchaseOrderForm.draft.test.tsx`.

- [ ] Test (đỏ trên bản cũ):
  - Mock `useRouter` (`push`, `replace`, `refresh`), `usePathname` → `/admin/inventory/purchase-orders/new`, `useSearchParams` → rỗng. Gọi `onCreateNew("Đại Phát")` (bấm qua `SearchableSelect`: gõ "Đại Phát" rồi bấm dòng tạo mới) thì `localStorage` có khoá `fnb:po-draft:new`, và `push` được gọi với `/admin/suppliers/new?from=po&name=%C4%90%E1%BA%A1i%20Ph%C3%A1t&returnTo=%2Fadmin%2Finventory%2Fpurchase-orders%2Fnew%3Fdraft%3D1` (đúng cách mã hoá `URLSearchParams` hoặc `encodeURIComponent` mà code chọn — test so bằng cách giải mã từng tham số, không so chuỗi thô).
  - Đặt sẵn bản nháp có ghi chú "giao sáng" và `useSearchParams` → `draft=1&newSupplier=SUP-2` (SUP-2 có trong `suppliers`): ô ghi chú hiện "giao sáng", nhà cung cấp hiện tên của SUP-2, `replace` được gọi với `/admin/inventory/purchase-orders/new`.
  - Không có bản nháp, `draft=1`: hiện "Không khôi phục được phiếu đang nhập dở".
- [ ] Code: như mục Architecture. Bỏ import `SupplierModal`, bỏ `isSupplierModalOpen`, `newSupplierName`, khối `<SupplierModal …/>`.

### Task 4: Dọn, tài liệu

- [ ] Opus xoá `SupplierQuickAddModal.tsx` (đã kiểm không còn ai import).
- [ ] Workflow phiếu nhập: một câu như mục Thêm.
- [ ] Opus: chứng minh đỏ, chạy đủ năm lệnh, commit.
