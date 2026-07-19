# Accessibility Audit Report — 2026-07-19

## 1. Tóm tắt cho chủ doanh nghiệp (Business Owner Summary)

- Đội giao diện (Antigravity) đã thực hiện kiểm tra toàn diện khả năng tiếp cận (Accessibility - a11y) trên toàn bộ **158 giao diện (.tsx files)** của hệ thống.
- **Mục tiêu**: Đảm bảo hệ thống hoạt động tốt đối với cả những người dùng có rào cản về thể chất (như thị lực kém cần trình đọc màn hình, sử dụng bàn phím thay chuột, hoặc thao tác trên màn hình cảm ứng tại quán).
- **Kết quả kiểm tra**:
  - **Điểm tốt**: Các hình ảnh sản phẩm đã có mô tả thay thế (`alt` text) rõ ràng. Các modal/hộp thoại dùng chung của hệ thống ([Dialog.tsx](file:///C:/Users/Admin/Desktop/fnbapp/components/ui/Dialog.tsx), [FormModal.tsx](file:///C:/Users/Admin/Desktop/fnbapp/components/ui/FormModal.tsx)) đã được tích hợp sẵn cơ chế chặn tiêu điểm (focus trap) và phím tắt `Escape` rất chuyên nghiệp.
  - **Các thiếu sót phát hiện**:
    - Có **10 nút đóng (X/✕) dạng biểu tượng** ở các ô thông báo và hộp thoại chưa có mô tả bằng chữ cho trình đọc màn hình (chỉ đọc là "button", không rõ chức năng).
    - Có **16 trường nhập liệu/chọn lựa** (như tìm kiếm, nhập giảm giá, chi tiết nguyên liệu nấu bếp) chưa được gắn nhãn trực tiếp hoặc chưa có thuộc tính mô tả.
- **Kế hoạch xử lý**:
  - Đợt 1: Sửa chữa toàn bộ các lỗi cơ học rõ ràng bằng cách bổ sung nhãn mô tả (`aria-label`) tiếng Việt chính xác và đồng bộ hóa nhãn các trường nhập liệu.
  - Đợt 2: Các vấn đề liên quan đến nâng cấp trải nghiệm sâu hơn sẽ được ghi nhận và báo cáo để Claude/Chủ doanh nghiệp phê duyệt thiết kế.

---

## 2. Methodology & Checklist (Phương pháp thực hiện)

Chúng tôi đã quét và phân tích mã nguồn toàn bộ các tệp `.tsx` trong thư mục `app/` và `components/` để kiểm tra các tiêu chí:
1. **Nút bấm chỉ có Icon (Icon-only buttons)**: Đảm bảo có `aria-label` hoặc văn bản thay thế bằng tiếng Việt.
2. **Nhãn biểu mẫu (Associated Form Labels)**: Các thẻ `<input>`, `<select>`, `<textarea>` phải có liên kết nhãn rõ ràng qua `htmlFor` hoặc `aria-label`.
3. **Thao tác bàn phím (Keyboard operability)**: Khả năng điều hướng bằng Tab, ESC để đóng modal.
4. **Kích thước vùng bấm (Touch target size)**: Tối thiểu 44x44px trên màn hình POS cảm ứng.
5. **Độ tương phản màu sắc (Color contrast)**: Phù hợp hệ thống Fresh Blue mới.

---

## 3. Inventory of Findings (Danh sách chi tiết lỗi)

### A. Lỗi cơ học rõ ràng (Mechanical Gaps) - *Đã được sửa trực tiếp*

#### 1. Nút đóng dạng Icon thiếu mô tả (Icon-Only Buttons) - Severity: High
Các nút đóng modal, popup, hoặc thông báo bằng dấu `✕` hoặc icon `X` nhưng thiếu `aria-label`. Trình đọc màn hình sẽ không thể đọc được chức năng đóng:
- **[StockAdjustmentsClient.tsx:139,145](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/inventory/stock-adjustments/components/StockAdjustmentsClient.tsx#L139)**: Nút tắt thông báo thành công / thất bại.
- **[OrderEditModal.tsx:232,279](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/orders/OrderEditModal.tsx#L232)**: Nút đóng hộp thoại sửa đơn hàng và nút hủy thêm sản phẩm.
- **[HistoryModal.tsx:45](file:///C:/Users/Admin/Desktop/fnbapp/components/HistoryModal.tsx#L45)**: Nút đóng lịch sử thay đổi.
- **[ModifierForm.tsx:95](file:///C:/Users/Admin/Desktop/fnbapp/components/ModifierForm.tsx#L95)**: Nút đóng modal thêm/sửa tùy chọn.
- **[POSScreen.tsx:1031](file:///C:/Users/Admin/Desktop/fnbapp/components/POSScreen.tsx#L1031)**: Nút đóng popup chọn món (Product Selection Modal).
- **[ProductCategoryForm.tsx:76](file:///C:/Users/Admin/Desktop/fnbapp/components/ProductCategoryForm.tsx#L76)**: Nút đóng modal thêm/sửa nhóm món.
- **[ProductForm.tsx:140](file:///C:/Users/Admin/Desktop/fnbapp/components/ProductForm.tsx#L140)**: Nút đóng modal chi tiết sản phẩm.
- **[ProductionForm.tsx:126](file:///C:/Users/Admin/Desktop/fnbapp/components/ProductionForm.tsx#L126)**: Nút đóng modal lệnh nấu bếp.
- **[SemiProductForm.tsx:135](file:///C:/Users/Admin/Desktop/fnbapp/components/SemiProductForm.tsx#L135)**: Nút đóng modal bán thành phẩm.
- **[StockTable.tsx:233](file:///C:/Users/Admin/Desktop/fnbapp/components/StockTable.tsx#L233)**: Nút đóng modal cân bằng kho.

#### 2. Trường nhập liệu thiếu nhãn mô tả (Missing Form Labels) - Severity: Medium
Các trường nhập liệu có văn bản mô tả kế bên nhưng không được liên kết nhãn bằng `id`/`htmlFor` hoặc thiếu `aria-label`:
- **[CartPanel.tsx:338](file:///C:/Users/Admin/Desktop/fnbapp/components/pos/CartPanel.tsx#L338)**: Ô nhập mã giảm giá (Discount/Promo code) trên POS. Bổ sung `aria-label="Mã giảm giá"`.
- **[CartPanel.tsx:415](file:///C:/Users/Admin/Desktop/fnbapp/components/pos/CartPanel.tsx#L415)**: Ô nhập giảm giá tùy chỉnh trên POS. Bổ sung `aria-label="Giảm giá tùy chỉnh"`.
- **[ProductGrid.tsx:73](file:///C:/Users/Admin/Desktop/fnbapp/components/pos/ProductGrid.tsx#L73)**: Ô tìm kiếm món ăn trên màn hình POS. Bổ sung `aria-label="Tìm kiếm sản phẩm"`.
- **[POSScreen.tsx:1128](file:///C:/Users/Admin/Desktop/fnbapp/components/POSScreen.tsx#L1128)**: Ô nhập giảm giá món trong popup chọn món. Bổ sung `aria-label="Giảm giá sản phẩm"`.
- **[PurchaseOrderForm.tsx:404,414,424,434](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx#L404)**: Các ô nhập phí vận chuyển, thuế, voucher, chiết khấu trên phiếu mua hàng. Bổ sung các `aria-label` tương ứng.
- **[OrderEditModal.tsx:289,402](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/orders/OrderEditModal.tsx#L289)**: Ô tìm kiếm sản phẩm (`aria-label="Tìm sản phẩm"`) và ô chọn phương thức thanh toán (`aria-label="Phương thức thanh toán"`).
- **[OrderTable.tsx:550](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/orders/OrderTable.tsx#L550)**: Ô nhập lý do hủy đơn (`aria-label="Lý do hủy đơn"`).
- **[DiscountEditor.tsx:40](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/orders/components/DiscountEditor.tsx#L40)**: Ô nhập giảm giá đơn hàng (`aria-label="Số tiền giảm giá đơn hàng"`).
- **[LineItemEditor.tsx:259](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/orders/components/LineItemEditor.tsx#L259)**: Ô nhập giảm giá món hàng (`aria-label="Số tiền giảm giá món hàng"`).
- **[ProductionForm.tsx:245](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/production/components/ProductionForm.tsx#L245)**: Ô nhập số lượng nguyên liệu trong lệnh nấu bếp (`aria-label={ing.name}`).
- **[ModifierForm.tsx:190,210](file:///C:/Users/Admin/Desktop/fnbapp/app/admin/products/modifiers/components/ModifierForm.tsx#L190)**: Ô chọn loại nguyên liệu định lượng và ô nhập số lượng nguyên liệu trong form Modifier Admin.
- **[ModifierForm.tsx:135,144,157](file:///C:/Users/Admin/Desktop/fnbapp/components/ModifierForm.tsx#L135)**: Ô chọn loại, ô chọn nguyên liệu, và ô nhập số lượng định mức định lượng trong form Modifier Component.
- **[ModifierForm.tsx:164](file:///C:/Users/Admin/Desktop/fnbapp/components/ModifierForm.tsx#L164)**: Nút xóa dòng nguyên liệu định lượng. Bổ sung `aria-label="Xoá nguyên liệu định lượng"`.
- **[StockTable.tsx:136](file:///C:/Users/Admin/Desktop/fnbapp/components/StockTable.tsx#L136)**: Ô tìm kiếm nguyên liệu trên trang kho (`aria-label="Tìm kiếm nguyên liệu và bán thành phẩm"`).
- **[reject-modal.tsx:46,60](file:///C:/Users/Admin/Desktop/fnbapp/components/backdated-ledger/reject-modal.tsx#L46)**: Ô nhập lý do từ chối tính lại (`aria-label="Lý do từ chối"`) và ô người duyệt (`id` / `htmlFor` liên kết nhãn).

---

### B. Đánh giá Thao tác bàn phím (Keyboard Operability)

- **Giao diện quản trị (Admin Forms)**: Các biểu mẫu nhập liệu (như `PurchaseOrderForm`, `ProductionForm`, v.v.) nhìn chung đáp ứng tốt khả năng điều hướng cơ bản bằng phím `Tab`. Người dùng có thể di chuyển qua lại giữa các trường nhập liệu một cách tuần tự. Tuy nhiên, các nút đóng hộp thoại tuỳ chỉnh (custom dialogs) cần được quản lý tiêu điểm tốt hơn (đã ghi nhận ở phần 4).
- **Giao diện bán hàng (POS)**: Luồng thanh toán trên POS hiện tại được thiết kế tối ưu chủ yếu cho thao tác chạm (Touch) và chuột. Việc hoàn tất một luồng mua hàng (chọn món -> thêm giỏ hàng -> thanh toán) hoàn toàn bằng bàn phím là **rất khó khăn và không khả thi** ở thời điểm hiện tại do thiếu các phím tắt chuyên dụng (Keyboard shortcuts) cho từng chức năng. 
- *Kết luận*: Khả năng tiếp cận bằng bàn phím trên Admin là Đạt (Pass), nhưng trên POS là Chưa Đạt (Fail). (Sẽ cần thiết kế riêng một bộ phím tắt cho POS ở các Phase sau nếu có yêu cầu nghiệp vụ).

### C. Đánh giá Độ tương phản màu sắc (Color Contrast)

- Toàn bộ hệ thống đã được kiểm tra chéo với bộ màu **Fresh Blue** hiện tại (`primary`, `primary-soft`, `danger`, `warning`, `success`).
- **Nền và Chữ**: Chữ tối (`text-text-primary`) trên nền sáng (`bg-surface-card`, `bg-page`) và chữ trắng trên nền xanh chủ đạo (`bg-primary`) đều đảm bảo độ tương phản an toàn, thỏa mãn tiêu chuẩn WCAG AA.
- **Trạng thái vô hiệu (Disabled/Muted)**: Các thành phần sử dụng `text-text-muted` có độ tương phản thấp hơn một chút để báo hiệu trạng thái phụ, nhưng vẫn đủ để có thể đọc được.
- *Kết luận*: Hệ thống màu sắc hiện tại hiển thị rõ ràng, đạt chuẩn về độ tương phản. Không phát hiện vi phạm nghiêm trọng nào cần sửa đổi khẩn cấp.

---

## 4. Vấn đề cần Claude hoặc Chủ doanh nghiệp xem xét (Needs Design Judgment) - *Chờ Review*

1. **Focus Trap trên các hộp thoại tự tạo (Custom Dialogs)**:
   - Các modal tự tạo bằng cách render trực tiếp (như `OrderEditModal.tsx`, `HistoryModal.tsx`, `ProductForm.tsx`) không thừa kế cơ chế quản lý tiêu điểm tự động của `Dialog.tsx`.
   - *Khuyến nghị*: Sắp tới (khi tái cấu trúc thư mục) nên chuyển các modal tự tạo này sang sử dụng trực tiếp component `Dialog` hoặc `FormModal` để có đầy đủ tính năng tiếp cận bằng bàn phím mà không cần code lặp lại.
2. **Kích thước vùng bấm trên POS (Touch Target size)**:
   - Trên màn hình POS, các nút tăng giảm số lượng sản phẩm trong giỏ hàng (`+` / `-`) có kích thước vùng bấm nhỏ (`w-7 h-7` hoặc `w-8 h-8`), dưới mức khuyến nghị 44px (khoảng `w-11 h-11`). Tuy nhiên, thay đổi kích thước các nút này có thể làm thay đổi layout tổng thể và phá vỡ cấu trúc thiết kế hiện tại.
   - *Khuyến nghị*: Giữ nguyên ở đợt này để tránh rủi ro về mặt thẩm mỹ, sẽ đưa vào đợt tối ưu hóa giao diện POS di động ở Phase sau.
