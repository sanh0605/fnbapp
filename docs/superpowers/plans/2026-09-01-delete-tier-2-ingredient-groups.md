# Xoá nhóm nguyên liệu tầng 2

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Xoá dữ liệu gốc — `CLAUDE.md` mục 2 cấm theo mặc định.** Đây là ngoại lệ do
chủ quán tự quyết, cùng loại với ngoại lệ công thức (27/08) và món chưa từng bán
(29/08). **Ngoại lệ này chỉ áp cho `base_ingredients`, không mở rộng ra mục nào
khác.**

## 0. Bản ghi cũ của tôi mâu thuẫn với lời chủ quán, và tôi đã hỏi lại

**Ngày 27/08 chủ quán nói, nguyên văn:**

> *"Có thể gộp, nhưng gộp chỉ mang tính chất thống kê, không còn là nối dữ liệu.
> Hoặc nói cách khác, đó là danh mục cấp 2, còn danh mục cấp 1 là nguyên liệu,
> vật tư tiêu hao, dụng cụ."*

Đọc câu đó thì nhóm **vẫn tồn tại**, chỉ hạ xuống thành nhãn gom báo cáo.

**Ngày 29/08 tôi ghi vào hồ sơ:** *"chủ quán quyết định xoá bỏ nhóm nguyên liệu
tầng 2"* — **không kèm một câu trích nào**, trong khi mọi quyết định khác tôi đều
chép nguyên văn. Rồi tôi lặp lại "còn chặn việc xoá nhóm" suốt ba ngày như thể
xoá là chuyện đã chốt.

**Hỏi lại 01/09.** Chủ quán trả lời, nguyên văn:

> *"Xóa trước, sau này cần thì dựng lại sau cho đúng chuẩn logic từ bây giờ trở
> đi."*

Nên xoá là đúng ý ông ấy — nhưng **chỉ được xác nhận hôm nay**, không phải từ
29/08. Câu *"dựng lại sau cho đúng chuẩn logic"* quyết định §2.3 dưới đây.

---

## 1. Hiện trạng

### 1.1 Bảng này có mấy trạng thái, đặt bằng cách nào

Không có trạng thái. `base_ingredients` là **danh sách phẳng 46 dòng**, thêm/sửa
qua màn hình **Nhóm Nguyên Liệu**. Không có cột ngừng dùng, không có cột xoá mềm.

Nghĩa là **không có đường "đánh dấu ngừng dùng"** như `CLAUDE.md` mục 2 vẫn
khuyên. Muốn giữ mà không dùng thì phải thêm cột — việc lớn hơn chính việc xoá.

### 1.2 Màn hình nào có nút gì

| Màn hình | Làm gì với bảng này |
|---|---|
| **Nhóm Nguyên Liệu** | Thêm, sửa, xoá nhóm. **Màn hình này biến mất cùng bảng** |
| **Hàng Mua Vào** | Ô "Liên kết Nhóm Nguyên Liệu", **bắt buộc** khi chọn nhóm Nguyên liệu |
| Kiểm kê, Đơn nhập, Điều chỉnh kho | Chỉ nạp để tra tên, không sửa |

**Ô bắt buộc ở màn hình Hàng Mua Vào là chỗ vỡ đầu tiên:** xoá bảng mà không gỡ
ô đó thì **không tạo được mặt hàng nguyên liệu mới**.

### 1.3 Ai còn dùng — và **không có khoá ngoại nào bảo vệ**

| Nơi | Số lượng |
|---|---:|
| Nhóm nguyên liệu | **46** |
| Mặt hàng mua trỏ vào một nhóm | **52** / 146 |
| File mã nguồn còn nạp bảng | **11** (2 trong đó chỉ là chú thích) |
| Hàm máy chủ còn nhắc | **1** — `apply_stocktake_session_atomic` |
| **Khoá ngoại trỏ vào bảng** | **0** |

**Số 0 cuối cùng là chỗ nguy nhất của cả việc này.** `CLAUDE.md` mục 2 nói về
món ăn: *"không phải tin vào code: mọi khoá ngoại đều đặt `RESTRICT`, nên máy tự
từ chối"*. **Ở đây không có lớp bảo vệ đó.** Máy chủ sẽ xoá 46 dòng **không hỏi
một câu**, để lại 52 mặt hàng trỏ vào chỗ trống. Không có gì chặn ngoài chính
kế hoạch này.

### 1.4 Cái gì mất, và mất ở đâu

**Hai thứ, phải nói cả hai:**

1. **Gom báo cáo theo nhóm.** Không còn xem được *"tháng này chi bao nhiêu cho
   Sữa tươi"* gộp mọi loại sữa tươi đã mua. Chủ quán chấp nhận, và nói sẽ dựng
   lại sau nếu cần.
2. **Dòng gộp trên màn hình Kiểm kê.** `apply_stocktake_session_atomic` có một
   vòng lặp gộp theo nhóm (dòng 216–224 của `0086`). Xoá nhóm thì vòng đó
   **không sinh dòng nào**. Kỳ `STK-001` từng sinh **38 dòng gộp** như vậy.

**Số 2 KHÔNG làm sai tiền.** Chênh lệch lấy từ `count_variance` đóng băng trên
từng dòng đếm; dòng gộp chỉ là bản tóm tắt. Nhưng **chủ quán sẽ thấy màn hình
xem trước ngắn đi**, nên phải báo trước.

**Cái KHÔNG mất:** giá vốn, doanh thu, đơn nhập, phiếu xuất, tồn kho. Không thứ
nào lấy số từ bảng này.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ `base_ingredients` và các chỗ đọc nó. **Cố ý không đụng:**

- **Không đụng `purchased_items` ngoài đúng một cột** (§2.3)
- Không đụng `item_categories` — danh mục cấp 1, thứ thật sự quyết định tiền
- Không đụng phép tính chênh lệch kiểm kê, chỉ mất dòng tóm tắt
- **Không xoá hai bảng sổ kho** — giai đoạn D là việc riêng

### 1.6 Chỗ tôi CHƯA xem

- **Sáu công cụ trong `scripts/`** đọc bảng này (Sonnet nêu 01/09). Chưa xem cái
  nào chạy lại được và sẽ hỏng.
- **Màn hình Nhóm Nguyên Liệu gỡ hẳn hay để rỗng** — chưa quyết. Gỡ hẳn thì phải
  gỡ luôn mục menu, và có phép kiểm canh chuyện đó.
- **`base_ingredient_id` có xuất hiện trong báo cáo nào không** — mới tra chỗ
  nạp bảng, chưa tra chỗ dùng riêng mã đó.

### 1.7 Ví dụ tính sẵn

**Khoai lang.** Hôm nay: mặt hàng mua `SPM-052` trỏ tới nhóm `Khoai lang`, và
nhóm đó mang dấu "không quản lý tồn kho" — **nhưng mặt hàng cũng đã mang dấu đó
từ 01/09**, nên nó không phụ thuộc nhóm nữa.

| | Trước | Sau |
|---|---|---|
| Bị loại khỏi Kiểm kê | có | **có** |
| Bị loại khỏi Phiếu xuất | có | **có** |
| Tiền đã mua | 2.126.000đ | **2.126.000đ** |
| Nhóm còn tồn tại | có | **không** |

**Đây là ví dụ chứng minh việc dọn đường hôm 01/09 đã đủ.** Nếu Khoai lang đổi
hành vi sau khi xoá nhóm thì việc dọn đường chưa xong, và phải dừng.

## 2. Thay đổi

### 2.1 Sao lưu trước, và chứng minh file đọc lại được

Xuất **cả 46 dòng, đủ mọi cột**, cộng **bảng ánh xạ 52 mặt hàng → nhóm** ra
`docs/audits/2026-09-01-base-ingredients-backup.json`. **Đọc lại từ đĩa và đối
chiếu từng dòng**, không chỉ đếm — đúng cách bản sao lưu công thức đã làm.

**Không có bản sao lưu đọc lại được thì không được xoá.**

### 2.2 Gỡ mã nguồn trước, xoá dữ liệu sau

Thứ tự bắt buộc: **gỡ hết chỗ đọc → đẩy code → chủ quán xác nhận → rồi mới xoá
dữ liệu.** Xoá trước là màn hình Hàng Mua Vào hỏng ngay (§1.2).

1. Gỡ ô "Liên kết Nhóm Nguyên Liệu" khỏi form Hàng Mua Vào, **và gỡ phép bắt
   buộc của nó** — đây là chỗ vỡ đầu tiên nếu quên.
2. Gỡ chỗ nạp bảng ở 9 file còn lại.
3. Gỡ màn hình Nhóm Nguyên Liệu và mục menu của nó.
4. Sửa `apply_stocktake_session_atomic` — bỏ vòng lặp gộp theo nhóm. **Một
   migration, không chạy.**

### 2.3 Giữ hay xoá cột `base_ingredient_id` — giữ, và đây là lý do

**Giữ nguyên cột và giá trị trong đó.**

Chủ quán nói *"sau này cần thì dựng lại sau cho đúng chuẩn logic"*. Cột này là
**bản ghi duy nhất trong dữ liệu sống** về việc mặt hàng nào từng thuộc nhóm
nào. Xoá nó là vứt đúng thứ cần cho lần dựng lại.

**Nhưng phải thôi coi nó là liên kết**: không màn hình nào được dùng nó để tra
cứu, và **phải ghi chú ngay tại cột** rằng nó trỏ tới bảng đã xoá. Một mã trỏ
vào chỗ trống mà không ai giải thích là cái bẫy cho người sau.

### 2.4 Xoá dữ liệu

Xoá 46 dòng. **Mặc định chạy thử, `--apply` mới ghi, chủ quán duyệt lần chạy.**

## 3. Kiểm chứng

- **Ví dụ §1.7 phải đứng yên**: Khoai lang và Đá viên vẫn bị loại khỏi cả hai
  màn hình sau khi xoá. Lệch là dừng.
- **Không hàm máy chủ nào còn nhắc `base_ingredients`** — hỏi máy chủ bằng
  `pg_get_functiondef`, **bỏ chú thích trước khi tìm**, đừng ghép file migration
  (bài học 01/09).
- **Tạo thử một mặt hàng nguyên liệu mới** sau khi gỡ ô liên kết — đây là chỗ vỡ
  đầu tiên và phép kiểm phải chạm tới.
- **Đóng thử một kỳ kiểm kê** (`p_dry_run`) trước và sau: `count_variance` từng
  dòng **y hệt**; số dòng gộp giảm về 0 và **chỉ số đó** được phép đổi.
- **Doanh thu không đổi**, năm tháng khớp.
- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa.** Nói rõ đỏ vì **giá
  trị sai** hay vì **thiếu hàm**.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. **Ghi dữ liệu thật, không đảo ngược được — chủ quán duyệt riêng
lần chạy.** Không tự đẩy.

**Rồi chủ quán tự xem:** tạo một mặt hàng nguyên liệu mới; mở màn hình Kiểm kê;
mở Hàng Mua Vào xem còn ô liên kết không.

**Ghi vào `docs/BUSINESS-RULES.md` cùng phiên** (`CLAUDE.md` §8): từ 01/09 danh
mục chỉ còn **một tầng** — Nguyên liệu / Vật tư tiêu hao / Dụng cụ — và không
còn tầng gom nào bên dưới.
