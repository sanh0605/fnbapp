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

## A4. Lời từ chối KHÔNG hiện ra gì cả — và tôi viết sai chỗ này lúc đầu

**Bản đầu của mục này viết rằng chủ quán nhận một câu tiếng Anh khó hiểu. Sai.**
Ông ấy nói rõ 01/09:

> *"Khi anh bấm xóa thử combo 2 trước lúc em chẩn đoán thì nó đã không hiển thị
> ra lỗi gì cả."*

**Không có câu nào hết.** Bấm Xoá, không có gì xảy ra, không có gì giải thích.

**Chỗ nuốt mất lời báo:** `app/admin/inventory/units/UnitForm.tsx` dòng 70 viết
`await deleteUnit(fd);` — **vứt luôn kết quả trả về**. Máy chủ từ chối,
`deleteUnit` trả về lời từ chối đàng hoàng, và màn hình **không đọc**.

**Đây là kiểu hỏng tệ hơn hẳn câu tiếng Anh.** Câu khó hiểu ít nhất còn cho biết
có chuyện; im lặng thì chủ quán không biết mình vừa bấm có tác dụng hay không —
và dễ bấm lại nhiều lần.

## A4b. Không phải một chỗ — 16 lần gọi trong 12 file

**Đo 01/09.** Gần như **toàn bộ là nút Xoá** — đúng loại thao tác hay bị khoá
ngoại từ chối nhất:

| Màn hình | Hành động bị vứt kết quả |
|---|---|
| Đơn vị | thêm, sửa, **xoá** |
| Phân loại hàng | thêm, sửa |
| Thương hiệu, Nhà cung cấp, Người dùng, Khuyến mãi, Topping, Nhóm món | **xoá** |
| Quy đổi đơn vị, Hàng mua vào | **xoá** |
| Kiểm kê | huỷ kỳ |
| Máy POS | bỏ đơn chờ |

**Nghĩa là mọi nút Xoá trong khu quản trị đều có thể từ chối trong im lặng.**
Chủ quán mới gặp một cái, vì mới thử một cái.

**Con số 16 này đáng tin hơn con số 21 ở §B3**, vì nó tìm đúng một hình dạng
(`await <hành động>(...)` không hứng kết quả) chứ không suy đoán. Nhưng **vẫn
phải kiểm từng cái** — có thể vài chỗ cố ý bỏ qua kết quả vì lý do riêng.

**Có sẵn công cụ để báo:** `UnitForm.tsx` đã nhập `alert` và `confirm` từ
`lib/dialog` và **đang dùng `confirm`** để hỏi trước khi xoá. Chỉ là không dùng
`alert` để báo kết quả. **Dùng lại thứ đã có, đừng viết mới.**

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
| Câu báo | **không có gì cả** | *"Không xoá được đơn vị Combo 2 vì đang được dùng trong 1 dòng quy đổi của Bột cà phê MR.PHIN Robusta Đắk Mil. Xoá dòng quy đổi đó trước."* |

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
  bị dùng phải **hiện một câu** cho người dùng. Hôm nay **không hiện gì** — nên
  phép kiểm này đỏ vì **thiếu hẳn hành vi**, không phải vì chữ sai. Nói rõ.
- **Phép kiểm thứ hai, tách riêng:** câu đó phải chứa **tên đơn vị** và **tên
  mặt hàng đang dùng**, gọi tên thật. Tách ra vì hai thứ này hỏng độc lập —
  gộp lại thì không biết cái nào chưa xong.
- **Đếm lại §A4b sau khi sửa**, nói rõ còn bao nhiêu chỗ vứt kết quả.
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
