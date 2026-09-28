# Cải tổ toàn bộ phần mềm quán — biên bản phỏng vấn và phương án

File sống. Mọi điều chủ quán chốt được ghi vào đây **trước**, rồi mới đối chiếu
với code và đề xuất. Không dựa vào trí nhớ của phiên nào. Mỗi lần đổi, sửa đúng
mục, ghi ngày.

Trạng thái: **đang phỏng vấn** (vòng 1, bắt đầu 2026-09-28). Chưa có thiết kế
được duyệt, chưa code gì cho việc này.

## 1. Chủ quán muốn gì — lời anh, 2026-09-28

> "Bản chất hệ thống này chỉ đơn giản là nhập, xuất và theo dõi chi phí rồi báo
> cáo, nhưng sau nhiều lần chỉnh sửa thì hệ thống vẫn chưa chỉn chu."

> "Code, cấu trúc thư mục, database và giao diện đang rất rời rạc và kém chuyên
> nghiệp."

Năm việc anh nêu:

1. Cách sắp xếp file.
2. Tối giản code mà vẫn giữ logic.
3. Giao diện dễ dùng, dễ tra, cùng một khuôn. Trang lập phiếu nào cũng xem được
   phiếu cũ, mới nhất ở trên, mỗi trang tối đa 20 phiếu. Lấy trang phiếu nhập
   hàng làm chuẩn.
4. Font chữ đồng nhất.
5. Có bản thiết kế để anh nhìn trước hệ thống nên trông thế nào.

**Thước đo xong (Opus hiểu, chờ anh sửa):** anh mở bất kỳ trang nào cũng đoán
được nút ở đâu, danh sách xếp thế nào, vì mọi trang cùng khuôn; và mỗi con số
trên báo cáo lần ngược được về phiếu nhập, phiếu xuất, kiểm kê hoặc đơn bán
đã tạo ra nó.

## 2. Cách làm

- Mỗi lượt một vấn đề, tối đa ba câu, có khuyến nghị.
- Chia thành các phần làm riêng, mỗi phần: phỏng vấn → thiết kế → kế hoạch →
  làm. Phần nào duyệt xong mới làm phần đó.
- Giao diện: Gemini (qua `agy`) làm. Phần xử lý phía sau: Sonnet. Opus viết
  file này, thiết kế, kế hoạch, soát lại.
- Kế hoạch tổng: Opus mức High. Kế hoạch từng trang, việc thường: mức Medium.

## 3. Đã chốt

| Ngày | Điều đã chốt | Ghi ở |
|---|---|---|
| 2026-09-28 | Không giữ bản sao lưu 44 bảng trước khi gỡ 10 bảng bỏ hoang: "khi tạo lại bảng thì cũng đã thay đổi logic" | file này |
| 2026-09-28 | Sửa phiếu kiểm kê đã xác nhận: ghi vào đúng ngày kiểm cũ (1b), chỉ chủ quán sửa (2a), phần thiếu hiện trong danh sách phiếu xuất kho có nhãn "Kiểm kê" (3a) | `BR-INV-012`, `docs/02-rules/business-rules/inventory.md` |

## 4. Hiện trạng đo được (2026-09-28)

### 4.1 Menu đang có — 8 nhóm, 28 mục

| Nhóm hiện nay | Mục |
|---|---|
| Tổng quan | Tổng quan (doanh thu 7 ngày, top 5 bán chạy, cảnh báo đơn máy bán hàng gửi lỗi) |
| Danh mục | Thương hiệu, Điểm bán, Nhà cung cấp, Phân loại hàng, Hàng mua vào, Bảng quy đổi, Đơn vị |
| Nhập hàng & Tồn kho | Đơn nhập hàng, Kiểm kê định kỳ, Phiếu xuất kho, Sổ tài sản, Bảng thời hạn khấu hao |
| Menu bán hàng | Nhóm món, Danh sách món, Topping & tuỳ chọn |
| Bán hàng | Đơn hàng, Khuyến mãi |
| Sổ thu chi | Sổ thu chi, Nhóm thu chi, Tài khoản ngân hàng |
| Báo cáo | Tổng kết ngày, Báo cáo bán hàng, Giá trị hàng đã xuất, Báo cáo tài chính |
| Hệ thống | Nhân sự & phân quyền, Nhật ký hoạt động, Xoá cache |

### 4.2 Những chỗ lệch thấy khi đo

- **Không có màn hình tồn kho.** Trang tồn kho cũ đã bị gỡ; ghi chú trong
  `app/admin/layout.tsx` còn nói nó "vẫn nằm trên đĩa" — sai, thư mục không còn.
- **Trang phiếu nhập hàng chưa chia trang**: tải hết mọi phiếu một lần. Muốn làm
  chuẩn thì chính nó phải sửa trước.
- **Phiếu xuất kho** chỉ tải 100 dòng mới nhất, không chia trang.
- **Kiểm kê** chỉ xem được phiếu xác nhận gần nhất, không có danh sách, không có
  chi tiết.
- **Chưa có báo cáo lưu chuyển tiền tệ.**
- Trang "Đơn máy bán hàng gửi lỗi" có mà không nằm trong menu; chỉ vào được từ
  cảnh báo ở trang Tổng quan.

Đã xem: menu (`app/admin/layout.tsx`), danh sách trang trong `app/admin/`, trang
Tổng quan, kiểm kê, phiếu xuất kho, phiếu nhập hàng. Chưa xem: từng trang báo
cáo, máy bán hàng (`app/pos/`), font và màu hiện dùng, cấu trúc `lib/`.

## 5. Đề xuất gom nhóm — nháp của Opus, chờ anh duyệt

Sáu nhóm anh đưa ra, xếp đủ 28 mục hiện có vào đó:

| Nhóm | Gồm | Ghi chú |
|---|---|---|
| Trang chủ | Các cảnh báo cần xử lý | Cảnh báo gì: chưa hỏi (câu hỏi Q2) |
| Sản phẩm | Món (nước, đồ ăn), Nhóm món, Topping, Tuỳ chọn (đá, ngọt), Khuyến mãi | Khuyến mãi gắn với món nên để đây |
| Vận hành | Thương hiệu, Điểm bán, Đơn hàng, Sổ thu chi | Đơn hàng và Sổ thu chi chưa có chỗ trong 6 nhóm anh nêu |
| Kho | Đơn nhập hàng, Phiếu xuất kho, Kiểm kê, Tồn kho (làm mới), Hàng mua vào, Nhà cung cấp, Tài sản | Tồn kho hiện không có màn hình |
| Báo cáo | Tổng kết ngày, Bán hàng, Giá trị hàng đã xuất, Tài chính, Lưu chuyển tiền tệ (làm mới) | |
| Cấu hình | Nhân sự & phân quyền, Đơn vị, Phân loại hàng, Bảng quy đổi, Nhóm thu chi, Tài khoản ngân hàng, Bảng khấu hao, Nhật ký hoạt động | "Xoá cache" là nút kỹ thuật, đề xuất bỏ khỏi menu |

**Anh chưa nhắc tới, cần anh xếp:** Đơn hàng (xem, sửa, huỷ đơn đã bán), Khuyến
mãi, Sổ thu chi (tiền ra vào ngoài bán và mua), Tài sản và khấu hao, Nhà cung
cấp, Nhân sự & phân quyền, Nhật ký hoạt động.

## 6. Chia phần làm — nháp, chờ anh duyệt thứ tự

| # | Phần | Vì sao đứng ở vị trí này |
|---|---|---|
| A | Gom menu 6 nhóm (mục 5) | Rẻ, thấy ngay, không đổi dữ liệu |
| B | Khuôn trang chung: font, trang "lập phiếu + danh sách phiếu cũ" (mới nhất trên cùng, 20 phiếu một trang), trang chi tiết phiếu. Bản mẫu cho anh bấm thử trước | Mọi trang sau dựng theo khuôn này; làm sau nó thì không phải làm lại |
| C | Áp khuôn B vào các trang phiếu: nhập hàng, xuất kho, kiểm kê (gồm `BR-INV-012`), sổ thu chi | Kiểm kê là trang đầu tiên dùng khuôn mới |
| D | Chức năng còn thiếu: màn hình tồn kho, trang chủ cảnh báo, báo cáo lưu chuyển tiền tệ | Cần khuôn B có trước |
| E | Sắp xếp file và gọn code | Làm song song từng phần khi đụng tới, không làm một đợt lớn riêng |
| F | Cơ sở dữ liệu: gỡ 10 bảng bỏ hoang | Đã xong phần code, chờ anh duyệt đưa lên |

## 7. Câu hỏi còn mở — hỏi lần lượt, mỗi lượt một vấn đề

| # | Vấn đề | Trạng thái |
|---|---|---|
| Q1 | Xếp các mục anh chưa nhắc tới vào nhóm nào (mục 5) | **đang hỏi** 2026-09-28 |
| Q2 | Trang chủ cảnh báo những gì, ngưỡng nào | chờ |
| Q3 | Thứ tự các phần A–F | chờ |
| Q4 | Sửa phiếu kiểm kê khi đã có phiếu kiểm sau nó (xem `BR-INV-012`) | chờ, hỏi khi làm phần C |
| Q5 | Màn hình tồn kho cần hiện gì: số lượng, giá trị, cảnh báo sắp hết | chờ |
| Q6 | Báo cáo lưu chuyển tiền tệ theo mẫu nào | chờ, xem `docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md` trước |
| Q7 | Trên điện thoại, những trang nào anh thật sự dùng | chờ |
