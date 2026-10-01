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

## Phần 2: xoá lý do trên phiếu cũ (chủ quán 2026-10-01)

Chủ quán: *"Các phiếu cũ thực ra đều xuất để pha chế nhưng làm vội nên chưa tối ưu lại, em cho thay đổi lại hết lí do hoặc xoá hết nhé, tránh nhầm lần."* Chọn xoá, vì phiếu mới cũng không có ghi chú.

Đo 2026-10-01 (truy vấn chỉ đọc):
- `issue_slips`: 83 dòng; `note` = "Khác" 77 dòng, "Hao hụt / hư hỏng" 6 dòng.
- `stock_issues` có `source = 'MANUAL'` và `reverses_issue_id` rỗng: 155 dòng; note "Khác" 149 dòng, "Hao hụt / hư hỏng" 6 dòng.
- 4 dòng trả hàng (`reverses_issue_id` khác rỗng), ví dụ "Đảo phiếu ISS-00120 (ghi nhầm) -- Huỷ cả phiếu ISL-00042 -- ". **Không đụng**: `parseCancelReason` đọc lý do huỷ từ đây.
- Không có trigger trên `issue_slips`, `stock_issues`; bảng `stock_transactions` không còn.

Chỗ đọc `note` và việc sẽ đổi:
- `lib/stock/issue-slip-list.ts`: nhãn "Phiếu xuất · Khác" thành "Phiếu xuất". Không cần sửa code.
- `lib/stock/issue-slip-detail.ts`: dòng "Lý do:" biến mất (phần 1 đã làm). Không cần sửa code.
- `lib/stock/issue-slip-status.ts`: chỉ đọc note của dòng trả hàng, mà những dòng này không bị đụng.
- `lib/reports/issued-value-report.ts` dòng 96: thẻ "Theo lần xuất" lấy note làm tiêu đề. Sau khi xoá, mọi thẻ sẽ ghi "Không có ghi chú", nên phải sửa.
- Không phép tính giá vốn hay tồn kho nào đọc `note`. Số trong báo cáo không đổi.

- [ ] **Sonnet (backend):**
  - Viết `scripts/clear-issue-slip-notes.ts`:
    - Mặc định chạy thử: in số dòng sẽ sửa của từng bảng và 5 mã đầu.
    - `--apply` mới ghi:
      - `issue_slips.note` thành `''` khi note khác rỗng.
      - `stock_issues.note` thành `''` khi `source='MANUAL'`, `reverses_issue_id is null` và note thuộc ("Khác", "Hao hụt / hư hỏng").
    - Ghi xong đọc lại: 0 dòng còn chữ trên tổng số dòng, và 4 dòng trả hàng giữ nguyên note.
    - Lõi lọc dòng tách thành hàm thuần có test.
  - `computeIssuedEventFigures`: thẻ phiếu xuất lấy tiêu đề theo tên mặt hàng, không theo note. Ví dụ: "Sữa tươi Mlekovita, Trứng gà và 3 mặt hàng khác". Nhiều nhất 2 tên, theo thứ tự dòng, trùng tên thì gộp làm một. Không còn chữ "Không có ghi chú". Tên lấy từ nơi trang `app/admin/reports/issued/page.tsx` đang có, hoặc truyền thêm một map tên. Test phải đỏ trước khi sửa.
- [ ] **Opus:** chạy thử script, soát, rồi chạy `--apply` (chủ quán đã yêu cầu sửa dữ liệu trong câu trên).
