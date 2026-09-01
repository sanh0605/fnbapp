# Sửa đơn vị hay phân loại xong, màn hình khác vẫn hiện bản cũ tới 30 phút

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Cùng loại lỗi chủ quán gặp lúc 02:25 ngày 31/08** — bấm "Bán lại" xong mà máy
POS vẫn báo món chưa có cỡ. Lần đó vá đúng màn hình Sản phẩm
(`docs/superpowers/plans/2026-08-31-pos-shows-stale-products.md`) và ghi lại
rằng còn chỗ khác chưa đo. Đây là phần đo đó.

---

## 1. Hiện trạng

### 1.1 Bộ nhớ tạm có mấy mức, đặt bằng cách nào

`lib/sheets_db.ts` chia làm **ba mức**, gán cứng theo tên bảng:

| Mức | Bảng | Giữ bao lâu |
|---|---|---|
| Danh mục nền | Đơn vị, Phân loại hàng, Nhóm món, Thương hiệu, Điểm bán, Nhà cung cấp, Người dùng | **30 phút** |
| Danh mục | Món, Cỡ, Topping, Khuyến mãi, Hàng mua, Quy đổi đơn vị, Lịch sử giá | **10 phút** |
| Còn lại | Đơn hàng, dòng đơn, phiếu xuất… | 2 phút |

**Không ai đặt được bằng tay.** Muốn đổi phải sửa mã.

### 1.2 Màn hình có nút gì, và nút nào không làm đủ việc

Mọi màn hình quản lý đều có nút **Lưu**. Sau khi lưu, chúng gọi
`revalidatePath("/duong-dan-cua-chinh-no")` — **làm mới đúng màn hình vừa đứng**.

**Nhưng bộ nhớ tạm đánh dấu theo TÊN BẢNG, không theo đường dẫn.** Nên màn hình
khác đọc cùng bảng đó vẫn giữ bản cũ tới khi hết hạn.

Có sẵn một nút **"Xoá Cache"** trong menu làm đúng việc cần làm — nhưng nó là
**thứ chủ quán phải nhớ bấm**, không phải thứ tự chạy.

### 1.3 Ba file, bảy trường hợp — đo 01/09

| Cũ tới | Bảng bị sửa | Số màn hình khác đọc | File |
|---|---|---:|---|
| **30 phút** | Đơn vị | 9 | `app/admin/inventory/actions.ts` |
| **30 phút** | Phân loại hàng | 7 | `app/admin/inventory/actions.ts` |
| 10 phút | Món | 10 | `app/admin/products/toppings/actions.ts` |
| 10 phút | Hàng mua | 9 | `app/admin/inventory/actions.ts` |
| 10 phút | Hàng mua | 8 | `app/admin/inventory/items/actions.ts` |
| 10 phút | Quy đổi đơn vị | 7 | `app/admin/inventory/actions.ts` |
| 10 phút | Quy đổi đơn vị | 7 | `app/admin/inventory/items/actions.ts` |

**Chỉ 3 file, không phải 18.** Bản ghi 31/08 của tôi viết *"20 file dùng
`revalidatePath`, 3 dùng `revalidateTag`"* và để lại ấn tượng 18 chỗ hỏng.
**Sai** — phần lớn trong 20 file đó chỉ ghi vào bảng **ngắn hạn 2 phút**, hoặc
không màn hình nào khác đọc bảng chúng ghi.

**Cách tôi lọc, để người sau kiểm lại được:** giữ một cặp *(file, bảng)* khi cả
ba điều kiện đúng — file **thật sự ghi** vào bảng đó (không phải chỉ đọc), bảng
đó thuộc mức 30 hoặc 10 phút, và có màn hình ở **thư mục khác** đọc cùng bảng.

**Phép đo đầu tiên của tôi ra 47 cặp và nó sai** — nó đếm cả bảng file chỉ đọc.
Con số đúng là 7.

### 1.4 Giá trị nào hợp lệ, sai thì sao

Không có ô nhập. `revalidateTag` nhận một chuỗi, và nó phải **khớp chính xác**
nhãn `sheets_db.ts` gắn lúc đọc: `sheets-<TênBảng>`, phân biệt hoa thường.

**Gõ sai một chữ thì không có gì báo lỗi** — hàm vẫn chạy, chỉ là không xoá gì
cả. Đây là chỗ nguy nhất: **hỏng mà im lặng**, giống hệt lỗi gốc.

Nên phép kiểm phải so nhãn với **đúng hàm sinh ra nhãn**, đừng gõ lại chuỗi bằng
tay ở hai nơi.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ 3 file, 7 cặp ở §1.3. **Cố ý không đụng:**

- **Không đụng bảng mức 2 phút.** Hai phút là chờ được, và sửa hết mọi chỗ là
  đổi nhiều hơn cần
- Không đổi thời gian nhớ tạm của mức nào
- Không gỡ `revalidatePath` đang có — thêm vào, không thay thế
- Không đụng nút "Xoá Cache" thủ công

### 1.6 Chỗ tôi CHƯA xem

- **Nút "Xoá Cache" có xoá đủ 16 bảng không** — nó liệt kê tay 4 nhãn. Nếu chủ
  quán bấm nó mà vẫn thấy bản cũ ở bảng thứ 5 thì đó là lỗi thứ hai, chưa đo.
- **Trang có tự làm mới khi quay lại tab không** — quyết định chủ quán có phải
  tải lại trang bằng tay hay không. Chưa xem, và đã ghi là chưa xem từ 31/08.
- **Có phép kiểm tự động nào canh chuyện này chưa** — chưa tra. Nếu chưa có thì
  lỗi này sẽ quay lại ở màn hình tiếp theo ai đó viết.

### 1.7 Ví dụ tính sẵn

**Chủ quán đổi tên một đơn vị** — ví dụ sửa "Cái" thành "Chiếc" trong màn hình
Đơn vị.

| Màn hình | Hôm nay | Sau khi sửa |
|---|---|---|
| Đơn vị (đang đứng) | thấy ngay | thấy ngay |
| Hàng Mua Vào | **cũ tới 30 phút** | **thấy ngay** |
| Phiếu xuất kho | **cũ tới 30 phút** | **thấy ngay** |
| Kiểm kê | **cũ tới 30 phút** | **thấy ngay** |

**Ba mươi phút là con số thật**, không phải ước lượng — nó là giá trị gán cứng
cho nhóm bảng đó trong `lib/sheets_db.ts`.

## 2. Thay đổi

Trong **3 file** ở §1.3, mỗi hành động ghi vào một bảng dài hạn thì **gọi thêm**
`revalidateTag("sheets-<TênBảng>")` cho đúng bảng nó vừa ghi. **Giữ nguyên
`revalidatePath` đang có.**

**Lấy tên nhãn từ chính chỗ sinh ra nó**, đừng gõ tay chuỗi ở hai nơi (§1.4).
Nếu `sheets_db.ts` chưa có hàm sinh nhãn dùng chung thì tách ra một hàm — đây là
lý do chính đáng, không phải trừu tượng hoá thừa.

**Không sửa file nào khác trong đợt này.**

## 3. Kiểm chứng

- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa:** sửa một đơn vị phải
  làm mới nhãn `sheets-Units`. Hôm nay nó chỉ làm mới đường dẫn. Nói rõ đỏ vì
  **giá trị sai** hay vì **thiếu hàm**.
- **Cả bảy cặp §1.3 đều phải có phép kiểm**, không chỉ cặp dễ nhất.
- **Phép kiểm phải bắt được lỗi gõ sai nhãn** — đây là chỗ hỏng-mà-im-lặng
  (§1.4). Thử một nhãn sai chính tả và chứng minh phép kiểm đỏ.
- **Chạy lại phép đo §1.3 sau khi sửa: phải ra 0 cặp.** Script đo nằm ở
  `scratchpad/stale-cache-risk.ts` — **chép vào `scripts/` nếu muốn giữ**, vì
  đây là thứ đáng chạy lại mỗi khi thêm màn hình.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. Không ghi dữ liệu, không migration, không tự đẩy.

**Rồi chủ quán tự thử:** đổi tên một đơn vị, mở ngay màn hình Hàng Mua Vào xem
tên mới đã về chưa — **không tải lại trang, không chờ**. Đó đúng là việc hỏng.
