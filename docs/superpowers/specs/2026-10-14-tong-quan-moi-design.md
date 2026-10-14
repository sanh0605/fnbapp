# Tổng quan mới — đặc tả và thiết kế

Phần 3 của kế hoạch chung (bước D của bản cải tổ). Nội dung chủ quán đã chốt ở
`docs/superpowers/specs/2026-09-28-cai-to-he-thong.md` mục 5.7–5.11. File này gom lại các ý đó
thành một bản dựng được và thêm phần máy cần biết để dựng.

Trạng thái: **chủ quán xác nhận ví dụ 2026-10-14** (mục 5).

## 1. Đã chốt (trích bản cải tổ)

- Báo động: máy bán hàng gửi đơn lỗi (đang có); hàng trên sổ bị âm (`BR-INV-004`); lâu chưa
  kiểm kê, mặc định 30 ngày; phiếu kiểm kê mở dở quá 2 ngày; nhắc nhập khoản chi hằng tháng.
- Không báo giá nhập tăng mạnh, không báo hàng sắp hết.
- Bảng 7 ngày, mỗi ngày một dòng: doanh thu, giá trị trung bình mỗi ly, số ly, và một cột
  cho mỗi món đồ ăn chủ quán chọn (mặc định Trứng luộc, Khoai lang). Bỏ biểu đồ và 5 món bán
  chạy.
- **Ly** là mọi món thuộc nhóm món có loại "là thức uống".
- **Giá trị trung bình mỗi ly** = (tiền các ly + topping gọi kèm trên chính ly đó) ÷ số ly.
  Topping bán thành món riêng (Hộp sữa chua) không tính.
- **Loại món**: chủ quán tự thêm, sửa, xoá. Mỗi loại có tên và ô "là thức uống (tính là ly)".
  Mặc định có Thức uống (đánh dấu), Thức ăn, Topping. Mỗi nhóm món chọn một loại. Xoá loại
  đang có nhóm dùng thì máy từ chối và nói nhóm nào đang dùng.
- **Khoản chi hằng tháng**: chủ quán tự thêm, sửa, xoá. Lời nhắc cho tháng M hiện từ ngày 25
  của tháng M. Chủ quán tự chọn ngày nhập, miễn nằm trong tháng M; có một dòng như vậy thì
  hết nhắc. Qua hết tháng mà chưa nhập thì vẫn nhắc, ghi rõ tháng nào.
- Chỉnh ở **Cài đặt → Tổng quan**: số ngày "lâu chưa kiểm kê" (30), số ngày "phiếu mở dở"
  (2), ngày bắt đầu nhắc (25), các món làm cột đồ ăn (Trứng luộc, Khoai lang). Loại món đặt
  ở Bán hàng, cạnh Nhóm món. Khoản chi hằng tháng đặt ở Thu chi.

## 2. Đo trên dữ liệu thật, 2026-10-14 (chỉ đọc)

- Nhóm món: Cà phê, Giải trí, Trà, Yogurt, Thức ăn, Topping đang dùng; Cacao đã xoá.
- Topping gọi kèm nằm trong dòng của ly (`order_lines_v2.modifiers_snapshot_json`), và tiền
  của nó đã nằm trong `net_line_total` của dòng đó. Ví dụ: Cacao latte 23.000đ + Kem muối
  4.000đ thì dòng ghi 27.000đ. Topping bán riêng là một dòng riêng thuộc nhóm Topping. Câu
  "chưa kiểm" ở mục 5.8 của bản cải tổ đã trả lời: cộng `net_line_total` của các dòng ly là
  đủ, không cần tách topping.
- Tiền tính theo `net_line_total`, tức tiền khách trả sau giảm giá, của đơn `COMPLETED`.
  Đơn huỷ và bản cũ của đơn đã sửa không tính.

## 3. Ví dụ bằng số thật

Bảng 7 ngày nếu dựng hôm nay, tính bằng JavaScript trên đơn thật:

| Ngày | Doanh thu | TB mỗi ly | Số ly | Trứng luộc | Khoai lang |
|---|---|---|---|---|---|
| 08/10 | 714.000 | 20.889 | 27 | 22 | 12 |
| 09/10 | 838.000 | 21.344 | 32 | 25 | 14 |
| 10/10 | 480.000 | 20.000 | 19 | 19 | 9 |
| 11/10 | 30.000 | 15.000 | 2 | 0 | 0 |
| 12/10 | 873.000 | 20.848 | 33 | 25 | 18 |
| 13/10 | 526.000 | 21.235 | 17 | 22 | 11 |
| 14/10 | (đang bán) | | | | |

Cách ra một ô: 08/10 có 27 ly, tiền các dòng ly (đã gồm topping gọi kèm) là 564.000đ, nên
564.000 ÷ 27 = 20.888,9 → 20.889đ.

Nhắc chi phí, ví dụ: chủ quán lập khoản "Tiền điện" ngày 14/10. Từ 25/10 Tổng quan hiện
"Chưa nhập Tiền điện tháng 10/2026". Chủ quán nhập một dòng Tiền điện ngày 31/10 thì lời
nhắc tắt. Nếu sang 03/11 vẫn chưa nhập, lời nhắc vẫn hiện và vẫn ghi "tháng 10/2026".

## 4. Hiện trạng (năm câu)

1. **Trạng thái.**
   - Loại món: đang dùng hoặc đã xoá. Xoá chỉ được khi không còn nhóm nào dùng.
   - Khoản chi hằng tháng: đang dùng hoặc ngừng. Khoản đã có dòng trong sổ thì chỉ được
     ngừng, chưa có dòng nào thì xoá hẳn được.
   - Một lời nhắc tháng M bật khi: khoản đang dùng, đã tới ngày bắt đầu nhắc của tháng M,
     tháng M không sớm hơn tháng lập khoản, và tháng M chưa có dòng sổ thu chi nào (không
     tính dòng huỷ) gắn với khoản đó. Nó tắt khi có dòng như vậy.
2. **Nút.**
   - Tổng quan: mỗi lời nhắc có nút "Nhập", mở trang tạo dòng sổ thu chi đã điền sẵn khoản
     và nhóm thu chi của khoản. Báo động hàng âm mở Hàng hoá. Báo động kiểm kê mở Kiểm kê.
   - Loại món, Khoản chi hằng tháng: Tạo, Sửa, Xoá theo khuôn danh sách. Khoản đã có dòng
     sổ thì nút là "Ngừng dùng".
   - Cài đặt → Tổng quan: một nút Lưu.
3. **Danh sách.**
   - Bảng 7 ngày: 7 ngày gần nhất tính tới hôm nay, giờ Sài Gòn. Ngày không bán vẫn có
     dòng, ghi số 0.
   - Lời nhắc: mọi tháng còn thiếu của mọi khoản đang dùng, tháng cũ ở trên.
   - Báo động hàng âm: mặt hàng có tồn trên sổ nhỏ hơn 0, dùng chung công thức tồn
     `computeOnHandByPurchasedItem()`.
4. **Ô nhập.**
   - Số ngày lâu chưa kiểm kê và số ngày phiếu mở dở: số nguyên 1–365.
   - Ngày bắt đầu nhắc: 1–28, vì tháng Hai chỉ có 28 ngày.
   - Cột đồ ăn: chọn nhiều món đang bán, có thể để trống (bảng không có cột đồ ăn).
   - Tên loại món và tên khoản chi: bắt buộc, không trùng tên khác đang dùng.
   - Nhóm thu chi của khoản: bắt buộc, chỉ chọn nhóm bên Chi.
5. **Dữ liệu.** Có bảng mới, nên phải chạy migration. Chủ quán duyệt riêng việc này, tách
   khỏi việc đẩy code.
   - `product_types` (id, name, is_drink, status) và cột `product_categories.type_id`, khoá
     ngoại `RESTRICT`. Gán sẵn: Cà phê, Giải trí, Trà, Yogurt, Cacao → Thức uống; Thức ăn →
     Thức ăn; Topping → Topping.
   - `monthly_expense_items` (id, name, cash_category_id, status, created_at) và cột
     `cash_entries.monthly_item_id`, có thể trống, khoá ngoại `RESTRICT`.
   - `dashboard_settings`: một dòng gồm stale_stocktake_days, open_stocktake_days,
     reminder_start_day, food_product_ids.
   - Bảng 7 ngày tính lại mỗi lần mở trang. Đổi loại của nhóm món thì cả 7 ngày tính lại theo
     loại mới; không ghi lại loại cũ lúc bán.
   - Cố ý không phục vụ: báo giá nhập tăng, báo sắp hết hàng, gắn loại cho từng món.

## 5. Chủ quán trả lời ví dụ, 2026-10-14

- **Ví dụ bảng 7 ngày đúng**, thêm: *"nếu có topping mua riêng thì có thêm 1 cột riêng"*.
  Topping mua riêng là món thuộc loại Topping bán thành một dòng riêng, ví dụ Hộp sữa chua,
  Kem muối. Đo 2026-10-14: từ trước tới nay chỉ có 2 lần bán (14/07: 1 phần 6.000đ; 24/07:
  1 phần 10.000đ), 7 ngày trong ví dụ đều là 0. Cột "Topping mua riêng" ghi **số phần**, cộng
  mọi món thuộc loại Topping, như cột Trứng luộc (chủ quán chốt 2026-10-14, *"a"*).
- **Bỏ các ô số đầu trang**, kèm bộ lọc thời gian và so với kỳ trước (dựng 2026-10-09, chưa
  đẩy). Chủ quán: *"Mấy ô số đó anh thấy khá vô nghĩa nên làm gì khác cho nó có nghĩa hơn,
  nếu chưa thì ưu tiên làm trước các cảnh báo, báo động"*. Báo động lên đầu trang, rồi tới
  bảng 7 ngày. Thứ có nghĩa hơn để thay vào chỗ đó: đề xuất sau, khi báo động đã dựng xong.
  Luật đi kèm: `BR-UI-007`.

## 6. Đề xuất cho chỗ đầu trang (Opus, 2026-10-14, chờ chủ quán chọn)

Chủ quán hỏi: *"em có đề xuất gì sẽ hiện thêm trên trang tổng quan không ?"*. Đo trên dữ liệu
thật ngày 2026-10-14, chỉ đọc:

1. **Tiền đang có**: két và từng tài khoản, tính tới hôm nay, cùng cách tính ô "Cuối kỳ" của
   Sổ thu chi (`summariseCashBook`). Hôm nay: ACB 31.199.578đ; két **−4.008.751đ**.
2. **Báo động tiền mặt trên sổ bị âm**, cùng kiểu báo động hàng âm. Két không thể âm thật;
   âm nghĩa là có khoản chi bằng tiền mặt mà tiền vào két chưa được ghi (ví dụ chủ quán bỏ
   tiền túi mua hàng). Hôm nay báo động này sẽ bật.
3. **Giờ đông khách**, số ly theo giờ trong 30 ngày (14/09–13/10, 745 đơn): 6 giờ 195 ly,
   7 giờ 192, 8 giờ 133, 9 giờ 59; buổi tối 17–22 giờ cộng 132 ly; 10–16 giờ gần như không
   có. Dùng để xếp ca.
4. **Món lâu không bán**: món đang bán mà 30 ngày không ai gọi. Hôm nay 8 món: Cà phê kem
   dẻo, Yogurt đào, Yogurt xoài, Hồng trà chanh, Cacao oatside caramel kem muối, Matcha
   oatside kem muối, Matcha oatside caramel kem muối (ba món oatside chưa bán lần nào), và
   "Test11" (đang bật bán).

Đã loại: ô "đã đủ bù chi phí tháng này chưa". Giá vốn hiện ghi theo đợt kiểm kê và phiếu
nhập, không theo từng ly bán ra (tháng 8 ghi 46.418.990đ, tháng 7 ghi 48.600đ), nên ô này
sẽ nhảy lung tung và báo sai.
