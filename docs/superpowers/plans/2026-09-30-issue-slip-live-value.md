# Phiếu xuất: hiện giá trị ngay khi sửa; nút quay lại các trang theo kiểu Phiếu xuất

Nguồn: chủ quán 2026-09-30, sau bản 67c275e:
- *"Tại sao không hiển thị giá trị luôn mà lại phải ghi là 'Tính khi lưu'"*
- Nút quay lại *"chỉ đơn thuần là '<-' và text… Không thấy có giống với button?"*

Đã xem: `lib/costing/issue-line-values.ts` (`computeIssueLineValues`), `app/admin/inventory/issue-slips/actions.ts` (`getIssueSlipDetail`), `components/ui/BackLink.tsx`, `docs/02-rules/business-rules/cogs.md` dòng 7 và 21 (giá bình quân gia quyền tại lúc xuất). Chưa xem: phần thân của `computeIssueLineValues`, để Sonnet đọc.

## Hiện trạng

1. **Trạng thái.** Có hai chế độ: xem và sửa. Ở chế độ sửa, mỗi dòng mang một trong các nhãn: chưa đổi, đã đổi số lượng, mới, bị xoá.
2. **Nút.** Phiếu xuất dùng `BackLink` kiểu chữ "← Phiếu xuất", và đó là mẫu. Phiếu nhập chi tiết và Phiếu nhập tạo mới dùng `BackLink` nhưng mang `className` dạng nút, chữ "Quay lại". Sửa nhân sự dùng đường dẫn "Nhân sự". Cách bấm giữ nguyên (R6).
3. **Danh sách.** Cột Giá trị ở chế độ sửa:
   - Dòng chưa đổi hiện giá trị cũ.
   - Dòng đã đổi, dòng mới, dòng bị xoá hiện "Tính khi lưu".
   - Dòng tổng giữ nguyên số cũ.
4. **Ô nhập.** Không đổi.
5. **Dữ liệu.** Chỉ đọc. Giá trị hiện ra là số xem trước; máy chủ vẫn tự tính khi lưu (`BR-COGS-005`) và không đọc số của trình duyệt.

## Vì sao tính trước được

- Giá xuất bằng số lượng × giá bình quân của mặt hàng tại thời điểm xuất (`cogs.md` dòng 21).
- Xuất hàng không làm đổi giá bình quân. Chỉ nhập hàng mới làm đổi nó.
- Đổi số lượng ghi dòng mới đúng giờ của phiếu (`BR-INV-013`), và dòng thêm mới cũng lấy giờ của phiếu.
- Nên giá bình quân cần dùng là giá **tại giờ của phiếu**, và nó không phụ thuộc số lượng đang gõ.

Ví dụ kiểm tra: ISL-00076 có dòng 2000 ml Sữa yến mạch Oatside. Sonnet đo giá trị dòng đó và giá bình quân lúc 28/09 18:20. Hai số phải thoả: giá trị = 2000 × giá bình quân (làm tròn khi hiện). Khi đổi sang 1000 ml, dòng đó hiện 1000 × giá bình quân.

## Việc

- [ ] **Sonnet (backend):**
  - `getIssueSlipDetail` trả thêm `unitCostByItem: Record<string, number>`. Đây là giá bình quân chính xác (không làm tròn) trên một đơn vị gốc, tại `slip.issued_at`, cho mọi mặt hàng có thể xuất. Dòng thêm mới cũng cần giá này.
  - Tính bằng cùng bộ máy giá vốn đang dùng (`lib/costing/`), không viết lại công thức.
  - Mặt hàng chưa có lần nhập nào trước giờ đó: không có khoá (không đưa số 0).
  - Test: một mặt hàng có hai lần nhập trước giờ phiếu và một lần sau. Giá bình quân chỉ tính hai lần trước. Test phải đỏ trước khi sửa.
  - Đo trên dữ liệu thật: dòng Oatside của ISL-00076, giá trị dòng so với 2000 × giá bình quân. Ghi số vào báo cáo.
- [ ] **Gemini (UI):**
  - Ở chế độ sửa, cột Giá trị = `unitCostByItem[item] × baseQuantity`, hiện `formatNumber(Math.round(...))` + "đ".
  - Mặt hàng không có giá thì hiện "—".
  - Dòng bị xoá gạch ngang giá trị cũ, và không cộng vào tổng.
  - Dòng tổng cộng lại theo bản nháp.
  - Làm cả bảng trên máy tính lẫn thẻ trên điện thoại.
  - Nút quay lại (chủ quán sửa lại ý 2026-09-30: *"anh muốn các trang khác có nút quay lại giống như hình anh gửi"*, tức kiểu chữ "← Phiếu xuất" đặt trên tiêu đề của trang Phiếu xuất; `BackLink` giữ nguyên kiểu mặc định):
    - Phiếu nhập chi tiết và Phiếu nhập tạo mới: bỏ `className` dạng nút và bỏ chữ "Quay lại". Dùng `<BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />` đặt trên tiêu đề, bố cục giống `app/admin/inventory/issue-slips/new/page.tsx`.
    - Sửa nhân sự (`app/admin/users/edit/[id]/page.tsx`): thay đường dẫn "Nhân sự" bằng `<BackLink href="/admin/users" label="Nhân sự" />`.
- [ ] **Opus:** chạy đủ năm lệnh kiểm, soát, commit.
