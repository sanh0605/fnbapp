# Phép kiểm doanh thu phải tự biết tháng nào đã đóng

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Chủ quán phát hiện 01/09**, bằng một câu hỏi: *"Tại sao em chỉ đo đến tháng 7
trong khi tháng 8 đã kết thúc?"*

Tôi vừa chạy `scripts/verify-revenue.ts` sau một lần ghi vào 3.454 dòng đơn, đọc
dòng *"All structural checks passed"* rồi báo với chủ quán là doanh thu an toàn.
**Script kiểm ít hơn tôi tưởng, và tôi không kiểm lại nó kiểm những gì.**

---

## 1. Hiện trạng

### 1.1 Danh sách tháng có mấy trạng thái, đặt bằng cách nào

Danh sách `MONTH_CHECKS` **đóng cứng trong mã** (`scripts/verify-revenue.ts`),
đo ngày **14/08**, chủ quán xác nhận từng con số. Mỗi tháng có hai trạng thái:

| Trạng thái | Đặt bằng | Hành vi |
|---|---|---|
| Có mốc chuẩn | người viết mã điền số vào | So sánh, lệch thì **báo hỏng** |
| Mốc để trống (`null`) | người viết mã để `null` | **Chỉ in ra, không canh** |

**Không có trạng thái thứ ba cho "tháng đã đóng mà chưa ai đặt mốc".** Đó chính
là chỗ hỏng.

### 1.2 Màn hình nào, nút nào

**Không áp dụng** — đây là script chạy tay, không có màn hình.

### 1.3 Danh sách này chứa gì, và cái gì bị loại ra

Chứa đúng **5 tháng**: 04, 05, 06, 07 (có mốc) và 08 (`null`).

**Bị loại ra: mọi tháng không có tên trong danh sách.** Vòng lặp duyệt
`MONTH_CHECKS`, không duyệt dữ liệu. Nên:

| Tháng | Hôm nay | Hậu quả |
|---|---|---|
| 08/2026 | có tên, mốc `null` | In ra, **không canh** — lỗi chủ quán tìm ra |
| **09/2026** | **không có tên** | **Không in, không canh, không tồn tại** |

**Lỗi thứ hai nặng hơn lỗi thứ nhất.** Tháng 8 ít nhất còn hiện con số để người
đọc tự nghi. Tháng 9 thì **biến mất hoàn toàn** khỏi bảng — và quán đang bán.

### 1.4 Giá trị nào hợp lệ, ngoài khoảng thì sao

Mốc chuẩn là *"số chủ quán đã đối chiếu với sổ của mình"*, không phải *"số máy
tự đo"*. **Máy không được tự đặt mốc cho mình** — như thế là tự chấm bài, và mốc
sẽ đóng băng luôn cả sai sót nếu có.

Nên khi gặp tháng đã đóng mà chưa có mốc, đúng đắn là **báo hỏng và đòi người
đặt**, không phải tự điền.

**"Đã đóng" định nghĩa thế nào:** ngày cuối tháng **nhỏ hơn hôm nay** theo giờ
Sài Gòn. Tháng đang chạy thì in ra, không canh — như hiện tại.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ phần bảng theo tháng. **Cố ý không đụng:** các phép kiểm H1/H2/H3, phần đối
chiếu thanh toán, và **bốn mốc tháng 4–7** — chúng do chủ quán xác nhận 14/08,
không được tính lại.

### 1.6 Chỗ tôi CHƯA xem

- **Còn script nào khác có danh sách đóng cứng kiểu này không** — chưa tra. Nếu
  có thì cùng bệnh.
- **Giờ Sài Gòn tính ở đâu trong script** — có hàm `computeMonthlyTotal` nhận
  ngày đầu/cuối dạng chữ, chưa đọc kỹ nó quy đổi múi giờ thế nào. Phải đọc trước
  khi tự sinh danh sách tháng, kẻo lệch một ngày.

### 1.7 Ví dụ tính sẵn — mốc tháng 8, chủ quán đã xác nhận 01/09

| | Số đo 01/09 |
|---|---:|
| Doanh thu tháng 8 | **17.682.000đ** |
| Số đơn | **644** |
| Điểm bán 001 | 476 đơn, 10.557.000đ |
| Điểm bán 002 | 168 đơn, 7.125.000đ |
| Số ngày có bán | 31/31 |

**Chủ quán đối chiếu sổ và xác nhận đúng 01/09** — đây là mốc chuẩn hợp lệ, cùng
cách bốn mốc kia được lập.

**Vì sao con số này tin được dù hôm nay vừa ghi vào 3.454 dòng đơn:** lệnh ghi đó
chạy trên **mọi dòng, mọi tháng**. Bốn tháng 4–7 vẫn khớp từng đồng với mốc đóng
băng từ 14/08. Hỏng tiền thì bốn tháng kia đã lệch trước.

## 2. Thay đổi

1. **Thêm mốc tháng 8**: `knownRevenue: 17_682_000`, `knownOrderCount: 644`, ghi
   rõ trong chú thích là chủ quán xác nhận 01/09.
2. **Tự sinh danh sách tháng từ dữ liệu**, không đóng cứng: lấy mọi tháng có đơn.
   Mốc chuẩn vẫn là bảng tra đóng cứng, nhưng **danh sách tháng cần kiểm** thì
   suy từ dữ liệu.
3. **Thêm trạng thái thứ ba**: tháng đã đóng mà không tra ra mốc → **báo hỏng**,
   kèm câu tiếng Việt nói rõ phải làm gì (đo, đưa chủ quán xác nhận, rồi điền).
   Tháng đang chạy → in ra, không canh, như cũ.

## 3. Kiểm chứng

- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa:** một tháng đã đóng
  không có mốc phải làm script **thất bại**. Hôm nay nó xanh. Nói rõ đỏ vì **giá
  trị sai** hay vì **thiếu hàm**.
- **Chạy trên dữ liệu thật sau khi sửa: phải ĐỎ vì tháng 9**, nếu tháng 9 đã có
  đơn và chưa có mốc — hoặc **xanh và có in dòng tháng 9** nếu tháng 9 đang chạy.
  Nói rõ rơi vào trường hợp nào.
- **Bốn tháng 4–7 vẫn khớp** đúng con số cũ. Không được tính lại.
- **Tháng 8 chuyển từ "không canh" sang "khớp"**, không phải sang "lệch".
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. Không ghi dữ liệu, không migration, không tự đẩy.

**Đây là phép kiểm, nên phải tự chứng minh nó biết đỏ** — một phép kiểm chưa
từng đỏ thì chưa chứng minh được gì, và lần này chính phép kiểm là thứ đã im
lặng suốt hai tuần rưỡi.
