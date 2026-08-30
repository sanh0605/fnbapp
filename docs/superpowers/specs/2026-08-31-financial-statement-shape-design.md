# Báo cáo tài chính — hình dạng theo mẫu, hai loại hình

**Written 2026-08-31 by Opus 5.**

Status: design, pending owner review

Bước 2 theo `CLAUDE.md` §1b. Chủ quán chốt 31/08: dựng **cả hai loại hình**, khi
nào xác định được thì ẩn bớt. Và: *"anh cần bảng báo cáo phải đúng theo mẫu và
có nguồn rõ ràng, không được tự ý ghi vì vẫn cần phải có sổ kế toán sau này."*

**Mọi chỉ tiêu dưới đây đều dẫn nguồn. Không có dòng nào do tôi đặt tên.**

---

## 1. Phát hiện làm đổi yêu cầu: không có "hai bảng"

Chủ quán nói *"làm cả 2 bảng"*. Nhưng hai loại hình **không sinh ra hai bảng
cùng loại** — chúng sinh ra hai thứ khác hẳn nhau.

| Loại hình | Văn bản | Sinh ra cái gì |
|---|---|---|
| **Doanh nghiệp** | Thông tư 200/2014/TT-BTC | **Báo cáo kết quả hoạt động kinh doanh, Mẫu B02-DN** |
| **Hộ kinh doanh** | Thông tư 88/2021/TT-BTC | **Bảy quyển sổ kế toán. Không có báo cáo tài chính** |

Thông tư 88 **không yêu cầu** báo cáo tài chính hay báo cáo kết quả kinh doanh.
Điều 5 liệt kê bảy sổ, không có báo cáo nào:

| Sổ | Mẫu số |
|---|---|
| Sổ chi tiết doanh thu bán hàng hoá, dịch vụ | **S1-HKD** |
| Sổ chi tiết vật liệu, dụng cụ, sản phẩm, hàng hoá | **S2-HKD** |
| Sổ chi phí sản xuất, kinh doanh | **S3-HKD** |
| Sổ theo dõi tình hình thực hiện nghĩa vụ thuế với NSNN | **S4-HKD** |
| Sổ theo dõi tình hình thanh toán tiền lương và các khoản nộp theo lương | **S5-HKD** |
| Sổ quỹ tiền mặt | **S6-HKD** |
| Sổ tiền gửi ngân hàng | **S7-HKD** |

**Nên "ẩn bớt một bảng" không phải chuyện sẽ xảy ra.** Nếu là hộ kinh doanh thì
thứ phải nộp là **bảy quyển sổ**; nếu là doanh nghiệp thì là **một tờ báo cáo**.
Ẩn cái này không hiện cái kia.

**Điều đó không làm công sức thành vô ích.** Bảy quyển sổ kia đọc từ đúng những
dữ liệu đang xây: S1 từ đơn bán, S2 từ đơn nhập và phiếu xuất, S3 từ bảng chi
phí, S6/S7 từ dòng tiền. Xây một lần dùng được cả hai đường.

## 2. Mẫu B02-DN — toàn bộ chỉ tiêu

| Mã số | Chỉ tiêu | Công thức |
|---|---|---|
| 01 | Doanh thu bán hàng và cung cấp dịch vụ | |
| 02 | Các khoản giảm trừ doanh thu | |
| **10** | **Doanh thu thuần về bán hàng và cung cấp dịch vụ** | 01 − 02 |
| 11 | Giá vốn hàng bán | |
| **20** | **Lợi nhuận gộp về bán hàng và cung cấp dịch vụ** | 10 − 11 |
| 21 | Doanh thu hoạt động tài chính | |
| 22 | Chi phí tài chính | |
| 23 | *trong đó: Chi phí lãi vay* | |
| 25 | Chi phí bán hàng | |
| 26 | Chi phí quản lý doanh nghiệp | |
| **30** | **Lợi nhuận thuần từ hoạt động kinh doanh** | 20 + (21 − 22) − (25 + 26) |
| **31** | **Thu nhập khác** | |
| **32** | **Chi phí khác** | |
| **40** | **Lợi nhuận khác** | 31 − 32 |
| **50** | **Tổng lợi nhuận kế toán trước thuế** | 30 + 40 |
| 51 | Chi phí thuế TNDN hiện hành | |
| 52 | Chi phí thuế TNDN hoãn lại | |
| **60** | **Lợi nhuận sau thuế thu nhập doanh nghiệp** | 50 − 51 − 52 |
| 70 | Lãi cơ bản trên cổ phiếu | |
| 71 | Lãi suy giảm trên cổ phiếu | |

## 3. Thanh lý tài sản rơi vào đâu — câu chủ quán hỏi

Theo Thông tư 200, thanh lý/nhượng bán tài sản cố định ghi **tách hai vế, không
bù trừ**:

- **Tiền thu được** → TK 711 → **Mã số 31, Thu nhập khác**
- **Giá trị còn lại của tài sản** → TK 811 → **Mã số 32, Chi phí khác**

**Ví dụ của chủ quán — giá trị còn lại 10đ, thu hồi 4đ:**

| | |
|---|---:|
| Mã số 31 — Thu nhập khác | **4đ** |
| Mã số 32 — Chi phí khác | **10đ** |
| Mã số 40 — Lợi nhuận khác | **−6đ** |
| Khấu hao tháng đó | **không đổi** |

**Không có dòng nào tên "Lãi/lỗ thanh lý tài sản".** Tôi đã tự đặt ra tên đó
trong một câu trả lời ứng khẩu ngày 31/08 và nó sai; chủ quán vặn thì mới tra
ra. Ghi lại ở đây để không ai dùng lại.

**Ô "thu hồi" của chủ quán làm đúng việc này**: rỗng thì mã 31 bằng 0 và mã 32
là toàn bộ giá trị còn lại (cho, tặng, bỏ, hỏng); có số thì mã 31 là số đó.
Một ô, không cần thêm loại lý do.

**Báo cáo dòng tiền chỉ có MỘT dòng**, không phải hai: **tiền thu 4đ**. Con số
10đ là giá trị trên sổ, không phải tiền — tiền đã ra khỏi quán lúc mua.

## 4. Quán này lấp được bao nhiêu dòng của B02-DN

Đo 31/08:

| Mã số | Nguồn dữ liệu trong hệ thống | Có chưa |
|---|---|---|
| 01 / 02 / 10 | `orders_v2` | **Có** |
| 11 Giá vốn | `stock_issues` + hàng "mua dùng ngay" (`BR-COGS-007`) | **Có** |
| 21 / 22 / 23 tài chính | — | **Không có, luôn 0** |
| 25 / 26 chi phí | Bảng chi phí (đợt 4, chưa dựng) | **Chưa** |
| 31 / 32 / 40 | Thanh lý tài sản (ô thu hồi, chưa có) | **Chưa** |
| 51 / 52 thuế | — | **0 — chủ quán chốt 17/08: doanh thu dưới 1 tỷ, chưa nộp** |
| 70 / 71 cổ phiếu | — | **Không áp dụng** |

## 5. Ba việc chỉ chủ quán quyết được

**Một — `BR-COGS-007` có ba dòng giá vốn, mẫu chỉ có một.** Quy tắc anh chốt
19/08 tách *Giá vốn* / *Nguyên liệu mua dùng ngay* / *Hao hụt*. Mã số 11 chỉ có
một ô. Gộp cả ba vào mã 11 và hiện ba dòng con bên dưới? Hay chỉ *Giá vốn* vào
mã 11, còn hai dòng kia sang mã 26?

**Hai — chi phí của anh chia vào mã 25 hay 26 thế nào?** Mẫu tách *Chi phí bán
hàng* và *Chi phí quản lý doanh nghiệp*. Nhóm chi phí thật của anh là *Vận
hành*, *Điện nước gas*, *Marketing*. Marketing thường vào 25; điện nước thì tuỳ
dùng cho chỗ bán hay chỗ quản lý. **Không đoán hộ được** — và nó đổi con số
"lợi nhuận thuần" ở mã 30.

**Ba — khấu hao dụng cụ vào mã nào?** Hiện `BR-COGS-008` tính 801.641đ/tháng
nhưng chưa nói nó nằm ở dòng nào. Dụng cụ pha chế dùng để bán hàng thì thường
vào mã 25.

## 6. Chỗ tôi CHƯA xem

- **Mẫu B01-DN (bảng cân đối kế toán)** — chưa tra. Nếu sau này cần thì nó đòi
  cả tài sản lẫn tiền mặt, mà `Plan J` §10.1 đã ghi là thiếu nền.
- **Mẫu B03-DN (lưu chuyển tiền tệ)** — chưa tra. Báo cáo dòng tiền anh muốn có
  thể phải theo mẫu này chứ không phải bảng tự nghĩ.
- **Chi tiết bảy sổ S1–S7-HKD** — mới có tên, chưa xem từng sổ đòi cột gì.
- **Hộ kinh doanh nộp thuế khoán** thì Thông tư 88 có bắt buộc không, hay chỉ
  áp cho hộ kê khai — mới đọc được là áp cho hộ **kê khai**, chưa xác minh phần
  còn lại.

## 7. Nguồn

- Thông tư 200/2014/TT-BTC, Điều 113 — mẫu B02-DN và cách lập
- Thông tư 88/2021/TT-BTC, Điều 5 — danh mục sổ kế toán hộ kinh doanh, S1–S7-HKD
- Hạch toán thanh lý/nhượng bán TSCĐ: TK 711 (thu nhập khác), TK 811 (giá trị
  còn lại), TK 214 (hao mòn), TK 211 (nguyên giá)
