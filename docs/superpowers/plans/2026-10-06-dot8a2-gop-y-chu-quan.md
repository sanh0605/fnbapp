# Đợt 8a-2 — góp ý chủ quán 2026-10-06 (sửa ngay)

Nguồn: chủ quán gõ trong chat 2026-10-06 và 11 mục trong `UI-FEEDBACK.md` cùng ngày.
Mục nào cần thiết kế riêng thì vào `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md`, không làm ở đây.
Kế hoạch này xoá khi chủ quán nhận.

## Hiện trạng

1. **Trạng thái.** Không thêm trạng thái nào. Phiếu nhập vẫn Nháp / Hoàn tất / Đã huỷ; phiếu xuất vẫn suy ra từ các dòng.
2. **Nút.**
   - Mũi tên quay về (`components/ui/BackLink.tsx`) gọi "lùi một trang" của trình duyệt khi có lịch sử (thêm 2026-09-30 để giữ bộ lọc danh sách). Trang chi tiết phiếu nhập dùng nó, nên đi chi tiết → huỷ → "Quay lại" → mũi tên thì lại về trang huỷ: kẹt vòng (chủ quán bắt được 2026-10-06). `DetailHeader` thì dùng liên kết thường, mất bộ lọc.
   - Nút mở trang tạo mới trên các danh sách mang tên dài ("Tạo phiếu nhập", …).
3. **Danh sách.** Trang tạo phiếu xuất có cột Mặt hàng · Tồn hiện tại · Đơn vị · Số lượng · Quy ra, chưa có giá trị. Trang sửa phiếu xuất đã có cột "Giá trị" (đơn giá ở thời điểm của phiếu × số lượng gốc, `computeUnitCostsAt`, cùng bộ máy với báo cáo Hàng đã xuất).
4. **Ô nhập.**
   - Phiếu nhập, ô "Thành tiền (đ)" là ô nhập nhưng tô nền xanh, ô "Đơn giá" (tự tính, không nhập) cũng có nền: chủ quán thấy dễ tưởng không cần nhập.
   - Khung tổng tiền nền `bg-surface-secondary`, chữ khó đọc.
   - Khối "Trả bằng" nằm trên đầu form, trước các dòng hàng.
5. **Phục vụ / không phục vụ.** Đợt này chỉ đổi cách hiện và đường đi giữa trang. Không đổi cách ghi phiếu, cách tính giá vốn, hay dữ liệu. Không làm thanh toán nhiều hình thức (cần thiết kế, ở kế hoạch chung).

Câu hỏi riêng của việc này:

6. **Giá trị xuất khi chưa có giá?** Mặt hàng chưa từng nhập trước thời điểm xuất thì không có đơn giá → hiện "—", tổng cộng các dòng có giá và ghi "chưa tính N dòng chưa có giá". Không chặn ghi phiếu (luật giá vốn không đổi).
7. **Đổi thời điểm xuất thì sao?** Đơn giá tính lại ở thời điểm mới (phiếu ghi lùi ngày dùng giá ngày đó). Xuất kho không làm đổi giá bình quân, nên các dòng trong cùng phiếu không ảnh hưởng nhau.
8. **Quay lại giữ bộ lọc mà không lùi lịch sử thế nào?** Nhớ địa chỉ đầy đủ (kèm bộ lọc, trang, sắp xếp) của mỗi trang danh sách vừa mở, trong bộ nhớ phiên của trình duyệt; mũi tên đi tới địa chỉ đã nhớ, chưa nhớ thì đi tới địa chỉ gốc. Không bao giờ "lùi một trang", nên không còn vòng lặp ở bất kỳ trang nào.

Đã xem: `BackLink.tsx`, `DetailHeader.tsx`, `PurchaseOrderForm.tsx` (dòng 380–700), `CancelPurchaseOrderForm.tsx`, `IssueSlipClient.tsx`, `issue-slips/actions.ts` (`getIssueSlipDetail`, `getIssueSlipFormData`). Chưa xem: từng trang dùng `BackLink` (17 trang) ngoài phiếu nhập — Gemini đổi chung một chỗ, không sửa từng trang.

## Việc

| # | Ai | Việc |
|---|---|---|
| 1 | Sonnet | `getIssueUnitCostsAt(issuedAtIso: string): Promise<{ unitCostByItem: Record<string, number> } \| { error: string }>` trong `app/admin/inventory/issue-slips/actions.ts`: `requireAdmin`, ngày sai → `{ error }`, trả đơn giá gốc ở thời điểm đó cho mọi mặt hàng `getIssueSlipFormData` đưa ra, dùng `computeUnitCostsAt` như `getIssueSlipDetail`. Test đỏ trước. Báo một ví dụ số thật (tên mặt hàng, đơn giá hôm nay) đo bằng script đọc trong thư mục tạm. |
| 2 | Gemini | Mũi tên quay về: nhớ địa chỉ danh sách, không lùi lịch sử; `DetailHeader` dùng chung cách này. |
| 3 | Gemini | Tạo phiếu xuất: cột "Giá trị xuất" (máy tính) và dòng "Giá trị xuất" trong thẻ (điện thoại), dòng tổng "Tổng giá trị xuất". |
| 4 | Gemini | Phiếu nhập: ô "Thành tiền" nhìn như mọi ô nhập khác; "Đơn giá" là chữ tự tính, không khung; khung tổng tiền giống khung "Thông tin thanh toán" ở trang chi tiết (`bg-surface-card`); khối "Trả bằng" dời xuống dưới khung tổng tiền và đổi tên "Hình thức thanh toán" ở mọi chỗ hiện (form, danh sách, chi tiết, trang huỷ). |
| 5 | Gemini | Chữ: bỏ mọi phần tiếng Anh trong ngoặc ("Lưu Nháp (Draft)" → "Lưu nháp", "Quản lý (MANAGER)" → "Quản lý", …, 25 chỗ đếm 2026-10-06); nút mở trang tạo mới trên mọi danh sách ghi đúng "Tạo". |
| 6 | Opus | Soát, chạy năm bước kiểm, sửa tài liệu luồng, ghi luật. |
