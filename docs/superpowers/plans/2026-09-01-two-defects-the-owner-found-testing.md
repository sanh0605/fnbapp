# Hai lỗi chủ quán tìm ra khi thử: lời từ chối khó hiểu, và trang không tự cập nhật

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Chủ quán tìm ra 01/09** khi thử bản vừa đẩy. Hai lỗi độc lập, cùng thuộc loại
*"màn hình nói gì với người dùng sau khi bấm"*.

> *"1. Anh không xóa được COMBO 2 trong trang QUẢN LÝ ĐƠN VỊ.
> 2. Khi cập nhật TÊN PHÂN LOẠI trong trang PHÂN LOẠI HÀNG thì tên hiển thị không
> cập nhật lại ngay trong trang, nhưng trang HÀNG MUA VÀO có thay đổi theo."*

---

# PHẦN A — không xoá được đơn vị, và không hiểu vì sao

## A1. Trạng thái và cách đặt

Đơn vị không có trạng thái ngừng dùng. Chỉ có tồn tại hoặc bị xoá. Nút **Xoá**
gọi thẳng `remove("Units", id)` — **không có chốt nào trong mã**.

## A2. Màn hình có nút gì

Màn hình **Quản Lý Đơn Vị**: Thêm, Sửa, Xoá. Nút Xoá **luôn hiện**, kể cả với
đơn vị đang được dùng — nên chủ quán bấm rồi mới biết không xoá được.

## A3. Ai đang chặn — đo 01/09

**Máy chủ chặn, và chặn đúng.** Có **7 khoá ngoại** trỏ vào bảng đơn vị, **tất
cả đều `RESTRICT`**: nhóm nguyên liệu, bán thành phẩm, hàng mua, quy đổi (2 khoá),
dòng đơn nhập, và bảng sản xuất.

**Cụ thể trường hợp chủ quán gặp:**

| | |
|---|---|
| Đơn vị | `UNT-010` — **Combo 2** |
| Đang bị dùng bởi | **1 dòng quy đổi** `QD-015`, còn hiệu lực |
| Của mặt hàng | **Bột cà phê MR.PHIN Robusta Đắk Mil** |
| Mặt hàng lấy nó làm đơn vị gốc | 0 |

**Chủ quán tự chứng minh chẩn đoán này 01/09**, ngay sau khi được cho biết:

> *"Anh đã gỡ COMBO 2 trong 'Bột cà phê MR.PHIN Robusta Đắk Mil' và đã xóa thành
> công COMBO 2."*

Gỡ đúng dòng quy đổi đó ra thì xoá được ngay. **Cơ chế chặn không có gì sai —
chỉ lời báo là sai.** Và ông ấy gỡ được là vì tôi nói cho ông ấy biết cái gì
đang chặn; câu báo trên màn hình thì không nói.

**Đây là lớp bảo vệ làm đúng việc** — giống hệt cách `CLAUDE.md` mục 2 mô tả cho
món ăn: *"cứ thử xoá rồi dịch lời từ chối sang tiếng Việt"*.

## A4. Lời từ chối hiện ra thế nào — đây mới là lỗi

`deleteUnit` bắt lỗi rồi trả về **nguyên văn lời máy chủ**: `return fail(error.message)`.

Nghĩa là chủ quán nhận một câu **tiếng Anh**, kèm tên ràng buộc kỹ thuật kiểu
`uom_conversions_purchased_unit_fkey`. Câu đó **không nói cái gì đang dùng đơn vị
này**, mà đó chính là điều duy nhất ông ấy cần biết để xử lý.

**Lỗi không nằm ở việc chặn. Lỗi nằm ở việc không giải thích.**

## A5. Phục vụ gì, cố ý không phục vụ gì

**Cố ý không đụng:**

- **Không gỡ khoá ngoại nào.** Chúng là lớp bảo vệ, và `CLAUDE.md` mục 2 dựa vào
  đúng lớp này
- Không thêm xoá mềm cho đơn vị — việc lớn hơn, chưa ai yêu cầu
- Không ẩn nút Xoá đi. Ẩn thì chủ quán không biết vì sao nó biến mất; **báo rõ
  tốt hơn ẩn**

## A6. Chỗ tôi CHƯA xem

- **Các màn hình khác có cùng bệnh không** — nhà cung cấp, phân loại hàng, nhóm
  món cũng có nút Xoá và cũng có khoá ngoại. Chưa đo cái nào trả lời tiếng Anh.
- **Có sẵn hàm dịch lỗi nào chưa** — thấy `duplicateNameErrorMessage` cho lỗi
  trùng tên, chưa xem có mẫu chung cho lỗi khoá ngoại không. **Nếu có thì dùng
  lại, đừng viết mới.**

## A7. Ví dụ tính sẵn

Chủ quán bấm Xoá trên **Combo 2**:

| | Hôm nay | Sau khi sửa |
|---|---|---|
| Có xoá được không | không | **không** (đúng) |
| Câu báo | tiếng Anh, tên ràng buộc | *"Không xoá được đơn vị Combo 2 vì đang được dùng trong 1 dòng quy đổi của Bột cà phê MR.PHIN Robusta Đắk Mil. Xoá dòng quy đổi đó trước."* |

**Câu báo phải gọi tên thật** (`CLAUDE.md` mục 6), không đọc mã `QD-015`.

---

# PHẦN B — sửa xong nhưng trang đang đứng không đổi

## B1. Trạng thái và cách đặt

Không có trạng thái. Đây là chuyện **thứ tự việc xảy ra sau khi bấm Lưu**.

## B2. Chuyện gì thật sự xảy ra

`components/inventory/CategoryForm.tsx` làm ba việc: gọi hành động lưu, tắt
trạng thái chờ, đóng hộp thoại. **Không việc nào bảo trang vẽ lại.**

Lệnh `revalidatePath` bên máy chủ **đánh dấu dữ liệu cũ**, nhưng nó không tự vẽ
lại trang mà trình duyệt đang hiển thị. Muốn vẽ lại phải bảo trình duyệt.

**Vì thế trang Hàng Mua Vào lại đúng:** chủ quán **đi tới** trang đó, tức là một
lần vẽ mới — và lần vẽ đó lấy dữ liệu đã được làm mới. **Bản vá hôm nay chạy
đúng**; chỉ có trang đang đứng là không tự vẽ lại.

**Một chi tiết dễ nhầm:** form này viết theo lối `<form action={handleSubmit}>`,
trông y hệt lối để máy tự làm mới. Nhưng `handleSubmit` là hàm phía trình duyệt,
gọi hành động máy chủ **bên trong** — nên máy **không** nhận ra đó là hành động
máy chủ, và không tự làm mới. **Trông đúng mẫu mà không phải mẫu đó.**

## B3. Còn bao nhiêu chỗ như thế

**Đo thô 01/09: 21 màn hình** gọi hành động lưu/xoá rồi không làm mới trang.

**Nhưng con số 21 là chặn trên, không phải số lỗi.** Phép đo của tôi chỉ tìm chữ
`router.refresh` — nó **không** phân biệt được màn hình nào thật sự hỏng với màn
hình đúng ra không cần làm mới. **Người thực thi phải kiểm từng cái**, đừng sửa
mù 21 chỗ.

**Hai chỗ chắc chắn hỏng, chủ quán tự gặp:** trang **Phân Loại Hàng** và trang
**Quản Lý Đơn Vị**.

## B4. Giá trị nào hợp lệ, sai thì sao

Không có ô nhập. Chỗ dễ sai là **làm mới quá tay**: gọi tải lại cả trang
(`window.location.reload`) thì đúng kết quả nhưng chậm và mất chỗ đang cuộn —
tệ trên điện thoại, mà đây là thiết bị chính (`CLAUDE.md` §7).

**Cách đúng là bảo trình duyệt vẽ lại đường dẫn hiện tại**, giữ nguyên trạng
thái màn hình.

## B5. Phục vụ gì, cố ý không phục vụ gì

**Cố ý không đụng:**

- **Không sửa cả 21 chỗ.** Sửa hai chỗ chủ quán gặp, cộng những chỗ kiểm ra hỏng
  thật. Ghi lại phần còn lại
- Không đụng lệnh làm mới phía máy chủ đang có — **thêm vào, không thay thế**
- Không đổi cách các form gửi dữ liệu

## B6. Chỗ tôi CHƯA xem

- **Màn hình Sản phẩm có cùng bệnh không** — nó cùng hình dạng mã, nhưng hôm
  29/08 chủ quán thử thì thấy đổi. Có thể lúc đó ông ấy tải lại trang. **Chưa
  xác minh**, và đừng cho là nó ổn.
- **Có phép kiểm tự động nào canh chuyện này chưa** — chưa tra.

## B7. Ví dụ tính sẵn

Chủ quán sửa tên phân loại `Nguyên liệu` thành `Nguyên vật liệu`:

| Màn hình | Hôm nay | Sau khi sửa |
|---|---|---|
| Phân Loại Hàng (đang đứng) | **vẫn tên cũ** | **tên mới ngay** |
| Hàng Mua Vào (đi tới) | tên mới | tên mới |

---

## 3. Kiểm chứng

**Phần A:**

- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa:** xoá một đơn vị đang
  bị dùng phải trả câu tiếng Việt có **tên đơn vị** và **tên mặt hàng đang dùng**.
  Hôm nay nó trả tiếng Anh. Nói rõ đỏ vì **giá trị sai** hay **thiếu hàm**.
- **Vẫn phải chặn**: đơn vị đang dùng thì tuyệt đối không được xoá thành công.
- **Xoá một đơn vị KHÔNG ai dùng vẫn phải chạy được** — đừng chặn nhầm.
- **Trả lời A6 trước**: có mẫu dịch lỗi sẵn thì dùng lại.

**Phần B:**

- **Phép kiểm mới, viết trước, phải ĐỎ**: sau khi lưu, trang phải yêu cầu vẽ
  lại. Hôm nay không.
- **Cả hai màn hình chủ quán gặp** đều phải có phép kiểm, không chỉ một.
- **Đếm lại B3 sau khi sửa** và **nói rõ còn bao nhiêu chỗ chưa xử lý**, đừng để
  con số 21 trôi đi.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. Không ghi dữ liệu, không migration, không tự đẩy.

**Rồi chủ quán tự thử đúng hai việc ông ấy vừa làm:** bấm xoá **Combo 2** và đọc
câu báo; sửa một tên phân loại rồi nhìn ngay trên trang đó.
