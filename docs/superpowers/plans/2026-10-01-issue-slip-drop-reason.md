# Phiếu xuất: bỏ ô Lý do và ô Chi tiết

Nguồn: chủ quán 2026-10-01: *"Anh không cần lý do xuất nữa."*. Câu hỏi giữ ô Chi tiết thành "Ghi chú" thì chủ quán chọn *"B"* (bỏ luôn). Luật: `BR-INV-014`.

Đã xem:
- `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx` (REASONS, ô Lý do, ô Chi tiết, chỗ ghép `note`).
- `IssueSlipDetailClient.tsx` dòng hiện "Lý do: …".
- `createIssueSlip` trong `actions.ts`: không bắt `note` khác rỗng.
- `create_issue_slip_atomic` trong migration `0106`: `coalesce(p_note, '')`, cột `note text not null default ''`.
- Các test `IssueSlipClient.test.tsx` có nhắc lý do / Chi tiết.

Chưa xem: trang tạo phiếu trên điện thoại sau khi bỏ hai ô. Gemini tự xem bằng mắt.

## Hiện trạng

1. **Trạng thái.** Không áp dụng, vì việc này không thêm hay đổi trạng thái nào của phiếu.
2. **Nút.** Không đổi nút nào. Nút "Ghi phiếu xuất (n dòng)" giữ nguyên.
3. **Danh sách.**
   - Màn tạo phiếu bỏ ô chọn Lý do (Hao hụt / hư hỏng, Dùng nội bộ, Khác) và ô Chi tiết.
   - Trang chi tiết chỉ hiện "Lý do: …" khi phiếu có ghi chú. Phiếu cũ còn chữ nên vẫn hiện; phiếu mới không có chữ nên không hiện dòng này.
   - Danh sách phiếu không đổi, vì danh sách chưa bao giờ có cột lý do.
4. **Ô nhập.** Không còn ô nào cho lý do. Phiếu mới gửi `note: ""`. Lý do huỷ phiếu vẫn bắt buộc (`BR-INV-013`), không đụng tới.
5. **Dữ liệu.**
   - Không sửa dữ liệu cũ: 83 phiếu, gồm 77 phiếu "Khác" và 6 phiếu "Hao hụt / hư hỏng", đo ngày 2026-10-01.
   - Không đổi máy chủ, không có migration.
   - Báo cáo lãi lỗ không đổi số nào: mọi phiếu xuất vẫn tính vào Giá vốn (`BR-COGS-007`).

Thêm:
- Ảnh hưởng chéo:
  - `IssueSlipResult.note` vẫn còn trong kết quả máy chủ trả về. Không gỡ, vì dữ liệu cũ vẫn có.
  - Ghi chú của dòng trên sổ kho (`stock_transactions.notes`) với phiếu mới chỉ còn mã phiếu, không còn " -- Khác".

## Việc

- [ ] **Gemini (UI)**, chỉ trong `app/admin/inventory/issue-slips/components/`:
  - `IssueSlipClient.tsx`:
    - Xoá `REASONS`, state `reason` và state `detail`.
    - Xoá khối ô "Lý do" và khối ô "Chi tiết (không bắt buộc)".
    - Gửi `note: ""`.
  - `IssueSlipDetailClient.tsx`: dòng `Lý do: …` chỉ hiện khi `detail.note?.trim()` khác rỗng; không hiện "—".
  - Test, viết trước và phải chạy đỏ trên bản cũ:
    - `IssueSlipClient.test.tsx`:
      - Ngoài các dòng mặt hàng, màn không còn ô chọn nào (đổi test D9 "one reason select" thành 0).
      - Không còn chữ "Lý do" và chữ "Chi tiết".
      - Bấm ghi thì `createIssueSlip` được gọi với `note: ""`.
      - Bỏ test D10 "Chi tiết is a single-line text input", vì ô đó không còn.
    - `IssueSlipDetailClient.test.tsx`:
      - Phiếu có note "Khác" thì hiện "Lý do: Khác".
      - Phiếu có note "" thì không có chữ "Lý do:".
      - Phiếu đã huỷ vẫn hiện "Lý do huỷ:".
- [ ] **Opus soát lại**: chạy đủ năm lệnh, mở trang tạo phiếu trên máy tính và điện thoại.
