# Khuôn danh sách và trang chi tiết cho mọi trang quản trị: thiết kế

Nguồn:
- Chủ quán, 2026-10-02:
  - "Các trang chưa tối ưu responsive theo kích thước màn hình."
  - "Các trang có quá nhiều nút. Mọi thông tin chi tiết của một dòng trong danh sách chỉ sửa trong trang chi tiết của nó. Xoá thì xoá từ danh sách hoặc trong trang chi tiết."
  - "Đã làm mẫu trang rồi, làm luôn cả Phiếu xuất chuẩn chỉnh, nhưng các trang còn lại chưa theo mẫu đó."
- Khuôn đã duyệt:
  - Danh sách: `docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md`, mục 3.5.
  - Chi tiết và chế độ sửa: `docs/superpowers/specs/2026-09-29-phieu-xuat-danh-sach-design.md`, mục 3 và 4.
- Luật: `BR-DATA-007` (không bật khung ô nhập), Luật dữ liệu trong `CLAUDE.md` (ngừng dùng thay vì xoá), `.claude/rules/ui-devices.md` (hai bố cục).

## 0. Chủ quán đã chốt (2026-10-02)

| Câu | Chốt |
|---|---|
| Xoá từ danh sách | Có cả hai lối: biểu tượng thùng rác cuối mỗi dòng, **và** ô tick để chọn nhiều dòng rồi xoá một lần ("1ab") |
| Thứ đã có lịch sử (nhà cung cấp, hàng hoá, món…) | Chỗ nút xoá là nút "Ngừng dùng" (hoặc chữ đang dùng của trang đó), theo luật cũ ("2a") |
| Trang chi tiết trên màn hình to | Trải gần hết bề ngang, có lề vừa phải ("3a"). **Không chia 2 cột.** Thông tin xếp thành danh sách từ trên xuống, như trang phiếu ISL-00083 |

Opus tự quyết (chủ quán không đồng ý thì sửa):
- Nút "Chỉnh sửa" mở trang sửa `/[id]/edit` đã có từ đợt bỏ popup. Trang sửa dựng giống hệt trang chi tiết, chỉ khác là ô nhập nằm thay chỗ giá trị. Người dùng thấy như sửa ngay trên trang chi tiết. Không viết lại form.
- Chọn nhiều rồi xoá: dòng nào xoá được thì xoá, dòng nào bị chặn thì báo tên kèm lý do, ví dụ "Không xoá được Nhóm Cà phê: còn 12 món đang dùng". Không bỏ cả mẻ chỉ vì một dòng bị chặn.
- Hành động ít dùng chỉ nằm trong trang chi tiết: "Bán lại", "Xoá vĩnh viễn" của món, "Xem đơn nhập", "Lịch sử giá", "Lịch sử nhập".

## 1. Hiện trạng: năm câu

1. **Trạng thái.**
   - Mỗi trang danh sách có hai trạng thái: đang xem, và đang chọn. Đang chọn nghĩa là có ít nhất một ô tick, khi đó hiện thanh "Xoá N dòng đã chọn".
   - Trang chi tiết có hai trạng thái: xem (`/[id]`) và sửa (`/[id]/edit`).
   - Hiện nay: phần lớn trang chưa có trang chi tiết, chỉ có trang sửa.
2. **Nút.**
   - **Danh sách:** nút tạo ở góc phải đầu trang, "Lọc", "Xoá lọc", biểu tượng thùng rác cuối dòng, ô tick đầu dòng, thanh "Xoá N dòng đã chọn".
     - Bỏ khỏi dòng: "Sửa", "Xem", "Xem đơn nhập", "Lịch sử", "Bán lại", "Xoá vĩnh viễn".
     - Thùng rác và ô tick chỉ hiện khi người đang xem có quyền xoá hoặc ngừng dùng thứ đó. Quyền giữ như hiện nay, xoá hẳn vẫn chỉ `ADMIN`.
   - **Trang chi tiết:** "← tên danh sách" (về đúng trang và bộ lọc đang xem), "Chỉnh sửa", "Xoá" hoặc "Ngừng dùng", cộng các hành động ít dùng của thứ đó.
   - **Trang sửa:** "Lưu thay đổi", "Bỏ thay đổi". Cả hai về trang chi tiết.
3. **Danh sách.** Mỗi trang giữ nguyên nội dung và cách lọc đang có. Chỉ đổi cách bày và chỗ đặt nút. Không thêm, không bớt dòng nào.
4. **Ô nhập.**
   - Ô lọc giữ luật hiện có. Lọc nằm trên địa chỉ trang, như đã làm ở đợt bỏ popup.
   - Số trang ngoài khoảng thì đưa về trang cuối, như Phiếu nhập.
   - Ô trong trang sửa giữ nguyên luật của form hiện nay.
5. **Phục vụ dữ liệu nào.**
   - Phục vụ mọi trang danh sách quản trị trong bảng mục 4.
   - Cố ý không đụng:
     - Báo cáo, Tổng quan, Kiểm kê, Nhật ký hoạt động, Đồng bộ máy bán hàng, Xoá cache.
     - Máy bán hàng.
     - Server action, bảng dữ liệu, cách tính.
   - Không tạo bảng, không chạy migration.

Thêm, riêng cho việc này:
- **Màn hình cỡ vừa (768–1279px, iPad ngang, laptop nhỏ).** Bảng nhiều cột không được tràn ngang. Cột phụ ẩn ở cỡ này và hiện từ 1280px. Mỗi trang ghi rõ cột nào là cột phụ.
- **Cỡ chữ.** Chữ trong ô bảng tối thiểu 13px. 10–11px chỉ dùng cho nhãn tiêu đề cột và nhãn nhỏ, như Phiếu xuất.
- **Quay lại.** Từ chi tiết hoặc sửa quay về thì danh sách giữ bộ lọc và số trang.

Đã xem:
- Hai trang mẫu trên trình duyệt: danh sách Phiếu xuất, chi tiết ISL-00083.
- Trang Nhà cung cấp và trang sửa nhà cung cấp, trên trình duyệt.
- Đếm bằng máy, trên mã nguồn từng trang danh sách: bảng, thẻ, chữ 10–11px, `max-w-*`, nút xoá và ngừng dùng.
- Danh sách trang `[id]` đang có.

Chưa xem:
- Bên trong từng trang ở cỡ 768–1279px.
- Số dòng thật của từng danh sách. Mỗi kế hoạch đợt phải đo lại.

## 2. Khuôn danh sách

Giống Phiếu xuất (spec 2026-09-29, mục 3), cộng thêm phần xoá.

- **Đầu trang:** chữ nhỏ tên nhóm menu, ví dụ "Nhập hàng". Tên trang. Nút tạo bên phải; trên điện thoại nút chiếm hết bề ngang.
- **Thanh lọc trong một khung:** các ô lọc trang đó đang có, "Lọc" (Enter cũng lọc), "Xoá lọc".
- **Máy tính, từ 768px: bảng thật, trải hết bề ngang.**
  - Cột đầu là ô tick, kèm ô "chọn tất cả" của trang đang xem.
  - Cột cuối là thùng rác. Rê chuột vào thì hiện chữ "Xoá" hoặc "Ngừng dùng".
  - Bấm bất kỳ đâu trên dòng thì mở trang chi tiết, trừ ô tick và thùng rác. Bàn phím: Tab rồi Enter.
- **Điện thoại: thẻ.**
  - Chạm vào thẻ thì mở chi tiết.
  - Thùng rác ở góc thẻ, vùng chạm 44px.
  - Nút "Chọn" trên đầu danh sách bật ô tick trên thẻ, để không tick nhầm khi lướt.
- **Thanh đang chọn:** "Đã chọn N", nút "Xoá N dòng đã chọn" (hoặc "Ngừng dùng N dòng"), và "Bỏ chọn".
  - Bấm xoá thì hiện khung hỏi có/không, khung này được phép giữ (`BR-DATA-007`). Đồng ý thì xoá lần lượt từng dòng, có hiện tiến độ. Xong thì báo số dòng đã xoá và những dòng bị chặn kèm lý do.
- **Chân bảng:** "1–20 trên N", nút trước, nút sau, số trang. Mỗi trang 20 dòng.
- **Không có kết quả:** "Không có dòng nào khớp bộ lọc" và nút "Xoá lọc".

## 3. Khuôn chi tiết và sửa

Giống trang ISL-00083.

- **Đầu trang:** liên kết quay lại, tên hoặc mã của thứ đó, nhãn trạng thái (ví dụ "Ngừng dùng"). Nút ở góc phải: "Chỉnh sửa", "Xoá" hoặc "Ngừng dùng", rồi các hành động ít dùng.
- **Khối thông tin:** một khung trải gần hết bề ngang. Mỗi trường một dòng: nhãn bên trái, giá trị bên phải. Trên điện thoại thì nhãn ở trên, giá trị ở dưới. Không chia 2 cột.
- **Bảng liên quan nằm dưới khối thông tin, trải hết bề ngang,** ví dụ đơn nhập của nhà cung cấp, size của món, lịch sử giá. Trên điện thoại bảng thành thẻ.
- **Trang sửa:** cùng đầu trang, cùng khối. Ô nhập nằm đúng chỗ giá trị. Nút "Lưu thay đổi" và "Bỏ thay đổi" ở cuối.
- **Bề ngang:** khung nội dung tối đa khoảng 1280px, căn giữa. Bỏ `max-w-2xl` dính trái của các form hiện nay.
- **Thứ không có:** gõ tay một mã không có thì ra trang 404, như hiện nay.

## 4. Trang nào, theo đợt

Đợt 1 làm mẫu. Chủ quán bấm thử đợt 1 xong mới làm tiếp.

| Đợt | Trang | Chi tiết mới | Nút ở dòng | Ghi chú |
|---|---|---|---|---|
| 1 (mẫu) | Nhà cung cấp | Thông tin liên hệ + bảng đơn nhập của nhà cung cấp đó | Xoá (chỉ `ADMIN`; nhà cung cấp đã có phiếu nhập thì máy từ chối, nói rõ lý do) | Dựng các mảnh dùng chung ở đợt này. Trang này chưa có nút ngừng dùng; đo 2026-10-02: 46/48 nhà cung cấp đã có phiếu nhập |
| 2 | Hàng hoá, Phân loại hàng, Đơn vị tính, Bảng quy đổi | Hàng hoá: thông tin + quy đổi + lịch sử nhập | Theo trang | Lịch sử nhập chuyển vào trang chi tiết hàng hoá |
| 3 | Tài sản, Thời hạn khấu hao | Tài sản: thông tin + khấu hao | Theo trang | "Thanh lý" là hành động trong trang chi tiết |
| 4 | Món, Nhóm món, Topping & tuỳ chọn | Món: thông tin + size + lịch sử giá | Ngừng bán | "Bán lại" và "Xoá vĩnh viễn" chỉ ở chi tiết |
| 5 | Khuyến mãi, Thương hiệu, Điểm bán | Thông tin | Theo trang | Khuyến mãi và Điểm bán đang dùng thẻ trên máy tính, đổi sang bảng |
| 6 | Sổ thu chi, Danh mục thu chi, Tài khoản | Thông tin | Theo trang | |
| 7 | Nhân sự | Thông tin | Theo trang | Gộp `/admin/users/edit/[id]` về `/admin/users/[id]/edit` |
| 8 | Phiếu nhập, Phiếu xuất, Đơn hàng | Đã có | Chờ chủ quán chốt mục 6 | Đơn hàng đang dùng thẻ trên máy tính, đổi sang bảng |

"Theo trang" nghĩa là giữ đúng chữ và luật của nút xoá hoặc ngừng dùng mà trang đó đang có.

## 5. Mảnh dùng chung

Dựng một lần ở đợt 1, các đợt sau dùng lại. Như vậy không trang nào tự viết khuôn riêng lệch nhau, như Phiếu nhập và Phiếu xuất đang mỗi trang tự viết một bản. Đặt ở `components/ui/`:

- Đầu trang danh sách: nhóm, tên, nút tạo.
- Khung lọc.
- Bảng có ô tick, bấm dòng, thùng rác, và thẻ điện thoại tương ứng.
- Thanh đang chọn: xoá lần lượt, tiến độ, báo dòng bị chặn.
- Chân phân trang.
- Khối thông tin nhãn–giá trị cho trang chi tiết.

Phiếu nhập và Phiếu xuất chuyển sang dùng mảnh chung ở đợt 8, không đổi cách hiện.

Xoá nhiều dòng gọi lần lượt hàm xoá từng dòng đang có. Không thêm server action mới, nên luật chặn và quyền giữ nguyên.

## 6. Còn chờ chủ quán

- Phiếu nhập, Phiếu xuất, Đơn hàng có thêm thùng rác và chọn nhiều ở danh sách không? Huỷ ba loại này bắt buộc gõ lý do. Chọn nhiều thì dùng chung một lý do cho cả mẻ. Hỏi lúc làm đợt 8.

## 7. Kiểm thế nào

- Mỗi trang có test:
  - Danh sách không còn nút "Sửa".
  - Bấm dòng thì sang `/[id]?returnTo=…`.
  - Thùng rác hỏi có/không.
  - Chọn 3 dòng, 1 dòng bị chặn: báo đúng tên dòng bị chặn, 2 dòng kia đã xoá.
- Phép kiểm canh, cùng kiểu `app/admin/no-popups.test.ts`: không file danh sách nào trong `app/admin` còn liên kết tới `/edit`. Trang chi tiết là lối duy nhất vào trang sửa.
- Mở bằng mắt ở ba cỡ: 1568px (màn của chủ quán), 1024px, 390px (điện thoại).

## 8. Sắp xếp theo cột (chủ quán chốt 2026-10-02, `BR-DATA-008`)

- Mọi tiêu đề cột bấm được: lần đầu tăng dần, lần sau giảm dần; mũi tên trên tiêu đề cho biết đang sắp theo cột nào.
- Mặc định mọi danh sách sắp theo mã, giảm dần: mã mới nhất lên đầu (chủ quán đổi 2026-10-03, thay mặc định tăng dần).
- Sắp cả danh sách rồi mới chia trang, về trang 1. `?sort=&dir=` nằm trên địa chỉ trang, quay lại từ chi tiết vẫn giữ.
- Điện thoại: một ô "Sắp xếp" trên đầu các thẻ.
- Dựng trong mảnh chung (`components/ui/list/`); đợt 4–8 dùng luôn.
