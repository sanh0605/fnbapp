# Kho bước 4: Ngừng dùng hàng hoá, ngừng hợp tác nhà cung cấp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chủ quán ngừng được một hàng hoá hay một nhà cung cấp không còn dùng, và bật lại được; phiếu nhập mới không mời chọn thứ đã ngừng; nhà cung cấp chỉ xoá được khi chưa có phiếu nhập nào.

**Spec:** `docs/superpowers/specs/2026-10-15-kho-de-xuat.md` (bảng việc kỹ thuật, dòng "Ngừng dùng / Dùng lại"; thứ tự làm bước 4), luật `BR-CATALOG-007` (chủ quán chốt Q3 2026-10-15). Kế hoạch A bước 4 (`docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md`).

**Thiết kế rút gọn:** sửa thứ đã có, không bảng mới, không trang mới, không migration. Cột `status` đã có trên cả hai bảng và đã nhận `INACTIVE` (đo 2026-10-15: `suppliers_status_check`, `purchased_items_status_check` cho phép `ACTIVE`, `INACTIVE`, `DELETED`). Trang chi tiết và danh sách đã hiện nhãn "Ngừng hợp tác"/"Ngừng dùng" khi `INACTIVE`; chỉ thiếu nút và hàm máy chủ đổi trạng thái.

## Global Constraints

- Ghi một bảng, một cột (`status`): không cần hàm Postgres.
- Quyền: như sửa thông tin (`requireAdmin()`, tức chủ quán và quản lý). Xoá hẳn vẫn `requireOwner()`.
- Chữ trên màn: nhà cung cấp "Ngừng hợp tác" / "Hợp tác lại"; hàng hoá "Ngừng dùng" / "Dùng lại" (đã dùng ở nhãn hiện có).
- Không khung bật nhập liệu (`BR-DATA-007`); hỏi có/không giữ hộp của app như nút xoá hiện có.
- Ponytail: không viết thừa code. Năm cửa kiểm xanh.

## Hiện trạng

1. **Trạng thái.** Hai trạng thái dùng: `ACTIVE` (đang dùng/đang hợp tác) và `INACTIVE` (ngừng). Đo 2026-10-15: 48/48 nhà cung cấp và 151/151 hàng hoá đều `ACTIVE`; không cách nào đặt `INACTIVE` từ màn hình. `DELETED` còn trong luật kiểm của bảng nhưng không dùng; bỏ nó thuộc đợt migration cấu trúc (bước 7 của Kho), không phải bước này.
2. **Nút.**
   - Trang chi tiết nhà cung cấp: thêm "Ngừng hợp tác" khi `ACTIVE`, "Hợp tác lại" khi `INACTIVE`. "Xoá" chỉ hiện khi nhà cung cấp chưa có phiếu nhập nào (đo: 2/48, The Garden Tea & Coffee và Circle K) và người xem là chủ quán; còn lại ẩn. Máy chủ vẫn từ chối như hôm nay nếu ai gửi thẳng.
   - Trang chi tiết hàng hoá: thêm "Ngừng dùng" / "Dùng lại". Nút "Xoá" giữ luật hiện có (`deletePurchasedItemAction` từ chối hàng đã có phiếu nhập, phiếu xuất, quy đổi, tài sản); đo: 3/151 hàng chưa có dòng phiếu nhập.
   - Không thêm nút trên dòng danh sách: thùng rác ở dòng giữ như hôm nay (khuôn 2026-10-02).
3. **Danh sách.**
   - Ô chọn nhà cung cấp và ô chọn hàng hoá trong form phiếu nhập (tạo, sửa, sao chép): chứa thứ `ACTIVE`, **cộng** thứ đã nằm trên phiếu đang sửa hay đang chép, để phiếu cũ mở ra vẫn đủ tên. Loại thứ `INACTIVE` khác, vì đã ngừng thì không mua nữa.
   - Phiếu xuất, kiểm kê, công thức, báo cáo: **giữ nguyên**, vẫn thấy hàng đã ngừng. Hàng ngừng mua vẫn có thể còn tồn cần xuất hay đếm (`BR-INV-019`).
   - Danh sách Nhà cung cấp và Hàng hoá: giữ mọi dòng, nhãn trạng thái đã có.
4. **Ô nhập.** Không có ô mới. Hàm máy chủ chỉ nhận `ACTIVE` hoặc `INACTIVE`; giá trị khác bị từ chối "Trạng thái không hợp lệ.". Mã không có thì "Không tìm thấy nhà cung cấp." / "Không tìm thấy hàng hoá.".
5. **Phục vụ dữ liệu nào.** Bảng `suppliers`, `purchased_items`, cột `status`. Cố ý không đụng: đơn vị tính, phân loại hàng, quy đổi (có trạng thái riêng), máy bán hàng.

Thêm cho việc này:

6. **Gỡ/đổi một thứ thì ai đọc kết quả?** Ai đọc `status` của hai bảng hôm nay: nhãn ở danh sách và chi tiết (`SuppliersClient.tsx`, `SupplierDetailView.tsx`, `ItemsClient.tsx`, `ItemDetailView.tsx`). Form phiếu nhập đọc toàn bộ danh sách (`app/admin/inventory/purchase-orders/new/page.tsx` `findAll("Suppliers")`, `findAll("Purchased_Items")`, và chỗ nạp form sửa phiếu): đây là chỗ phải lọc. Sonnet grep lại mọi chỗ nạp hai danh sách đó cho form phiếu nhập.
7. **Bộ nhớ đệm.** Hai bảng được giữ đệm 10 phút; hàm đổi trạng thái phải `revalidateTag(getCacheTag(...), { expire: 0 })` như `updatePurchasedItem`, nếu không form phiếu nhập còn mời thứ vừa ngừng.

Ví dụ: chủ quán bấm "Ngừng hợp tác" ở Circle K. Trang chi tiết hiện nhãn "Ngừng hợp tác", nút đổi thành "Hợp tác lại". Mở "Tạo phiếu nhập": ô nhà cung cấp không còn Circle K. Mở một phiếu cũ của Circle K (nếu có) để sửa: ô vẫn hiện Circle K.

Đã xem: `app/admin/suppliers/actions.ts`, `app/admin/inventory/items/actions.ts` (sửa, xoá), hai trang chi tiết, trang tạo phiếu nhập, `getPurchaseOrdersData`, luật kiểm của hai bảng trên máy chủ. Chưa xem: chỗ nạp form sửa phiếu nhập và chép phiếu (Sonnet đo), test hiện có của hai trang chi tiết.

## Phiếu S4 (Sonnet, máy chủ)

**Interfaces — Produces:**
```ts
// app/admin/suppliers/actions.ts
export async function setSupplierStatus(formData: FormData): Promise<ActionResponse>; // fields: id, status ("ACTIVE" | "INACTIVE")
// app/admin/inventory/items/actions.ts
export async function setPurchasedItemStatus(formData: FormData): Promise<ActionResponse>; // fields: id, status
```

- [ ] Test trước (đỏ vì thiếu hàm): đổi `ACTIVE`→`INACTIVE` và ngược lại ghi đúng một cột; `status="DELETED"` bị từ chối; mã không có bị từ chối; vai không phải chủ quán/quản lý bị từ chối; gọi `revalidateTag` thẻ của bảng.
- [ ] Viết hai hàm, cùng kiểu `editSupplier` / `updatePurchasedItem`.
- [ ] Form phiếu nhập (tạo, sửa, chép): nạp nhà cung cấp và hàng hoá `ACTIVE` cộng thứ đã có trên phiếu. Test trước: một nhà cung cấp `INACTIVE` không có trong danh sách tạo mới; có trong danh sách khi sửa phiếu của chính nó. Tương tự cho hàng hoá.
- [ ] `addPurchaseOrder` / lưu phiếu: máy chủ từ chối nhà cung cấp hay hàng hoá `INACTIVE` **không** có sẵn trên phiếu cũ, câu "Nhà cung cấp {tên} đã ngừng hợp tác." / "{tên hàng} đã ngừng dùng.". Test trước.
- [ ] `npx tsc --noEmit`, `npx vitest run` các file đã đụng. Không commit; báo Opus danh sách file và test.

## Phiếu G4 (Gemini, giao diện)

- [ ] `SupplierDetailView.tsx`: nút "Ngừng hợp tác" / "Hợp tác lại" trong `actions` của `DetailHeader`, gọi `setSupplierStatus`; hỏi có/không bằng hộp hiện có của app trước khi ngừng (không hỏi khi bật lại). "Xoá" chỉ hiện khi `orders.total === 0` và người xem là chủ quán. Thành công thì `router.refresh()`; lỗi hiện `Alert`.
- [ ] `ItemDetailView.tsx`: nút "Ngừng dùng" / "Dùng lại", gọi `setPurchasedItemStatus`, cùng cách.
- [ ] Test giao diện cho hai trang: nút đúng chữ theo trạng thái; "Xoá" ẩn khi đã có phiếu nhập.
- [ ] Máy tính và điện thoại: nút nằm trong cụm nút đầu trang như "Chỉnh sửa"; trên điện thoại cụm nút xuống dòng, không tràn.

## O4 (Opus)

- [ ] Soát diff hai phiếu (tìm cả chỗ thừa); năm cửa kiểm; ghi `BR-CATALOG-007` "Built" và thêm câu cho hàng hoá; dòng soát vào `docs/03-workflows/` tương ứng.
- [ ] Hỏi chủ quán duyệt đẩy (gộp với các việc khác). Không migration, không ghi dữ liệu.
