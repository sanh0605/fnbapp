# Sửa phiếu kiểm kê đã xác nhận — đặc tả và thiết kế

Ngày: 2026-10-14. Luật: `BR-INV-012` (`docs/02-rules/business-rules/stocktake.md`).
Trạng thái: **chủ quán xác nhận ví dụ 2026-10-14** (*"1a 2b 3b"*, Q4 *"a"*).

## 1. Chủ quán đã chốt

| Điểm | Chốt | Ngày |
|---|---|---|
| Thay đổi tính vào ngày nào | Đúng ngày kiểm cũ, không phải hôm nay (1b) | 2026-09-28 |
| Ai được sửa | Chỉ chủ quán (vai `ADMIN`), chặn ở máy chủ bằng `requireOwner()` (2a) | 2026-09-28 |
| Phần thiếu hiện ở đâu | Danh sách Phiếu xuất, nhãn "Kiểm kê", mở ra là phiếu kiểm kê (3a) | 2026-09-28 |
| Sửa phiếu cũ khi đã có phiếu mới hơn | Không được; chỉ sửa phiếu kiểm kê mới nhất (Q4 a) | 2026-10-14 |
| Ô lý do khi sửa | Không có (2b) | 2026-10-14 |
| Lịch sử sửa trên màn hình | Không có (3b). Thêm khi người khác thay chủ quán sửa | 2026-10-14 |

## 2. Ví dụ bằng số thật (đo 2026-10-14)

Máy chủ có đúng một phiếu kiểm kê: **STK-001**, đếm 09/08/2026, xác nhận 09/08/2026 22:02
(giờ Việt Nam), 50 dòng, trạng thái đã xác nhận. Đây là phiếu mới nhất nên sửa được.

| Dòng | Hàng | Sổ lúc đếm | Đếm | Chênh | Dòng xuất kho |
|---|---|---|---|---|---|
| SKL-00004 | Bột cà phê truyền thống Phin Đậm | 6.000 | 4.000 | thiếu 2.000 | ISS-00004, 2.000 |
| SKL-00007 | Bột milkfoam muối biển | 2.000 | 2.000 | 0 | không có |

Ba trường hợp khi chủ quán sửa:

1. **SKL-00004 sửa thành 5.000** → ISS-00004 còn 1.000, vẫn ghi ngày 09/08. Tính bằng chính máy
   tính giá vốn (`lib/costing/issue-costing.ts`) trên dữ liệu thật của Bột cà phê Phin Đậm
   (4 lần mua, 19 dòng xuất): giá vốn **tháng 8 giảm 148.017đ** (592.067 → 444.050);
   tháng 9 tăng 340đ, tháng 10 tăng 131đ vì 1.000 g còn lại đi vào giá bình quân của các
   lần mua sau. Tồn sổ hôm nay của món này tăng 1.000.
2. **SKL-00007 sửa thành 1.500** → thêm một dòng xuất mới, 500, ghi ngày 09/08, nhãn kiểm kê.
3. **SKL-00004 sửa thành 6.000** (đúng bằng sổ) → ISS-00004 bị bỏ hẳn, như thể lúc xác nhận
   dòng này không chênh. Sửa cao hơn sổ thì thành hàng dư (`BR-INV-008`), dòng xuất mang số âm.

## 3. Màn hình

Hôm nay chưa có trang nào cho xem từng dòng của phiếu đã xác nhận: trang Kiểm kê chỉ hiện
một khung tóm tắt phiếu gần nhất với nút huỷ, và dòng "Kiểm kê" trong danh sách Phiếu xuất
mở về trang Kiểm kê chung. Nên dựng thêm hai trang.

**Trang phiếu kiểm kê** `/admin/inventory/stocktake/[id]` (mọi người xem được, như hôm nay):
- Đầu trang: mã phiếu, trạng thái (Đã xác nhận / Đã huỷ), ngày kiểm, người xác nhận.
- Máy tính: bảng Hàng · Đơn vị · Sổ lúc đếm · Đếm được · Chênh lệch. Chênh lệch ghi "Thiếu 2,000 g"
  hoặc "Thừa 500 g", bằng 0 thì ghi "Khớp" (sửa 2026-10-18 cho khớp trang đang chạy).
  Điện thoại: dòng gọn hai tầng, cùng các ô đó.
- Nút **Sửa** chỉ hiện khi đủ cả bốn điều: người xem là chủ quán; phiếu đã xác nhận; là phiếu
  xác nhận mới nhất; không có phiếu kiểm kê nào đang mở. Chủ quán xem một phiếu không sửa
  được thì thấy một dòng chữ xám nói vì sao, thay cho nút.
- Phiếu đang mở thì không mở trang này mà về trang Kiểm kê (đang đếm ở đó).

**Trang sửa** `/admin/inventory/stocktake/[id]/edit` (chỉ chủ quán; người khác về trang phiếu):
- Mỗi dòng một ô số, điền sẵn số đếm hiện tại, đơn vị là đơn vị gốc của hàng (g, ml, cái…),
  không chia theo gói như lúc đếm: sửa là chữa con số, không đếm lại.
- Cạnh mỗi ô: sổ lúc đếm và chênh lệch tính lại ngay khi gõ.
- Lưu một lần cho mọi dòng đã đổi, cùng thành hoặc cùng không. Xong về trang phiếu.
- Không có ô lý do. Không có hộp hỏi lại (luật không cửa sổ bật lên `BR-DATA-007`).

**Lối vào:** trang Kiểm kê thêm liên kết "Xem phiếu" trên khung phiếu gần nhất; dòng "Kiểm kê"
trong danh sách Phiếu xuất mở thẳng trang phiếu đó.

## 4. Dữ liệu

Không thêm bảng, không thêm cột. Một hàm Postgres mới `edit_confirmed_stocktake_atomic` ghi
`stocktake_lines` và `stock_issues` trong một lần. Mỗi dòng đổi số:

- cập nhật `stocktake_lines.counted_qty`;
- chênh lệch mới = đếm − sổ lúc đếm (`theoretical_at_count` giữ nguyên, là sổ **lúc đếm**);
- phiếu đã có dòng xuất của hàng đó: chênh ≠ 0 thì sửa số tại chỗ, chênh = 0 thì bỏ dòng xuất;
- chưa có mà chênh ≠ 0: thêm dòng xuất mới, `issued_at` = giờ xác nhận phiếu.

Giá vốn không lưu sẵn ở đâu, mọi báo cáo tính lại từ `stock_issues` mỗi lần mở, nên không phải
tính lại gì thêm. Ghi lại giá trị lúc tính hay tính lại toàn bộ: **tính lại toàn bộ**, đúng ý
"thay đổi nằm ở ngày kiểm cũ".

## 5. Cố ý không làm

- Không ghi ai sửa, lúc nào (3b). Bảng `stocktake_sessions` vẫn tự cập nhật `updated_at`.
- Không sửa dòng không phải hàng mua (`item_type` khác `PURCHASED_ITEM`): 0 dòng như vậy
  trên máy chủ (đo 2026-10-14, 50/50 dòng của STK-001 là hàng mua).
- Không bắt số sửa là bội số gói (`BR-INV-007` áp cho lúc đếm ở kệ; sửa là chữa số).
- Không xoá trắng một dòng về "chưa đếm": ô bắt buộc có số.
