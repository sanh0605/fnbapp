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
| 2026-09-28 | Menu 7 nhóm: Tổng quan, Bán hàng, Nhập hàng, Kho, Thu chi, Báo cáo, Cài đặt; Cài đặt chỉ chứa thứ dùng chung cho cả hệ thống | mục 5.5, 5.6 |
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

## 5. Gom nhóm menu

### 5.1 Bản của anh — trả lời Q1, 2026-09-28

Nguyên văn: *"Đơn hàng để trong vận hành, Sổ thu chi để trong báo cáo. Khuyến
mãi để trong vận hành. Tài sản để trong kho. Còn nhà cung cấp có nên tách ra
thành mục nhập hàng không? Trong mục đó sẽ quản lý phiếu nhập hàng và nhà cung
cấp."* Anh cũng yêu cầu Opus đưa bản của riêng mình: *"có thể sắp xếp đã đúng
nhưng cách dùng từ chưa đúng hoặc sai cả 2."*

| Nhóm | Gồm |
|---|---|
| Trang chủ | Cảnh báo cần xử lý |
| Sản phẩm | Món (nước, đồ ăn), Nhóm món, Topping, Tuỳ chọn (đá, ngọt) |
| Vận hành | Thương hiệu, Điểm bán, Đơn hàng, Khuyến mãi |
| Nhập hàng (anh đang cân nhắc tách) | Phiếu nhập hàng, Nhà cung cấp |
| Kho | Phiếu xuất kho, Kiểm kê, Tồn kho, Hàng mua vào, Tài sản |
| Báo cáo | Tổng kết ngày, Bán hàng, Hàng đã xuất, Tài chính, Lưu chuyển tiền tệ, Sổ thu chi |
| Cấu hình | Nhân sự, Đơn vị, Phân loại hàng, Quy đổi, Nhóm thu chi, Tài khoản ngân hàng, Bảng khấu hao, Nhật ký |

### 5.2 Bản của Opus — xếp theo đường đi của tiền và hàng

Anh nói bản chất hệ thống là *nhập, xuất, theo dõi chi phí, báo cáo*. Bản này
xếp menu đúng theo đường đó, từ trên xuống: bán ra → mua vào → trong kho → tiền
ngoài bán/mua → xem báo cáo → cài đặt một lần.

| Nhóm | Gồm | Vì sao |
|---|---|---|
| **Tổng quan** | Cảnh báo cần xử lý, số chính trong ngày | "Trang chủ" là chỗ bấm logo; "Tổng quan" nói rõ trang làm gì |
| **Bán hàng** | Đơn hàng, Món, Nhóm món, Topping & tuỳ chọn, Khuyến mãi | Mọi thứ khách mua nằm một chỗ. Khuyến mãi tính trên món, đơn hàng chứa món |
| **Nhập hàng** | Phiếu nhập, Nhà cung cấp | Đồng ý tách như anh đề xuất: là việc làm nhiều nhất hằng tuần, có đối tác riêng |
| **Kho** | Tồn kho, Phiếu xuất, Kiểm kê, Hàng hoá, Tài sản | Mọi thứ đang nằm trong quán |
| **Thu chi** | Sổ thu chi | Là chỗ **ghi** tiền. Báo cáo chỉ để **xem** — để một trang nhập liệu trong Báo cáo thì nhóm Báo cáo mất nghĩa |
| **Báo cáo** | Tổng kết ngày, Doanh số, Hàng đã xuất, Lãi lỗ, Lưu chuyển tiền tệ | Chỉ xem, không nhập |
| **Cài đặt** | Thương hiệu & điểm bán, Nhân viên & quyền, Đơn vị tính, Phân loại hàng, Nhóm thu chi, Tài khoản ngân hàng, Thời hạn khấu hao, Nhật ký | Thứ đặt một lần rồi ít đụng. Thương hiệu, điểm bán thuộc loại này, nên bỏ nhóm "Vận hành" |

Bảy nhóm, không nhóm nào vừa để nhập vừa để xem.

### 5.3 Cách đặt tên đề xuất

- Tên mục là danh từ ngắn 1–2 chữ, bỏ "Danh sách", "Quản lý", "Bảng".
- Chỉ viết hoa chữ đầu ("Phiếu nhập", không "Phiếu Nhập").
- Đổi: "Danh sách Món" → Món; "Đơn Nhập Hàng" → Phiếu nhập; "Kiểm Kê Định Kỳ"
  → Kiểm kê; "Hàng Mua Vào" → Hàng hoá; "Giá trị hàng đã xuất" → Hàng đã xuất (không gọi "Giá vốn": trang này gộp cả hao hụt kiểm kê, mà `BR-COGS-007` tách hai thứ đó); "Báo
  cáo tài chính" (đang là lãi lỗ) → Lãi lỗ; "Báo cáo Bán hàng" → Doanh số; "Nhân
  sự & Phân quyền" → Nhân viên & quyền; "Cấu hình"/"Hệ thống" → Cài đặt.
- "Bảng Quy Đổi" không đứng riêng: quy đổi thuộc về từng mặt hàng, nên nằm
  trong trang Hàng hoá. "Xoá cache" bỏ khỏi menu.

### 5.4 Hai bản khác nhau ở đâu

| Chỗ | Anh | Opus |
|---|---|---|
| Đơn hàng, Khuyến mãi | Vận hành | Bán hàng, cùng món |
| Thương hiệu, Điểm bán | Vận hành | Cài đặt |
| Sổ thu chi | Báo cáo | Nhóm Thu chi riêng |
| Nhập hàng | Đang cân nhắc tách | Tách |

### 5.5 Anh trả lời Q1b, 2026-09-28 — và một nguyên tắc

Nguyên văn: *"Nhóm thu chi và Tài khoản ngân hàng nên để trong cùng mục với Sổ
thu chi. Thương hiệu và điểm bán để ở Bán Hàng. Đơn vị tính và Phân loại hàng để
ở Kho. Trang cài đặt là trang chỉ dành để cài đặt cho nguyên hệ thống, không
phải chỉ dành cho 1 chức năng nào đó."*

**Nguyên tắc rút ra (áp cho mọi mục về sau):** thứ gì chỉ phục vụ một chức năng
thì nằm cùng nhóm với chức năng đó. Cài đặt chỉ chứa thứ dùng chung cho cả hệ
thống.

Áp nguyên tắc đó, Opus tự xếp thêm: **Thời hạn khấu hao** chỉ phục vụ Tài sản →
về **Kho**, cạnh Tài sản.

### 5.6 Menu đã chốt — 2026-09-28

Anh trả lời Q1c *"1a 2a"*: Thu chi là nhóm riêng, Nhập hàng tách riêng. Bảy
nhóm dưới đây là bản chốt; chỉ còn nội dung trang Tổng quan (Q2).

| Nhóm | Gồm | Còn mở |
|---|---|---|
| Tổng quan | Cảnh báo cần xử lý | Q2 |
| Bán hàng | Đơn hàng, Món, Nhóm món, Topping & tuỳ chọn, Khuyến mãi, Thương hiệu, Điểm bán | |
| Nhập hàng | Phiếu nhập, Nhà cung cấp | |
| Kho | Tồn kho, Phiếu xuất, Kiểm kê, Hàng hoá, Tài sản, Thời hạn khấu hao, Đơn vị tính, Phân loại hàng | |
| Thu chi | Sổ thu chi, Nhóm thu chi, Tài khoản ngân hàng | |
| Báo cáo | Tổng kết ngày, Doanh số, Hàng đã xuất, Lãi lỗ, Lưu chuyển tiền tệ | |
| Cài đặt | Nhân viên & quyền, Nhật ký hoạt động | |

Tên mục theo mục 5.3; anh chưa phản đối cách đặt tên.

### 5.7 Trang Tổng quan — anh trả lời Q2, 2026-09-28

Nguyên văn: *"1. a,b,c và thêm các lời nhắc nhập chi phí hàng tháng. 2. Chỉ cần
một bảng cho thấy tình hình bán ra của 7 ngày gần nhất bao gồm doanh thu, giá
trị trung bình / ly, số ly bán ra, số trứng bán ra, số khoai bán ra."*

**Báo động:**
- Máy bán hàng gửi đơn bị lỗi (đang có).
- Hàng trên sổ bị âm (`BR-INV-004`).
- Lâu chưa kiểm kê, hoặc có phiếu kiểm kê mở dở. Ngưỡng "lâu": chưa hỏi.
- **Mới:** nhắc nhập các khoản chi phí hàng tháng vào Sổ thu chi. Hiện chưa có gì
  để biết khoản nào là khoản hằng tháng — phải thêm (Q2c).
- Không chọn: giá nhập tăng mạnh, hàng sắp hết. Nên không cần đặt mức tối thiểu
  cho từng mặt hàng.

**Bảng 7 ngày** (bỏ biểu đồ và 5 món bán chạy): mỗi ngày một dòng — doanh thu,
giá trị trung bình mỗi ly, số ly, số trứng, số khoai.

**Đo trên dữ liệu thật 2026-09-28** (bảng `product_categories`, `products`):
- Nhóm món đang dùng: Cà phê, Giải trí (chứa Matcha, Cacao, Sữa dâu sấy giòn),
  Trà, Yogurt, Thức ăn, Topping. Nhóm Cacao đã xoá.
- Nhóm Thức ăn có đúng hai món: Khoai lang, Trứng luộc.
- "Ly" chưa được định nghĩa ở đâu trong hệ thống. Cách hiểu tự nhiên: mọi món
  thuộc Cà phê, Giải trí, Trà, Yogurt.
- Món "Test11" đang ở trạng thái bán trong nhóm Cà phê — sẽ bị đếm là ly nếu
  không ẩn.
- Nhóm thu chi đang có: Vận hành, Điện nước gas, Marketing (chi); Thu khác, Vốn
  góp, Doanh thu ghi tay (thu). Nhóm quá rộng để dùng làm dấu "đã nhập khoản
  này tháng này" — "Vận hành" gồm nhiều khoản khác nhau.

### 5.8 Anh trả lời Q2b, Q2c — 2026-09-28

Nguyên văn: *"1b. 2a nhưng chỉ tính toppings được bán kèm với nước, không tính
toppings bán riêng. 3 các khoản nhập hàng tháng cứ để mặc định vào ngày 25 hàng
tháng, còn ngày cụ thể thì anh sẽ tự chọn các ngày trong đúng tháng được nhắc."*

- **Cột đồ ăn:** hai cột cố định, Trứng luộc và Khoai lang (không tự thêm cột
  khi thêm món đồ ăn mới).
- **Số ly:** mọi món thuộc nhóm Cà phê, Giải trí, Trà, Yogurt.
- **Giá trị trung bình mỗi ly** = (tiền các ly nước + tiền topping gọi kèm trên
  chính ly đó) ÷ số ly. Topping bán thành món riêng (ví dụ Hộp sữa chua bán lẻ)
  không tính. Ví dụ: 100 ly nước 3.000.000đ, topping gọi kèm 200.000đ, 20 trứng,
  10 khoai → 3.200.000đ ÷ 100 = 32.000đ/ly. *Chưa kiểm: đơn hàng lưu topping gọi
  kèm tách khỏi topping bán riêng thế nào — phải đo trước khi thiết kế.*
- **Nhắc chi phí tháng:** anh tự lập danh sách khoản hằng tháng. Lời nhắc của
  tháng M hiện từ **ngày 25/M**. Anh nhập khoản đó với ngày tự chọn, miễn nằm
  trong tháng M; có một dòng như vậy thì hết nhắc tháng M.

## 6. Chia phần làm — nháp, chờ anh duyệt thứ tự

| # | Phần | Vì sao đứng ở vị trí này |
|---|---|---|
| A | Gom menu theo nhóm đã chốt (mục 5) | Rẻ, thấy ngay, không đổi dữ liệu |
| B | Khuôn trang chung: font, trang "lập phiếu + danh sách phiếu cũ" (mới nhất trên cùng, 20 phiếu một trang), trang chi tiết phiếu. Bản mẫu cho anh bấm thử trước | Mọi trang sau dựng theo khuôn này; làm sau nó thì không phải làm lại |
| C | Áp khuôn B vào các trang phiếu: nhập hàng, xuất kho, kiểm kê (gồm `BR-INV-012`), sổ thu chi | Kiểm kê là trang đầu tiên dùng khuôn mới |
| D | Chức năng còn thiếu: màn hình tồn kho, trang chủ cảnh báo, báo cáo lưu chuyển tiền tệ | Cần khuôn B có trước |
| E | Sắp xếp file và gọn code | Làm song song từng phần khi đụng tới, không làm một đợt lớn riêng |
| F | Cơ sở dữ liệu: gỡ 10 bảng bỏ hoang | Đã xong phần code, chờ anh duyệt đưa lên |

## 7. Câu hỏi còn mở — hỏi lần lượt, mỗi lượt một vấn đề

| # | Vấn đề | Trạng thái |
|---|---|---|
| Q1 | Xếp các mục anh chưa nhắc tới vào nhóm nào (mục 5) | anh đã trả lời 2026-09-28 (mục 5.1) |
| Q1b | Chọn giữa bản của anh và bản của Opus ở 4 chỗ khác nhau (mục 5.4), và cách đặt tên (5.3) | anh đã trả lời 2026-09-28 (mục 5.5) |
| Q1c | Thu chi là nhóm riêng hay trong Báo cáo; Nhập hàng tách riêng hay trong Kho (mục 5.6) | chốt 2026-09-28: cả hai tách riêng |
| Q2 | Trang chủ cảnh báo những gì, ngưỡng nào | anh đã trả lời 2026-09-28 (mục 5.7) |
| Q2b | "Ly" gồm nhóm nào; trứng, khoai là cột cố định hay theo nhóm Thức ăn; giá trị trung bình mỗi ly tính trên tiền nào | chốt 2026-09-28 (mục 5.8) |
| Q2c | Nhắc chi phí tháng: những khoản nào, hạn ngày nào, khi nào coi là đã nhập | chốt 2026-09-28 (mục 5.8) |
| Q2e | Qua hết tháng M mà chưa nhập thì sao | **đang hỏi** 2026-09-28 |
| Q2d | Ngưỡng "lâu chưa kiểm kê" | **đang hỏi** 2026-09-28 |
| Q3 | Thứ tự các phần A–F | chờ |
| Q4 | Sửa phiếu kiểm kê khi đã có phiếu kiểm sau nó (xem `BR-INV-012`) | chờ, hỏi khi làm phần C |
| Q5 | Màn hình tồn kho cần hiện gì: số lượng, giá trị, cảnh báo sắp hết | chờ |
| Q6 | Báo cáo lưu chuyển tiền tệ theo mẫu nào | chờ, xem `docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md` trước |
| Q7 | Trên điện thoại, những trang nào anh thật sự dùng | chờ |
