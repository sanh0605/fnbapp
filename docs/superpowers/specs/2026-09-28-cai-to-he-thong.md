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
| 2026-09-28 | Thứ gì chỉnh được thì chủ quán tự thêm, sửa, xoá; không nhét cứng | `CLAUDE.md` mục Viết code, mục 5.9 |
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

### 5.9 Anh trả lời Q2d, Q2e — và luật "không nhét cứng", 2026-09-28

Nguyên văn: *"1a. 2a và anh có thể thay đổi số ngày trong cài đặt. 3 bổ sung
thêm một lưu ý mới. Cái nào có thể tùy chỉnh thì để anh có thể tự do thêm sửa
xóa. Tuyệt đối không áp dụng hardcode 100% vào tất cả mọi thứ."*

- Qua hết tháng mà chưa nhập: **vẫn nhắc**, ghi rõ tháng nào, tới khi nhập.
- Lâu chưa kiểm kê: mặc định **30 ngày**, anh tự đổi được.
- Phiếu kiểm kê mở dở: Opus đề xuất báo khi quá 2 ngày; anh không phản đối.
- **Luật mới, áp cho toàn bộ cải tổ:** thứ gì chỉnh được thì anh tự thêm, sửa,
  xoá trên màn hình. Đã ghi vào `CLAUDE.md` mục "Viết code". Thứ đã có lịch sử
  (món, nguyên liệu, đơn, nhà cung cấp) vẫn ngừng dùng chứ không xoá.

**Luật mới đụng tới các câu đã chốt — Opus đề xuất sửa như sau (Q2f):**

| Thứ | Trước | Theo luật mới | Để ở |
|---|---|---|---|
| Số ngày "lâu chưa kiểm kê" | 30 | Anh đổi được, mặc định 30 | Cài đặt → Tổng quan |
| Số ngày "phiếu mở dở" | 2 | Anh đổi được, mặc định 2 | Cài đặt → Tổng quan |
| Ngày bắt đầu nhắc chi phí | 25 | Anh đổi được, mặc định 25 | Cài đặt → Tổng quan |
| Cột đồ ăn trong bảng 7 ngày | cố định Trứng luộc, Khoai lang (1b) | Anh chọn món nào thành cột, mặc định hai món này | Cài đặt → Tổng quan |
| Nhóm nào tính là "ly" | Cà phê, Giải trí, Trà, Yogurt | Thay bằng trường "loại" của nhóm món (mục 5.10) | Bán hàng → Nhóm món |
| Khoản chi hằng tháng | — | Anh tự thêm, sửa, xoá | Thu chi |

Vì sao các ngưỡng về Cài đặt dù anh đặt nguyên tắc "Cài đặt chỉ cho cả hệ
thống": trang Tổng quan gom báo động của mọi nhóm, nên phần chỉnh của nó là thứ
dùng chung. Còn "tính là ly" chỉ thuộc về món, nên nằm ở Bán hàng.

### 5.10 Anh trả lời Q2f — và đề xuất "loại món", 2026-09-28

Nguyên văn: *"1 được. 2 được. 3. Anh nghĩ cần có thêm 1 trường dữ liệu là Thức
uống hoặc Thức ăn để xác định rõ hơn. Thức uống sẽ mặc định tính là li.
Toppings có nên cùng level với cái này không nhỉ?"*

- Bảng chỗ đặt ở mục 5.9: **được**. Cột đồ ăn trong bảng 7 ngày: anh chọn món,
  mặc định Trứng luộc, Khoai lang: **được**.
- **Anh đề xuất thay ô "tính là ly" bằng trường "loại":** Thức uống / Thức ăn.
  Thức uống thì tính là ly.

**Ý kiến Opus (Q2g, chờ anh duyệt):**
- Topping **nên cùng cấp**, thành loại thứ ba. Đo 2026-09-28: topping đang tồn
  tại hai dạng — tuỳ chọn gọi kèm trên ly (bảng `modifiers`, trang "Topping &
  tuỳ chọn") và món bán riêng trong nhóm Topping (ví dụ Hộp sữa chua, Kem muối).
  Loại "Topping" đánh dấu dạng bán riêng, để máy không đếm nó là ly và không cộng
  nó vào giá trị trung bình mỗi ly (mục 5.8).
- Đặt loại trên **Nhóm món**, không trên từng món: mọi món trong nhóm Cà phê
  đều là thức uống, anh chỉ chọn 6 lần thay vì 45 lần. Món mới vào nhóm nào thì
  tự mang loại của nhóm đó.
- Ba loại này **cố định**, là ngoại lệ có lý do của luật "không nhét cứng": máy
  tính số ly và giá trị mỗi ly theo nghĩa của từng loại. Thêm loại thứ tư thì
  máy không biết tính nó vào đâu. Anh vẫn tự chọn loại cho từng nhóm.
- Với nhóm hiện có: Cà phê, Giải trí, Trà, Yogurt → Thức uống; Thức ăn → Thức
  ăn; Topping → Topping.

### 5.11 Anh trả lời Q2g, 2026-09-28 — loại món do anh tự quản

Nguyên văn: *"1 đồng ý. 2 Ok, có thể làm trước theo khuyến nghị. 3. Không đồng
ý, đáng lẽ máy chỉ cần biết thức uống và khác thức uống là được chứ nhỉ?"*

Anh đúng. Máy chỉ cần một điều: loại đó **có phải thức uống không** (thì tính là
ly). Topping bán riêng tự bị loại khỏi số ly và giá trị mỗi ly vì nó không phải
thức uống; topping gọi kèm vẫn được cộng vì nó nằm trên một ly. Cột đồ ăn trong
bảng 7 ngày do anh chọn theo món (mục 5.9), không cần loại.

**Chốt:**
- **Danh sách loại món do anh tự thêm, sửa, xoá** — đặt ở Bán hàng, cạnh Nhóm
  món. Mỗi loại có tên và một ô "là thức uống (tính là ly)".
- Mặc định ba loại: Thức uống (có đánh dấu), Thức ăn, Topping.
- Mỗi **nhóm món** chọn một loại; món theo loại của nhóm. Làm theo cách này trước.
- Xoá một loại đang có nhóm dùng thì máy từ chối và nói nhóm nào đang dùng.
- Thay cho ý "ba loại cố định" ở mục 5.10 — ý đó bị bác.

### 5.12 Anh bổ sung, 2026-09-28 — menu trên điện thoại, bảng màu, máy bán hàng

Nguyên văn: *"Sidebar hiện chỉ phù hợp với bản desktop, laptop, tab hay ipad. Nhưng
đối với điện thoại thì không phù hợp cần lên kế hoạch cho nó. Cách phối màu cũng
đang chưa tốt và anh chỉ cần 1 vài màu để áp dụng cho toàn bộ hệ thống. Hiện đối
với POS màu sắc đang bị khác biệt so với phần còn lại của hệ thống."*

**Đo được (2026-09-28):**
- Menu: màn rộng từ 768px trở lên (máy tính, iPad) thì menu dọc bên trái luôn hiện. Màn
  hẹp hơn (điện thoại) thì menu giấu, bấm nút ba gạch trên đầu mới trượt ra, che
  gần hết màn hình (`app/admin/layout.tsx`).
- Bảng màu khai báo một chỗ (`app/globals.css`) nhưng có tới khoảng 7 sắc: nâu
  (nút chính), xanh ngọc, xanh rêu đậm (menu), be (nền), xanh lá (thành công), cam
  (cảnh báo), đỏ gạch (lỗi), cộng một xanh lá nhạt cho biểu đồ. Biểu đồ tròn ở báo
  cáo doanh số còn 10 mã màu viết thẳng trong code.
- Máy bán hàng dùng chung bộ màu với phần quản trị: không trang nào dùng màu
  ngoài bộ màu chung (0 chỗ trên 161 file giao diện). Chỗ khác nhau anh thấy nằm ở
  **cách phối**: trang quản trị có menu xanh rêu đậm bên trái, còn máy bán hàng không
  có menu, nền be, thanh trên trắng mờ, chữ "POS" màu nâu.
- Chữ: đang dùng hai kiểu, Plus Jakarta Sans cho chữ thường và Outfit cho tiêu đề.
  Outfit thiếu dấu tiếng Việt (việc đổi font đã nằm trong danh sách việc chưa xong,
  từ 12/09/2026).

**Đề xuất gộp vào phần B (khuôn trang chung):**
- Bảng màu thu lại còn 4 vai trò: một màu nền, một màu chữ, một màu chính cho nút
  và chỗ đang chọn, một màu đỏ cho lỗi hoặc cảnh báo. Xanh lá "thành công" chỉ dùng
  khi thật cần. Máy bán hàng và phần quản trị dùng đúng một bộ.
- Menu điện thoại là bố cục riêng (theo `.claude/rules/ui-devices.md`), không phải menu
  máy tính thu nhỏ. Hướng đề xuất: một thanh cố định dưới đáy màn hình với 4 trang
  anh hay dùng nhất, cộng nút "Thêm" mở ra đủ 7 nhóm. Bốn trang đó do anh chọn
  (Q7).
- Bản mẫu cho anh bấm thử có đủ ba màn: máy tính, điện thoại, máy bán hàng, cùng
  một bảng màu. Anh chọn màu trên bản mẫu, không chọn trên giấy.
- Màu có cần là thứ anh tự đổi trong Cài đặt hay không: Q8.

### 5.13 Anh trả lời Q7, 2026-09-28 — thanh dưới đáy, nút mở máy bán hàng, menu thu gọn

Nguyên văn: *"Tổng quan, phiếu nhập, phiếu xuất và mở pos. Nãy giờ chưa thấy đề cập
đến việc mở pos nhỉ? Anh muốn sidebar có thể ẩn/mở."*

**Sót của Opus:** mục 4.1 và 5.6 chỉ đếm các mục trong nhóm, bỏ qua nút **"MỞ MÁY
POS"** nằm riêng trên đầu menu (`app/admin/layout.tsx`). Bấm nút này, máy hỏi mở ở
điểm bán nào; điểm bán đang ngoài giờ mở cửa thì hỏi lại cho chắc
(`app/admin/components/PosOutletPicker.tsx`). Nút này giữ nguyên cách chạy, chỉ đổi chỗ
đặt.

**Chốt:**
- **Điện thoại:** thanh cố định dưới đáy gồm Tổng quan, Phiếu nhập, Phiếu xuất, Mở máy
  bán hàng, và nút "Thêm" mở đủ 7 nhóm. Thay cho nút ba gạch hiện nay.
- **Máy tính, iPad:** menu bên trái có nút thu gọn và mở lại. Opus chọn kiểu thu gọn
  thành một cột hẹp chỉ còn biểu tượng, rê chuột vào thì hiện tên, thay vì giấu hẳn: vẫn
  bấm được mà không phải mở ra. Máy nhớ lựa chọn trên từng máy. Anh xem trên bản mẫu,
  không vừa ý thì đổi.
- Nút "Mở máy bán hàng" luôn nằm trên cùng menu, kể cả khi thu gọn (còn biểu tượng).
- **Trong màn máy bán hàng không hiện thanh dưới đáy:** màn bán hàng cần hết chỗ cho
  món và giỏ hàng. Quay về bằng mũi tên trên đầu như hiện nay.

## 6. Chia phần làm — thứ tự đã chốt 2026-09-29 (Q3: "Theo em khuyến nghị")

| Thứ tự | Phần | Gồm | Vì sao ở vị trí này |
|---|---|---|---|
| 1 | F — Gỡ 10 bảng bỏ hoang | Đã đưa lên 2026-09-29; còn anh thử lưu một món và xem file sao lưu sáng 30/09 | Làm xong việc dở trước khi mở việc mới |
| 2 | A — Menu 7 nhóm | Gom nhóm, đổi tên theo mục 5.3–5.6 | Rẻ, thấy ngay, không đổi dữ liệu |
| 3 | B — Khuôn trang chung | Font, bảng màu 4 vai trò dùng chung cả máy bán hàng, menu riêng cho điện thoại và menu thu gọn trên máy tính (mục 5.12, 5.13), trang "lập phiếu + danh sách phiếu cũ" (mới nhất trên, 20 phiếu một trang), trang chi tiết phiếu; bản mẫu cho anh bấm thử trước | Mọi trang sau dựng theo khuôn này |
| 4 | C — Các trang phiếu theo khuôn | Phiếu nhập, Phiếu xuất, Kiểm kê (gồm `BR-INV-012`), Sổ thu chi | Kiểm kê là việc anh cần nhất |
| 5 | D — Tổng quan mới | Báo động, bảng 7 ngày, loại món, khoản chi hằng tháng, Cài đặt → Tổng quan | Cần khuôn B và loại món |
| 6 | E — Chức năng còn thiếu | Tồn kho, Lưu chuyển tiền tệ | Cần khuôn B |
| suốt quá trình | G — Sắp xếp file, gọn code | Làm ở từng phần khi đụng tới | Không làm một đợt lớn riêng: đợt lớn không ai kiểm nổi |
| 7 | H — Dọn phần sót | Những chỗ không bước nào đụng tới: máy bán hàng (`app/pos/components/POSScreen.tsx` 1.143 dòng, `app/pos/components/CartPanel.tsx` 689 dòng), báo cáo (`app/admin/reports/actions.ts` 898 dòng), đơn hàng (`app/admin/orders/actions.ts` 613 dòng), `lib/db/tables.ts` còn nhắc bảng đã xoá | Chỉ "đụng đâu dọn đó" thì những chỗ này không bao giờ được dọn |

**Anh hỏi, 2026-09-29:** *"Nếu anh đồng ý bước này thì các việc như tối giản code,
tối ưu logic, cải thiện database, sắp xếp thư mục sao cho dễ sửa có được làm không?"*

Có, bằng hai đường:
- **Trong từng bước (G):** bước nào đụng trang nào thì dọn trang đó cùng lúc. Ví dụ
  bước 4 làm Kiểm kê và Phiếu xuất thì hai file lớn nhất của chúng
  (`app/admin/inventory/stocktake/components/StocktakeClient.tsx` 602 dòng,
  `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx` 573 dòng) được tách gọn.
  Chỗ logic rời rạc lớn nhất đã biết (hao hụt kiểm kê bị ghi lẫn thành phiếu xuất
  "Khác", `docs/superpowers/specs/2026-09-28-ban-do-bang-du-lieu.md`) cũng được xử lý ở
  bước này theo `BR-INV-012`.
- **Bước 7 (H):** dọn phần không bước nào đụng tới. Danh sách lập sẵn từ đầu, mỗi bước
  gạch dần, không để quên.
- **Database:** sau bước 1 còn 34 bảng, đo ngày 28/09 thì cả 34 đều đang dùng. Không
  còn bảng dư đã biết; bảng mới chỉ sinh ra khi có việc cần (loại món, khoản chi hằng
  tháng, cài đặt Tổng quan).
- **Cách bảo đảm "gọn mà không đổi cách tính":** mỗi lần dọn, toàn bộ phép kiểm tự
  động phải xanh, và giá vốn tính lại phải ra đúng số cũ (49.943.622đ đo ngày 28/09,
  đo lại trước khi dùng).

## 7. Câu hỏi còn mở — hỏi lần lượt, mỗi lượt một vấn đề

| # | Vấn đề | Trạng thái |
|---|---|---|
| Q1 | Xếp các mục anh chưa nhắc tới vào nhóm nào (mục 5) | anh đã trả lời 2026-09-28 (mục 5.1) |
| Q1b | Chọn giữa bản của anh và bản của Opus ở 4 chỗ khác nhau (mục 5.4), và cách đặt tên (5.3) | anh đã trả lời 2026-09-28 (mục 5.5) |
| Q1c | Thu chi là nhóm riêng hay trong Báo cáo; Nhập hàng tách riêng hay trong Kho (mục 5.6) | chốt 2026-09-28: cả hai tách riêng |
| Q2 | Trang chủ cảnh báo những gì, ngưỡng nào | anh đã trả lời 2026-09-28 (mục 5.7) |
| Q2b | "Ly" gồm nhóm nào; trứng, khoai là cột cố định hay theo nhóm Thức ăn; giá trị trung bình mỗi ly tính trên tiền nào | chốt 2026-09-28 (mục 5.8) |
| Q2c | Nhắc chi phí tháng: những khoản nào, hạn ngày nào, khi nào coi là đã nhập | chốt 2026-09-28 (mục 5.8) |
| Q2e | Qua hết tháng M mà chưa nhập thì sao | chốt 2026-09-28: vẫn nhắc |
| Q2f | Chỗ đặt các thứ chỉnh được của Tổng quan (mục 5.9) | chốt 2026-09-28 |
| Q2g | Loại món: 3 loại cố định (Thức uống, Thức ăn, Topping), đặt trên nhóm món (mục 5.10) | chốt 2026-09-28: loại do anh tự quản, có ô "là thức uống" (mục 5.11) |
| Q2d | Ngưỡng "lâu chưa kiểm kê" | chốt 2026-09-28: 30 ngày, anh đổi được |
| Q3 | Thứ tự các phần (mục 6) | chốt 2026-09-29: 7 bước như mục 6 |
| Q4 | Sửa phiếu kiểm kê khi đã có phiếu kiểm sau nó (xem `BR-INV-012`) | chờ, hỏi khi làm phần C |
| Q5 | Màn hình tồn kho cần hiện gì: số lượng, giá trị, cảnh báo sắp hết | chờ |
| Q6 | Báo cáo lưu chuyển tiền tệ theo mẫu nào | chờ, xem `docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md` trước |
| Q7 | Trên điện thoại, những trang nào anh thật sự dùng (chọn 4 trang cho thanh dưới đáy, mục 5.12) | chốt 2026-09-28 (mục 5.13) |
| Q8 | Bảng màu: chọn trên bản mẫu; có cần tự đổi màu trong Cài đặt không (mục 5.12) | chờ, hỏi khi có bản mẫu |
