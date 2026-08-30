# Máy POS đọc bản cũ sau khi sửa món

**Written 2026-08-31 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → mô tả hiện trạng trước.

**Chủ quán gặp lúc 02:25 hôm nay**, một phút sau khi bấm Bán lại.

---

## 1. Hiện trạng

Viết lại 31/08 sau khi chủ quán hỏi quy trình có bị bỏ bước không. **Bản đầu
lấp mục này bằng kết quả điều tra nguyên nhân thay vì liệt kê bề mặt** — và chỗ
thiếu đang che một lỗi thứ hai (§1.4).

### 1.1 Món có ba trạng thái, đặt bằng bốn nút

| Trạng thái | Đặt bằng | Hiện ở màn hình quản lý | Hiện trên POS |
|---|---|---|---|
| `ACTIVE` — đang bán | `saveProduct` (tạo mới), `resumeProduct` | Có, mặc định | **Có** |
| `INACTIVE` — ngừng bán | `pauseProduct` | Chỉ khi lọc "Ngừng bán" | Không |
| `DELETED` — đã xoá | *(không còn nút nào đặt)* | Chỉ khi lọc "Đã xoá" | Không |

**Cỡ có cùng ba trạng thái**, và bốn nút kia đổ theo món xuống cỡ — trừ một chỗ
cố ý: `resumeProduct` chỉ hồi sinh cỡ `DELETED` khi món **không còn cỡ nào** đang
bán; nếu còn ít nhất một cỡ sống thì cỡ đã xoá vẫn nằm im.

### 1.2 Danh sách trên POS chứa gì, loại gì

`app/pos/page.tsx:55-57` giữ **món `ACTIVE`**, **cỡ `ACTIVE`**, cùng nhóm món,
topping và khuyến mãi `ACTIVE`.

**Không có phép kiểm nào hỏi "món này còn cỡ nào không".**

### 1.3 Dữ liệu được nhớ tạm bao lâu, và ai xoá được

`lib/sheets_db.ts:34` đánh nhãn mỗi bảng là `sheets-<TênBảng>`;
`sheets_db.ts:51` cho nhóm bảng danh mục — trong đó có `Products` và
`Product_Variants` — sống **600 giây, tức 10 phút**.

| Ai xoá được | Xoá cái gì |
|---|---|
| `revalidatePath("/admin/products")` — bốn nút trên màn hình Sản phẩm | **Chỉ màn hình Sản phẩm** |
| Nút **"Xoá Cache"** trong menu (`app/admin/clear-cache/page.tsx`) | `sheets-Products`, `sheets-Product_Variants`, `sheets-Recipes`, `sheets-Product_Price_History` — **đúng thứ cần** |
| Tự hết hạn | Sau 10 phút |

### 1.4 Hai lỗi, không phải một

**Lỗi A — sửa món không báo cho POS.** Bốn nút chỉ làm mới đường dẫn màn hình
Sản phẩm, trong khi bộ đệm đánh nhãn theo **tên bảng**. Nên POS giữ bản cũ tới
10 phút. Đúng chuyện chủ quán gặp: `Test1` được bán lại lúc **02:24:58**, dữ
liệu đã đúng (`VAR-060`, 500ml, 10.000đ, `ACTIVE`), mà POS lúc **02:25** vẫn báo
chưa có cỡ.

**Bản vá đã tồn tại sẵn trong hệ thống** — nút "Xoá Cache" gọi đúng hai nhãn cần
gọi. Nó chỉ đang nằm dưới dạng **một nút chủ quán phải nhớ bấm**, thay vì chạy
tự động lúc sửa món.

**Lỗi B — POS mời bấm vào món không bán được.** Vì §1.2 không kiểm món còn cỡ
hay không, một món `ACTIVE` mà mọi cỡ đều `DELETED`/`INACTIVE` **vẫn nằm trong
danh sách**, và chỉ báo *"Món này chưa cấu hình kích cỡ & giá"* **sau khi nhân
viên đã bấm** — giữa ca, trước mặt khách.

**Hai lỗi độc lập.** Hôm nay chúng trùng nhau nên trông như một: dữ liệu `Test1`
đã đúng, chỉ màn hình cũ. Nhưng một món **thật sự** hết cỡ thì POS vẫn mời bấm
rồi mới từ chối. Sonnet đã vá đúng chuyện này ở **màn hình quản lý** hôm 30/08
(dòng *"Không có size nào đang bán"*); màn hình POS không được vá cùng lúc vì
lúc đó không ai liệt kê nó ra.

### 1.5 Không phải lỗi riêng của màn hình Sản phẩm

Đo 31/08: **20 file dùng `revalidatePath`, 3 file dùng `revalidateTag`.** Hai
trong ba file kia là kho và đơn nhập — nhiều khả năng đã dính rồi sửa riêng, mà
không ai rút thành luật chung.

### 1.6 Chữ "Cỡ"

Chủ quán muốn đổi thành **"Size"**: bảng danh sách món (`ProductsClient.tsx`),
khung chọn món trên POS (`ItemConfigModal.tsx`), câu cảnh báo trong
`POSScreen.tsx`, và màn hình sửa món (`ProductForm.tsx`, cả tiêu đề *"Các Kích
Cỡ"*).

### 1.7 Chỗ tôi CHƯA xem

- **18 file `revalidatePath` còn lại** — chưa đo cái nào có màn hình thứ hai đọc
  cùng bảng. Có thể phần lớn vô hại.
- **Máy POS có tự làm mới khi quay lại tab không** — chưa xem, và nó quyết định
  nhân viên có phải tải lại trang bằng tay hay không.
- **Bốn nút kia có đổ trạng thái xuống topping không** — món và cỡ thì có, chưa
  kiểm topping.

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
