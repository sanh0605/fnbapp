# Đợt 9 — phần 1b và 2 còn lại

Chủ quán 2026-10-14: *"Em cho chạy tiếp các việc còn lại trong kế hoạch, rồi anh sẽ kiểm tra
chung 1 lần."* Kế hoạch con của kế hoạch chung (`2026-10-06-ke-hoach-chung.md`), xoá khi xong.

## Hiện trạng

Đo 2026-10-14 trên nhánh `feat/no-popups` (`515b3217`).

1. **Trạng thái.** Không thêm trạng thái mới. Dòng tổng (việc 3) cộng theo trạng thái đã có
   của đơn và phiếu. Cộng trạng thái nào là câu hỏi cho chủ quán, xem việc 3.
2. **Nút.**
   - Góp ý: mỗi góp ý đã lưu thêm nút "Sửa". Bấm thì ô ghi chú mở ngay tại chỗ, có "Lưu" và
     "Bỏ"; ghi chú để trống thì không lưu được.
   - Nhân sự: nút xoá giữ nguyên. Máy chủ từ chối hai trường hợp: tự xoá chính mình, và xoá
     tài khoản chủ quán cuối cùng (lỗ hổng G4).
3. **Danh sách.** Mọi danh sách dùng `DataList` (20 màn). Dòng và thẻ trên điện thoại cùng
   một kiểu chữ, không đậm (`BR-UI-003`). Ô tóm tắt ở đầu trang (Tổng thu, Tổng chi, "N đơn
   hàng") không phải dòng nên giữ nguyên.
4. **Ô nhập.** Ô ghi chú góp ý: chữ bất kỳ, bỏ khoảng trắng hai đầu, trống thì báo và không
   lưu. Không có ô nhập nào khác.
5. **Dữ liệu.** Không ghi dữ liệu thật. Dòng tổng chỉ đọc. Góp ý ghi vào `UI-FEEDBACK.md`,
   chỉ chạy trên máy anh, không có trên bản quán dùng.

Đã xem: `components/ui/list/DataList.tsx` (có sẵn `totals`, chưa màn nào dùng),
`components/ui/template.guard.test.ts` (đã chặn `<td>` đậm, chưa chặn thẻ điện thoại),
`app/admin/users/actions.ts` `deleteUserAction`, `lib/dev-feedback/ui-feedback-store.ts`,
`app/api/dev-feedback/route.ts`, số lần dùng từng cách viết. Hai trang Lịch sử giá món và
`/admin/products/toppings` của phần 2 giờ chỉ chuyển hướng, không còn việc. Chưa xem: cách
mỗi danh sách lấy dữ liệu từ máy chủ (Sonnet đọc khi làm việc 3).

## Việc

1. **Chữ 100% tiếng Việt, một cách viết** (`BR-UI-001`), do Opus làm vì là thay chữ máy móc.
   - Đo: Huỷ/huỷ 84 lần, Hủy/hủy 19; tuỳ 27, tùy 3; hoá 28, hóa 15. Theo số đông: **huỷ,
     tuỳ, hoá, khoá**.
   - Không đụng chuỗi là dữ liệu: tên nhóm hàng lưu trong máy chủ, giá trị `value` của ô
     chọn. Không đụng máy bán hàng (phần 7).
   - "Chủ Nhật" thành "Chủ nhật". "tap để mở/đóng" thành "bấm để mở/đóng".
   - Phép kiểm canh mới chặn cách viết số ít.
2. **Dòng danh sách một kiểu** (`BR-UI-003`), Gemini: thẻ điện thoại của các danh sách bỏ chữ
   đậm. Phép kiểm canh: file dùng `DataList` không có `font-bold`/`font-semibold`, trừ phần
   tóm tắt ghi rõ.
3. **Dòng tổng dưới tiêu đề cột** (`BR-UI-004`). Máy chủ cộng theo bộ lọc (Sonnet), màn hình
   đưa vào `totals` của `DataList` (Gemini). Cột cộng được: cột tiền. Số lượng khác đơn vị
   không cộng. Danh sách có cột tiền: Đơn hàng, Phiếu nhập, Phiếu xuất, Sổ thu chi, Tài
   sản. Dòng huỷ không cộng: luật `BR-ACCESS-003` (chủ quán chốt 2026-09-08) đã nói rõ. Phiếu
   nháp cũng không cộng, vì chưa mua hay bán thật. Nhãn ghi "Tổng (không tính huỷ, nháp)".
4. **Sửa góp ý đã lưu**: Sonnet thêm cách sửa ở `ui-feedback-store.ts` và lệnh `PATCH`
   trong route; Gemini thêm nút "Sửa" trong `UiFeedbackTool.tsx`.
5. **G4, xoá nhân viên**, Sonnet: chặn tự xoá chính mình và chặn xoá chủ quán cuối cùng, lời
   báo tiếng Việt.
