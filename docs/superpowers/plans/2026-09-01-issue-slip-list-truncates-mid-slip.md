# Danh sách phiếu xuất cắt giữa phiếu, và không xem lại được phiếu cũ

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Mục 34 trong `docs/OPEN-ITEMS.md`**, chủ quán gác lại 09/08 để không nhét vào
đợt sửa bố cục. Đo lại 01/09 thì nó **không phải một vấn đề mà là hai**, và cái
thứ hai không có trong mô tả cũ.

---

## 1. Hiện trạng

### 1.1 Danh sách này có mấy trạng thái, đặt bằng cách nào

Một trạng thái. `getRecentIssueSlips` luôn lấy **100 dòng mới nhất**
(`RECENT_SLIPS_LIMIT`), không có trang sau, không có ô tìm, không có bộ lọc ngày.
**Không ai đổi được con số 100 ngoài việc sửa mã.**

### 1.2 Màn hình có nút gì

| Nút | Làm gì |
|---|---|
| Tạo phiếu xuất | Ghi phiếu mới |
| Đảo một dòng | Đảo đúng một dòng trong phiếu |
| Huỷ cả phiếu | Đảo mọi dòng chưa đảo của phiếu |

**Không có nút nào để xem phiếu cũ hơn danh sách.**

### 1.3 Danh sách chứa gì, và cái gì bị cắt

**Cắt theo DÒNG, gộp theo PHIẾU — và gộp diễn ra SAU khi đã cắt.**

Máy chủ lấy 100 **dòng** `Stock_Issues`, rồi màn hình
(`IssueSlipClient.tsx`) mới gộp chúng thành phiếu theo `slipId`.

**Đo 01/09:**

| | |
|---|---:|
| Dòng xuất kho tay | **69** |
| Phiếu | **40** |
| Trung bình mỗi phiếu | 1,7 dòng |
| Phiếu nhiều dòng nhất | **8 dòng** |
| Giới hạn | 100 **dòng** |
| Tức khoảng | **57 phiếu** |

**Hôm nay chưa mất gì** — 69 dòng còn dưới 100. Nhưng ngày 30/08 chủ quán ghi 8
phiếu trong một buổi, nên khoảng trống còn lại là **vài tuần**.

### 1.4 Điều gì xảy ra khi vượt 100 — hai chuyện, không phải một

**Chuyện 1, mục 34 đã ghi:** phiếu cũ biến mất khỏi danh sách, không có đường
nào xem lại.

**Chuyện 2, mục 34 KHÔNG ghi, và nặng hơn:** vết cắt 100 dòng **rơi vào giữa một
phiếu**. Phiếu ở ranh giới sẽ hiện **thiếu dòng** — ví dụ phiếu 8 dòng chỉ còn
hiện 3 dòng.

**Và nó không trông giống lỗi.** Nó trông giống một phiếu 3 dòng hoàn chỉnh.
Không có dấu hiệu nào cho biết đã bị cắt. Đây là kiểu hỏng tệ nhất: **sai mà im
lặng**.

**Chỗ này KHÔNG làm sai giá vốn** — tiền tính từ `stock_issues`, không tính từ
màn hình. Và nút "Huỷ cả phiếu" gửi mã phiếu lên máy chủ nên vẫn huỷ đủ mọi
dòng. **Cái sai là thông tin chủ quán nhìn thấy khi quyết định**, không phải con
số máy tính.

### 1.5 Giá trị nào hợp lệ, ngoài khoảng thì sao

Không có ô nhập của người dùng. Chỗ dễ sai nằm ở **cách sửa**:

| Cách sửa | Hỏng ở đâu |
|---|---|
| Nâng 100 lên 500 | Hoãn được vài tháng. **Không sửa chuyện cắt giữa phiếu**, chỉ đẩy nó ra xa |
| Cắt theo phiếu thay vì theo dòng | Đúng hướng, nhưng phải lấy **đủ mọi dòng** của những phiếu được chọn |
| Bỏ giới hạn | Ngày nào đó tải cả nghìn dòng mỗi lần mở trang |

### 1.6 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ danh sách phiếu xuất tay. **Cố ý không đụng:**

- Không đụng cách ghi phiếu, cách đảo, cách huỷ
- **Không đụng `stock_issues`** — đường giá vốn
- Không đụng phiếu do kiểm kê sinh ra (`source = 'STOCKTAKE'`)
- **Không làm ô tìm kiếm hay lọc theo ngày trong đợt này** — đó là tính năng
  mới, cần chủ quán quyết trước

### 1.7 Chỗ tôi CHƯA xem

- **Điện thoại có chịu nổi danh sách dài không** — `CLAUDE.md` §7 bắt mỗi thiết
  bị một bố cục, và đây là màn hình chủ quán dùng khi đứng trước kệ. Chưa đo.
- **Phiếu do kiểm kê sinh ra có nằm chung danh sách không** — mới thấy bộ lọc
  `source = 'MANUAL'`, chưa xem màn hình có chỗ nào xem phiếu kiểm kê không.
- **`findAllWhere` có hỗ trợ phân trang không** — chưa đọc. Nó quyết định cách
  sửa ở §2 làm được tới đâu.

### 1.8 Ví dụ tính sẵn

Giả sử chủ quán đã có **110 dòng** trong **60 phiếu**, và phiếu thứ 57 tính từ
mới nhất có **8 dòng**, trong đó **3 dòng** rơi trong 100 dòng đầu.

| | Hôm nay | Sau khi sửa |
|---|---|---|
| Phiếu thứ 57 hiện | **3 dòng, trông như phiếu đủ** | **8 dòng, hoặc không hiện** |
| Phiếu thứ 58 trở đi | biến mất | **xem được** |
| Tổng số lượng đã xuất trong phiếu 57 | **sai** trên màn hình | đúng |

## 2. Thay đổi

**Chia hai phần, và phần 1 phải làm dù chưa quyết phần 2.**

### 2.1 Thôi cắt giữa phiếu — bắt buộc

Lấy dữ liệu **theo phiếu**, không theo dòng: chọn N phiếu mới nhất rồi lấy **đủ
mọi dòng** của N phiếu đó.

**Nếu `findAllWhere` không làm được trong một lần gọi** (§1.7) thì hai bước:
lấy danh sách mã phiếu mới nhất, rồi lấy mọi dòng thuộc các mã đó. **Nói rõ đã
chọn cách nào và vì sao.**

**Phần này sửa cái sai-mà-im-lặng, nên không chờ quyết định nào cả.**

### 2.2 Xem phiếu cũ hơn — cần chủ quán chọn

| Cách | Được | Mất |
|---|---|---|
| **A. Nút "Xem thêm"** | Đơn giản, hợp điện thoại, không cần ô nhập mới | Bấm nhiều lần nếu tìm phiếu xa |
| **B. Lọc theo khoảng ngày** | Tới thẳng ngày cần | Thêm hai ô nhập, thêm bố cục cho điện thoại |

**Chủ quán chốt 01/09 — và câu trả lời không nằm trong A hay B:**

> *"Nếu là chỗ xuất kho thì anh muốn nó sẽ có giao diện tương tự với trang quản
> lý nhập hàng. Chỉ xem chi tiết sản phẩm xuất ra khi bấm vào xem chi tiết phiếu
> xuất."*

Tức là **dựng lại màn hình theo lối màn hình Đơn Nhập Hàng**: danh sách chỉ hiện
từng phiếu một dòng, muốn xem xuất những gì thì bấm vào phiếu.

**Điều đó làm chuyện cắt giữa phiếu tự biến mất** — danh sách lấy theo phiếu chứ
không theo dòng, nên không còn vết cắt nào rơi vào giữa. §2.1 trở thành một phần
của việc dựng lại, không phải bản vá riêng.

**Chủ quán nói rõ đây là việc để sau**, không làm bây giờ. Nên:

- **Không giao Sonnet đợt này.**
- Khi làm, đây là **dựng màn hình theo mẫu đã có**, phải đọc màn hình Đơn Nhập
  Hàng trước rồi mới thiết kế — đừng nghĩ ra bố cục mới.
- §1.7 còn ba câu chưa trả lời, và câu về điện thoại (`CLAUDE.md` §7) thành
  quan trọng nhất, vì đây là màn hình dùng khi đứng trước kệ.

## 3. Kiểm chứng

- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa:** dựng một tập dữ liệu
  có phiếu nằm đúng ranh giới cắt, và chứng minh hôm nay nó hiện thiếu dòng. Nói
  rõ đỏ vì **giá trị sai** hay vì **thiếu hàm**.
- **Ví dụ §1.8 phải chạy được thành phép kiểm**, không chỉ là minh hoạ.
- **Tổng số lượng mỗi phiếu trên màn hình phải khớp tổng trong dữ liệu** — đây
  là con số sai hôm nay.
- **69 dòng / 40 phiếu hiện tại phải hiện y nguyên** trước và sau. Đây là phép
  đo trung tính: hôm nay chưa vượt giới hạn nên **không được đổi gì cả**.
- **Giá vốn không đổi:** `stock_issues` đếm và tổng bằng nhau trước/sau. Đợt này
  không ghi gì, nên lệch là có chuyện.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. Không ghi dữ liệu, không migration, không tự đẩy.

**Rồi chủ quán tự mở màn hình Phiếu Xuất Kho trên điện thoại** — danh sách phải
y như cũ, vì hôm nay chưa vượt giới hạn. **Không đổi gì là kết quả đúng**, và đó
là điều cần nói trước để ông ấy không tưởng chưa làm.
