# Bỏ khung ô nhập — đợt 8: Đơn hàng, và phép kiểm canh — Implementation Plan

> **For agentic workers:** UI work goes to Gemini via `agy` (CLAUDE.md "Ai viết code"). Gemini cannot run shell commands in headless mode; Opus runs tests, proves them red on the old code, deletes files, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Xem chi tiết đơn và sửa đơn ở trang Đơn hàng mở thành trang riêng. Quay về thì danh sách giữ nguyên bộ lọc và trang đang xem. Sau đợt này bật phép kiểm canh: màn quản trị nào thêm khung ô nhập mới thì `npx vitest run` đỏ.

**Architecture:**
- Trang xem `/admin/orders/[id]`, trang sửa `/admin/orders/[id]/edit`. Cả hai nhận `?returnTo=`.
- `safeReturnTo(raw)` ở `app/admin/orders/components/return-to.ts`: chỉ nhận `/admin/orders` hoặc `/admin/orders?…`, khác thì `/admin/orders`. Cùng luật và bộ test như `app/admin/suppliers/components/return-to.ts`.
- Danh sách đã giữ bộ lọc trên địa chỉ (`?q=&from=&to=&payment=&brand=&page=`), nên `returnTo` là địa chỉ hiện tại (`pathname` + `searchParams`).
- Nút "Huỷ đơn" có ô lý do là câu hỏi có/không kèm lý do, giữ dạng khung (chủ quán 2026-10-01: khung hỏi có/không giữ). Tách khung đó khỏi `OrderTable.tsx` sang `app/admin/orders/components/VoidOrderButton.tsx` để dùng ở cả danh sách và trang xem. Không đổi chữ, không đổi luật (lý do bắt buộc).

**Spec:** `docs/superpowers/specs/2026-10-01-bo-popup-design.md`; luật `BR-DATA-007` (khung xem cũng thành trang). Đơn hàng không có trong bảng các đợt của đặc tả — Opus soát lại trước khi bật phép kiểm thì thấy còn sót; luật đã duyệt nên làm luôn, báo lại chủ quán.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay: `OrderTable` giữ `selectedOrder`, `editingOrder`, `orderToVoid`. `OrderDetailModal` (khung xem, tự gọi `getOrderDetailV2`) và `OrderEditModal` (khung sửa) bật bằng `fixed inset-0`.
   - Sau: `OrderTable` bỏ `selectedOrder`, `editingOrder`. `orderToVoid` chuyển vào `VoidOrderButton`. Đơn không có (`getOrderDetailV2` trả `null`) thì `notFound()`. Đơn không ở trạng thái `COMPLETED` thì trang sửa `notFound()` (khung cũ khoá nút Sửa trong trường hợp này).
2. **Nút.**
   - Dòng trong danh sách (máy tính và điện thoại): bấm vào dòng hoặc nút xem thì sang `/admin/orders/[id]?returnTo=…` (giữ cách bấm hiện nay, chỉ đổi đích). Nút Sửa trên dòng nếu có: sang `/admin/orders/[id]/edit?returnTo=…`.
   - Trang xem: `BackLink` "← Đơn hàng" về `returnTo`; "Sửa đơn" là liên kết sang trang sửa (kèm cùng `returnTo`), ẩn khi đơn không `COMPLETED` (thay cho nút mờ); "Huỷ đơn" là `VoidOrderButton`, ẩn khi không `COMPLETED`. Huỷ xong `router.push(returnTo)` rồi `router.refresh()`.
   - Trang sửa: `BackLink` về trang xem; "Bỏ" về trang xem; lưu xong `editOrderV2` tạo bản mới (`new_order_id`), nên đi tới `/admin/orders/<new_order_id>?returnTo=…` rồi `router.refresh()`.
3. **Danh sách.** Không đổi nội dung, không đổi bộ lọc.
4. **Ô nhập.** Trang sửa giữ nguyên mọi ô, `LineItemEditor`, `DiscountEditor`, ô lý do sửa, luật cũ.
5. **Dữ liệu.** Không đổi server action, không đổi bảng.
   - Trang xem: `getOrderDetailV2(id)` phía máy chủ (thay vì gọi trong `useEffect`), nên bỏ trạng thái "Đang tải...".
   - Trang sửa: `getOrderDetailV2(id)` lấy đơn; `findAll` năm bảng `Products`, `Product_Variants`, `Brands`, `Modifiers`, `Product_Categories` — đúng năm bảng `getOrdersV2` đang nạp cho khung sửa.
   - Thương hiệu cho trang xem: `findAll("Brands")`.

Thêm:
- **Hai thiết bị:** trang xem một cột `max-w-2xl` (khung cũ `max-w-lg`), đủ cho cả hai. Trang sửa giữ bố cục của khung cũ, bỏ giới hạn `max-h-[90vh]`; trên máy tính rộng tối đa `max-w-4xl`.
- **Menu:** không thêm trang `new`, không đổi menu.
- **Tài liệu:** dòng `routes:` của workflow chứa `/admin/orders` (tìm bằng `grep -l`) thêm `/admin/orders/[id]`, `/admin/orders/[id]/edit` theo đúng cách viết các dòng `[id]` đã có ở đợt trước.

### Phép kiểm canh (`app/admin/no-popups.test.ts`)

Đổi `it.todo` thành test thật:
- Quét mọi `app/admin/**/*.tsx` trừ `*.test.tsx`. Một tệp "bật khung" nếu chứa `FormModal`, `ModalPortal`, hoặc `fixed inset-0`.
- Danh sách tệp được phép, mỗi tệp kèm lý do trong code:
  - `app/admin/layout.tsx`, `app/admin/components/MoreSheet.tsx` (hoặc nơi `MoreSheet` thật sự nằm): menu, không phải khung ô nhập.
  - `app/admin/inventory/components/InventoryForms.tsx`: `ActionGroup` hỏi có/không trước khi xoá.
  - `app/admin/orders/components/VoidOrderButton.tsx`: hỏi có/không huỷ đơn, kèm lý do.
  - `IssueSlipDetailClient.tsx` (đường dẫn thật): hỏi có/không làm rỗng, huỷ phiếu xuất.
  - Các tệp còn lại mà Opus tìm thấy lúc làm đợt này và đã đọc tận mắt là khung có/không hoặc báo lỗi; ghi tên từng tệp, không dùng mẫu đại diện.
- Test so: tập tệp bật khung **bằng đúng** danh sách được phép. Thêm tệp mới bật khung thì đỏ; một tệp trong danh sách hết bật khung thì cũng đỏ (để danh sách không mục nát).
- Thêm: không tệp nào trong `app/admin` gọi `window.confirm(` hoặc `window.alert(`.
- `app/pos` không quét.
- Đổi xong chạy `npx vite-node scripts/doc-checks/open-items.ts` để `docs/04-operations/OPEN-ITEMS.md` bỏ mục này.

Đã xem: `orders/page.tsx`, `OrderTable.tsx` (đầu, `handleEditSave`, khối huỷ, chỗ gọi hai khung), `OrderDetailModal.tsx` (đầu, nút Sửa/Huỷ), `OrderEditModal.tsx` (props, chỗ lưu), tên hàm và kiểu trong `orders/actions.ts`.

Chưa xem: thân `OrderEditModal.tsx` dòng 60–440, chỗ bấm dòng trong `OrderTable.tsx`, `components/LineItemEditor.tsx`, `components/DiscountEditor.tsx`, test hiện có của đơn hàng ngoài `actions*.test.ts`.

## Global Constraints

- Chữ hiển thị tiếng Việt, code và chú thích tiếng Anh.
- Điện thoại: không bảng ngang, vùng bấm 44px.
- Khung hỏi có/không và khung báo lỗi giữ nguyên (`BR-DATA-007`, 2026-10-01).
- Giữ mọi khẳng định của test cũ.

## Review Focus

1. Lọc "Chuyển khoản", sang trang 2, xem một đơn, quay về: vẫn "Chuyển khoản", trang 2.
2. Sửa một đơn, lưu: tới trang xem của bản mới (v2), lịch sử hiện v1 "(đã thay thế)".
3. Đơn đã huỷ: trang xem không có nút Sửa, Huỷ; gõ tay địa chỉ sửa: 404.
4. Huỷ đơn không gõ lý do: nút "Đồng ý hủy" vẫn khoá.
5. Gõ tay `/admin/orders/khong-co`: 404.

---

### Task 1: `safeReturnTo` cho Đơn hàng

- [ ] `app/admin/orders/components/return-to.ts` + test.

### Task 2: `VoidOrderButton`

- [ ] Test (đỏ, thiếu module): bấm "Hủy đơn" thì hiện ô "Lý do hủy đơn"; nút "Đồng ý hủy" khoá khi ô trống; gõ lý do, bấm thì `voidOrderV2(id, lý do)` được gọi; thành công gọi `onVoided`.
- [ ] Code: chuyển nguyên khối khung huỷ từ `OrderTable.tsx`. `OrderTable` dùng nó trên mỗi dòng thay khối cũ.

### Task 3: Trang xem đơn

- [ ] Test (đỏ, thiếu module): `OrderDetailView` (`app/admin/orders/[id]/components/OrderDetailView.tsx`) nhận `detail`, `brands`, `returnTo`; đơn `COMPLETED` có liên kết "Sửa đơn" tới `/admin/orders/<id>/edit?returnTo=…`; đơn `VOIDED` không có "Sửa đơn" và không có "Hủy đơn".
- [ ] Code: trang `[id]/page.tsx` + view; chuyển thân `OrderDetailModal` sang view.

### Task 4: Trang sửa đơn

- [ ] Test (đỏ): `OrderEditForm` (đổi tên từ `OrderEditModal`, chuyển về `app/admin/orders/[id]/edit/components/OrderEditForm.tsx`) render thấy ngay ô lý do sửa; "Bỏ" về `/admin/orders/<id>?returnTo=…`; lưu thành công với `new_order_id: "ORD-NEW"` thì `push` tới `/admin/orders/ORD-NEW?returnTo=…`.
- [ ] Code: trang `[id]/edit/page.tsx` như mục Dữ liệu.

### Task 5: Danh sách

- [ ] Test: bấm một dòng đơn thì `push` (hoặc liên kết) tới `/admin/orders/<id>?returnTo=%2Fadmin%2Forders%3Fpayment%3D…` khi `useSearchParams` có `payment=…`.
- [ ] Code: bỏ `selectedOrder`, `editingOrder`, `handleEditSave`, import hai khung. Opus xoá `OrderDetailModal.tsx`, `OrderEditModal.tsx` khi không còn ai import.

### Task 6: Phép kiểm canh, tài liệu

- [ ] Opus viết phép kiểm như mục trên (là test, không phải giao diện). Chứng minh đỏ: chạy trên bản trước đợt 8 thì đỏ vì `OrderDetailModal.tsx`, `OrderEditModal.tsx` bật khung mà không có trong danh sách (đỏ vì giá trị sai).
- [ ] Tài liệu như mục Thêm; sinh lại `OPEN-ITEMS.md`.
- [ ] Opus: chạy đủ năm lệnh, commit.
