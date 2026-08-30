# Xoá bản sao công thức trong dòng đơn

**Written 2026-08-31 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → mô tả hiện trạng trước.

**Chủ quán chốt 31/08**, sau khi được cho biết đây chính là thứ tôi đã dùng làm
lý do nói việc xoá công thức là an toàn: *"Xoá luôn công thức trong dòng đơn,
giữ các thông tin khác ngoại trừ công thức."*

---

## 1. Hiện trạng

### 1.1 Cột này có mấy trạng thái, đặt bằng cách nào

Hai: **có nội dung** (3.444 dòng) và **rỗng** (1 dòng). Không có nút nào cho
người dùng đặt — nó được ghi **tự động mỗi lần bán**, tại
`lib/order-cart.ts:405`, và **đường sửa đơn chép nguyên** sang bản mới.

Từ 31/08, khi công thức bị xoá, thứ được ghi là **một cái vỏ rỗng cố định** —
không còn công thức nào để chép.

### 1.2 Màn hình nào có nút gì

**Không có.** Không màn hình nào hiển thị hay sửa được cột này. Không áp dụng.

### 1.3 Ai đọc nó

`lib/order-cart.ts:225` đọc ngược ra thành `resolvedRecipes`, chuyền qua
`order-edit-cart.ts:109`, rồi **không ai tiêu thụ**. Tra `.resolvedRecipes` ngoài
hai file sinh ra nó: **0 kết quả**.

Ghi vào, đọc ra, chuyền đi, rơi vào khoảng không. **Máy móc chết.**

### 1.4 Giá trị nào là hợp lệ

Chuỗi JSON. `lib/order-types.ts:245` có hàm phân tích, ném lỗi nếu sai định
dạng. Sau khi xoá nội dung, hàm đó **phải chịu được ô rỗng** — đây là chỗ dễ vỡ
nhất của cả việc này.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ gì

Chỉ dòng đơn bán. Không đụng đơn nhập, phiếu xuất, tài sản. **Không đụng bất kỳ
cột nào khác của dòng đơn** — giá, số lượng, món, cỡ, khuyến mãi giữ nguyên,
đúng lời chủ quán.

### 1.6 Số đo hôm nay

| | |
|---|---:|
| Dòng đơn | **3.445** |
| Trong đó có bản sao | **3.444** |
| Dung lượng | **1.543 kB** |
| Mã dòng khác nhau | **3.445** |
| Cặp trùng trong cùng đơn | **0** |

### 1.7 Cái mất, và nó dựng lại được tới đâu

**Tôi đã lặp lại nhiều lần rằng việc xoá công thức an toàn vì "3.444 dòng đơn
tự mang bản sao".** Bỏ nốt bản sao thì lập luận đó không còn — phải nói thẳng
chứ không lờ đi.

**Đo 31/08: dựng lại được hoàn toàn.** Với cả **37/37** biến thể từng bán, file
sao lưu `docs/audits/2026-08-31-recipes-semi-products-backup.json` có **đúng một**
bản công thức phủ đúng thời điểm bán. **0 lỗ, 0 mơ hồ.**

**Nhưng 17 trong 37 món đã đổi công thức giữa chừng**, nên tra một ly cụ thể
phải dùng **giờ bán của chính dòng đó** — giờ bán vẫn nằm trong đơn và không bị
xoá. Trước là máy trả lời ngay; sau là tra tay hai bước.

**4 công thức thuộc món đã xoá không tạo lỗ** — mấy món đó chưa bán ly nào.

### 1.8 Chỗ tôi CHƯA xem

- **`lib/sheets_db.ts:134`** liệt kê cột này trong danh sách nào đó — chưa xem
  danh sách ấy làm gì (chuyển kiểu JSON?).
- **Đường sửa đơn** (`order-edit-transaction.ts:40`) và **đường bán**
  (`pos-order-transaction.ts:53`) đều nêu tên cột trong danh sách cột gửi lên
  máy chủ — chưa xem bỏ tên đi thì hàm máy chủ có kêu không.
- **Có ai xuất báo cáo nào đọc cột này qua đường khác không** — mới tra trong
  `app/` và `lib/`, chưa tra `scripts/`.

## 2. Thay đổi

1. **Xoá nội dung cột trên 3.444 dòng.** Đặt về rỗng, **giữ nguyên cột** — xoá
   cột là việc khác và không cần thiết.
2. **Thôi ghi tiếp**: `order-cart.ts:405` không ghi nữa, và gỡ `resolvedRecipes`
   cùng chuỗi chuyền của nó, vì không ai tiêu thụ.
3. **Không đụng cột nào khác** của dòng đơn.

## 3. Kiểm chứng

- **Ba con số phải đứng yên** — chủ quán hỏi thẳng chuyện này: **3.445 dòng,
  3.445 mã khác nhau, 0 cặp trùng**. Đo trước và sau.
- **Doanh thu đứng yên**, bốn tháng đã chốt khớp từng đồng.
- **Bán thử một ly bằng script chạy trên dữ liệu thật** — đường bán vừa bị đụng.
  Đơn mới phải lưu được, và cột mới phải rỗng chứ không phải vỡ.
- **Phép kiểm cho ô rỗng**: hàm phân tích ở `order-types.ts:245` nhận ô rỗng mà
  không ném lỗi. Viết trước, chứng minh nó đỏ trên bản chưa sửa.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. **Ghi dữ liệu thật — chủ quán duyệt riêng lần chạy.** Không tự
đẩy, và **đẩy code trước hoặc cùng lúc, không bao giờ chạy sau** (`CLAUDE.md`
mục 2, bài học `0076` ngày 30/08).

**Rồi chủ quán bán một ly thật trên máy POS** và sửa một đơn — hai đường vừa bị
đụng.
