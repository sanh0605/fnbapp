# Khổ trang, mật độ và tiêu đề trang

Chủ quán 2026-10-11. Luật: `BR-UI-012` (khổ trang), `BR-UI-013` (tiêu đề) trong `docs/02-rules/business-rules/screens.md`.
Mật độ (ô thấp hơn, dòng gọn hơn) chưa là luật: chủ quán nói *"Nếu cần thiết kế lại thì thiết kế cho anh xem thử. Nếu vẫn đủ màn hình thì giữ nguyên"*, nên làm bản thử trên 8386 trước, chốt rồi mới ghi luật.

## Hiện trạng

1. **Trạng thái:** không áp dụng, vì đây là khung và cỡ chữ, không có dữ liệu đổi trạng thái.
2. **Nút:** nút và ô cao 44 px trên mọi thiết bị (`components/ui/Button.tsx`, `TextInput.tsx`, `Select.tsx`, `NumberInput.tsx`). Nút xoá trên dòng danh sách cao 36 px, kéo cả dòng lên 69 px.
3. **Danh sách:** dòng cao 53–73 px đo trên 8386 ở khổ 1.440 (Đơn vị tính 69, Món 73, Phiếu nhập 55); ô đệm `px-6 py-4` (`components/ui/list/DataList.tsx`). Chữ 14 px, tiêu đề cột 13 px đậm.
4. **Ô nhập:** không đổi giá trị nhận vào; chỉ đổi chiều cao trên máy tính. Điện thoại giữ 44 px cho vừa ngón tay.
5. **Phục vụ:** mọi trang quản trị. Cố ý không đụng máy bán hàng (`app/pos/`) và điện thoại.

Đã xem: khung trang `app/admin/layout.tsx` (giới hạn 1.920), `components/ui/detail/DetailFrame.tsx` (1.280), các form giới hạn 672/896, đo 70 trang trên 8386 ở 1.920 và 46 trang ở 1.440. Chưa xem: trang in, máy bán hàng.

## Bước 1 — bản thử trên 8386 (chờ chủ quán xem)

- Khung mọi trang tối đa 1.280, căn giữa (`app/admin/layout.tsx`).
- Máy tính: ô và nút 40 px (điện thoại giữ 44); dòng danh sách khoảng 45 px, nút xoá trên dòng không kéo dòng cao thêm.
- Một mẫu form ít ô xếp hai cột: Tạo/Sửa điểm bán.

Ví dụ: danh sách Đơn vị tính, dòng "kg" hiện cao 69 px → khoảng 45 px; 20 dòng chiếm khoảng 900 px thay vì 1.380 px.

## Bước 2 — sau khi chủ quán chốt

- Mọi trang bỏ khung hẹp riêng (672, 896), dùng cả khung 1.280; form ít ô xếp cột.
- Phép kiểm canh: không trang nào trong `app/admin` tự đặt `max-w-…` cho cả trang.
- Ghi luật mật độ vào `screens.md`.

## Tiêu đề (`BR-UI-013`, đã chốt — làm ngay)

19 trang tạo mới đổi thành "Tạo …", chỉ hoa chữ đầu. Phép kiểm canh tiêu đề trang tạo mới.
