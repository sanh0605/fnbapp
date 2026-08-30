# Máy POS đọc bản cũ sau khi sửa món

**Written 2026-08-31 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → mô tả hiện trạng trước.

**Chủ quán gặp lúc 02:25 hôm nay**, một phút sau khi bấm Bán lại.

---

## 1. Hiện trạng — mô tả để chủ quán bác

### 1.1 Chuyện đã xảy ra

Chủ quán bấm **Ngừng bán** rồi **Bán lại** món `Test1`. Mở máy POS, chọn món, và
màn hình báo **"Món này chưa cấu hình kích cỡ & giá."**

**Dữ liệu đúng.** Đo 31/08: `VAR-060`, cỡ 500ml, giá 10.000đ, trạng thái
**ACTIVE**, sửa lúc **02:24:58** — đúng lúc ông ấy bấm Bán lại. Bản vá
`resumeProduct` hôm qua chạy chính xác.

**Màn hình sai.** Máy POS lúc 02:25 vẫn đang đọc bản chụp cũ.

### 1.2 Vì sao

Hệ thống lưu đệm dữ liệu theo **tên bảng**: `lib/sheets_db.ts:34` đặt nhãn
`sheets-<TênBảng>`, nên danh sách món mang nhãn `sheets-Products` và
`sheets-Product_Variants`.

Nhưng cả bốn hành động trên màn hình Sản phẩm — `saveProduct`, `pauseProduct`,
`resumeProduct`, `eraseProduct` — đều gọi `revalidatePath("/admin/products")`,
tức **chỉ làm mới đúng màn hình chúng đang đứng**. Máy POS đọc cùng bảng đó
nhưng ở đường dẫn khác, nên **không được báo là dữ liệu đã đổi**.

**Sửa món ở màn hình quản lý không nói cho màn hình bán hàng biết.**

### 1.3 Đây không phải lỗi riêng của màn hình Sản phẩm

Đo 31/08: **20 file dùng `revalidatePath`, 3 file dùng `revalidateTag`.**

Hai trong ba file kia là kho và đơn nhập — nhiều khả năng đã bị đúng lỗi này
trước đây rồi sửa riêng. **Phần còn lại vẫn theo lối cũ.**

### 1.4 Chữ "Cỡ"

Chủ quán muốn đổi thành **"Size"**. Hiện xuất hiện ở: bảng danh sách món
(`ProductsClient.tsx`), khung chọn món trên POS (`ItemConfigModal.tsx`), câu
cảnh báo trong `POSScreen.tsx`, và màn hình sửa món (`ProductForm.tsx`, cả nhãn
"Các Kích Cỡ").

### 1.4b Màn hình POS — phần tôi BỎ SÓT, và nó che một lỗi thứ hai

**Chủ quán hỏi 31/08 rằng kế hoạch này có bỏ bước nào không. Có.** Mục 1b bắt mô
tả tối thiểu năm thứ; bản đầu của kế hoạch này chỉ làm hai — cơ chế bộ nhớ đệm
và danh sách chỗ chưa xem. Thiếu hẳn phần **"màn hình POS hiện danh sách gồm gì,
loại gì ra"**.

Viết bù, và nó lòi ra ngay:

`app/pos/page.tsx:55-57` lọc **món** `status === "ACTIVE"` và **cỡ**
`status === "ACTIVE"` — **nhưng không bao giờ kiểm một món có còn cỡ nào không.**

Nên **một món đang bán mà không còn cỡ nào vẫn nằm trong danh sách POS**, và chỉ
báo *"Món này chưa cấu hình kích cỡ & giá"* **sau khi nhân viên đã bấm vào** —
giữa ca, trước mặt khách.

**Đây là lỗi thứ hai, độc lập với chuyện bộ nhớ đệm.** Hôm nay hai lỗi trùng
nhau nên trông như một: dữ liệu của `Test1` đã đúng, chỉ màn hình cũ; nhưng nếu
một món **thật sự** không còn cỡ nào thì POS vẫn mời bấm vào rồi mới từ chối.

**Sonnet đã vá đúng chuyện này ở màn hình quản lý hôm 30/08** — dòng cảnh báo
*"Không có size nào đang bán"*. Màn hình POS không được vá cùng lúc, vì lúc đó
không ai liệt kê nó ra.

**Thêm vào thay đổi:** POS loại món không còn cỡ đang bán. Một món không bán
được thì không nên mời bấm.

### 1.5 Chỗ tôi CHƯA xem

- **18 file `revalidatePath` còn lại** — chưa kiểm cái nào cũng có màn hình thứ
  hai đọc cùng bảng. Có thể phần lớn vô hại; chưa đo.
- **`app/api/revalidate/route.ts`** — chưa đọc nó làm gì, và có phải là đường
  làm mới thủ công đang bù cho lỗi này không.
- **Thời hạn tự hết hạn của bộ đệm** — chưa đo mỗi nhãn sống bao lâu, nên chưa
  biết chủ quán phải chờ bao lâu thì nó tự đúng.
- **Nút "Xoá bộ nhớ đệm"** trong menu — chưa xem nó xoá gì.

## 2. Thay đổi

1. **Bốn hành động trong `app/admin/products/actions.ts` gọi thêm
   `revalidateTag("sheets-Products")` và `revalidateTag("sheets-Product_Variants")`**,
   giữ nguyên `revalidatePath` đang có. Làm mới theo **bảng**, không theo màn
   hình — vì cái đọc là bảng.
2. **Đổi "Cỡ" thành "Size"** ở bốn chỗ §1.4. Chỉ chữ hiển thị, không đụng tên
   cột `size_name` trong dữ liệu.

**Không sửa 18 file kia.** Chúng là cùng một kiểu sai nhưng chưa đo được cái nào
thật sự hỏng, và sửa mù 18 chỗ trên đường tiền là đổi nhiều hơn cần thiết. Ghi
thành mục việc riêng.

## 3. Kiểm chứng

- **Viết phép kiểm trước, đỏ vì GIÁ TRỊ**: gọi `resumeProduct` phải làm mới nhãn
  `sheets-Products`. Hôm nay nó chỉ làm mới đường dẫn. Nói rõ đỏ vì giá trị hay
  vì thiếu hàm.
- **Cả bốn hành động đều phải có**, không chỉ `resumeProduct` — ba cái kia hỏng
  y hệt, chỉ là chủ quán chưa gặp.
- **Chữ cũ không còn sót**: tra `Cỡ`/`cỡ` trong `app/` và `components/` phải ra
  0, trừ chỗ nào là tên biến.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. Không tự đẩy. **Rồi chủ quán ngừng bán một món, mở POS xem nó
biến mất chưa, bán lại, mở POS xem nó về chưa — không tải lại trang, không chờ.**
Đó đúng là việc vừa hỏng.
