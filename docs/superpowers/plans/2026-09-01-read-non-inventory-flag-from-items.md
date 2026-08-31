# Hai màn hình thôi đọc dấu trên nhóm, đọc trên mặt hàng

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Đây là chỗ chặn cuối cùng trước khi xoá được nhóm nguyên liệu.** Việc chuyển
dấu đã xong 01/09 (`docs/superpowers/plans/2026-08-31-move-non-inventory-flag-to-items.md`);
còn hai màn hình vẫn đọc dấu ở chỗ cũ.

---

## 1. Hiện trạng

### 1.1 Dấu có mấy trạng thái, đặt bằng cách nào

Vẫn hai giá trị, vẫn nằm ở **hai bảng**, phép kiểm **cộng dồn**. Khác với hôm
qua ở một điểm đã đo: **không còn mặt hàng nào chỉ mang dấu qua nhóm** (từ 2
xuống 0). Nên bảng nhóm giờ là **bản sao thừa**, không phải nguồn duy nhất.

Chính vì cộng dồn mà chỗ lệch dưới đây **không tự lộ ra**: hai bản đang giống
nhau thì mọi cách đọc đều ra cùng kết quả.

### 1.2 Màn hình có nút gì

**Không áp dụng.** Không có nút nào. Đây là việc đổi cách lọc danh sách, không
đổi thao tác của chủ quán.

### 1.3 Hai danh sách này lọc bằng gì — và chúng KHÔNG giống nhau

| | Kiểm kê | Phiếu xuất kho |
|---|---|---|
| Dấu trên nhóm | có kiểm | có kiểm |
| **Dấu trên mặt hàng** | **có kiểm** | **KHÔNG kiểm** |
| Là dụng cụ | có kiểm | có kiểm |

**Đo 01/09 — hậu quả của ô trống đó:**

| Mặt hàng | Kiểm kê | Phiếu xuất kho |
|---|---|---|
| Đá viên, Khoai lang | loại | loại (nhờ dấu trên nhóm) |
| 7 mặt hàng túi và Muỗng nhựa đen | loại | **VẪN HIỆN** |

7 mặt hàng đó mang dấu **trên chính nó** và **không có nhóm**, nên bộ lọc của
màn hình Phiếu xuất kho không với tới được.

**Đã xuất lần nào chưa: 0 phiếu, trên tổng 65 phiếu tay.** Nhưng con số đó chỉ
nói chủ quán **chưa** xuất, **không** nói ông ấy không muốn — nên đây là thay
đổi ông ấy sẽ nhìn thấy, phải nói trước chứ không lặng lẽ sửa.

**Vì sao đằng nào cũng nên đóng, theo `BR-COGS-007`:** một phiếu xuất tay rơi
vào dòng **Giá vốn**, trong khi lần mua chính món đó đã rơi vào dòng **Nguyên
liệu mua dùng ngay**. Xuất một cái túi là **tính tiền hai lần**. Hôm nay chưa
hỏng thật vì màn hình lãi lỗ chưa có (đo 31/08), nhưng phiếu xuất tay thì
**đã** tính vào giá vốn ngay từ bây giờ.

### 1.4 Giá trị nào hợp lệ, ngoài khoảng thì sao

Không có ô nhập. Chỗ dễ sai là **cách sửa**, không phải giá trị:

| Màn hình | Sửa kiểu "bỏ phép kiểm nhóm đi" | Đúng phải là |
|---|---|---|
| Kiểm kê | An toàn — còn phép kiểm trên mặt hàng đỡ | Bỏ phép kiểm nhóm |
| Phiếu xuất kho | **HỎNG — Đá viên và Khoai lang hiện lại**, vì màn hình này không có phép kiểm trên mặt hàng | **Thay** phép kiểm nhóm **bằng** phép kiểm trên mặt hàng |

**Đây là cái bẫy chính của việc này.** Hai màn hình trông giống nhau nên rất dễ
sửa giống nhau, mà một bên bỏ đi là đúng, bên kia bỏ đi là hỏng.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ hai bộ lọc. **Cố ý không đụng:**

- **Không xoá nhóm nguyên liệu.** Việc này chỉ gỡ chỗ chặn cuối; xoá là việc
  riêng, chủ quán duyệt riêng
- Không đụng phép kiểm dụng cụ ở cả hai màn hình
- Không đụng `filterByC17` (lọc theo tồn còn lại) ở cả hai
- Không sửa mục 50 (dấu không có ngày hiệu lực) — việc khác, lớn hơn
- Không đụng dữ liệu. **Đợt này không ghi gì vào máy chủ**

### 1.6 Chỗ tôi CHƯA xem

- **Còn màn hình nào khác đọc `base_ingredients` không** — mới tra đúng dấu
  `is_non_inventory`, chưa tra các chỗ đọc bảng đó vì lý do khác (tên nhóm,
  gom báo cáo). Xoá nhóm còn có thể vướng chỗ đó, và **đó là việc của đợt xoá**,
  không phải đợt này.
- **Màn hình Phiếu xuất kho có đang hiện 7 mặt hàng đó thật không** — tôi suy ra
  từ mã và từ dữ liệu, **chưa mở trang xem tận mắt**.

### 1.7 Ví dụ tính sẵn

**Muỗng nhựa đen (`SPM-076`)** — mang dấu trên chính nó, không có nhóm.

| | Hôm nay | Sau khi sửa |
|---|---|---|
| Màn hình Kiểm kê | không hiện | không hiện |
| Màn hình Phiếu xuất kho | **có hiện** | **không hiện** |

**Đá viên (`SPM-005`)** — mang dấu ở cả hai nơi từ 01/09.

| | Hôm nay | Sau khi sửa |
|---|---|---|
| Cả hai màn hình | không hiện | **không hiện** |

Đá viên là trường hợp chứng minh việc sửa đúng: nó phải **đứng yên**, dù nguồn
dấu đổi từ nhóm sang mặt hàng.

## 2. Thay đổi

1. **Màn hình Kiểm kê** — bỏ phép kiểm dấu trên nhóm, giữ phép kiểm trên mặt
   hàng và phép kiểm dụng cụ.
2. **Màn hình Phiếu xuất kho** — **thay** phép kiểm dấu trên nhóm **bằng** phép
   kiểm dấu trên mặt hàng. Không phải bỏ đi (§1.4).
3. Sau hai bước trên, không chỗ nào còn đọc `base_ingredients.is_non_inventory`.
   Xác nhận bằng phép tra, và nói rõ kết quả.

## 3. Kiểm chứng

- **Phép đo trung tính cho Kiểm kê:** danh sách mặt hàng đưa vào kiểm kê phải
  **y hệt** trước và sau. Đưa ra số lượng và danh sách mã, không chỉ số lượng.
- **Phép đo có chủ ý cho Phiếu xuất kho:** danh sách phải **giảm đúng 7 mặt
  hàng**, và 7 mã đó phải đúng là các loại túi và Muỗng nhựa đen. Giảm nhiều hơn
  hay ít hơn đều là sai.
- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa:** một mặt hàng mang
  dấu trên chính nó không được xuất hiện trong danh sách chọn của Phiếu xuất
  kho. Nói rõ đỏ vì **giá trị sai** hay vì **thiếu hàm**.
- **Phép kiểm giả lập nhóm đã bị xoá:** chạy lại hai bộ lọc với bảng nhóm rỗng
  — kết quả phải **không đổi**. Đây là phép kiểm chứng minh chỗ chặn đã gỡ, và
  là lý do tồn tại của cả đợt này.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. Không ghi dữ liệu, không migration, không tự đẩy.

**Rồi chủ quán mở hai màn hình:** Kiểm kê phải y như cũ; Phiếu xuất kho phải
**không còn** các loại túi và Muỗng nhựa đen trong danh sách chọn.

**Việc này KHÔNG xoá nhóm nguyên liệu.** Nhưng sau khi xong, dấu
`is_non_inventory` trên bảng nhóm không còn ai đọc — chỗ chặn cuối cùng đã gỡ,
và việc xoá trở thành một quyết định của chủ quán chứ không còn là một việc bị
chặn kỹ thuật.
