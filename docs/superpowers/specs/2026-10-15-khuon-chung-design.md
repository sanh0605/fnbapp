# Khuôn chung cho mọi trang quản trị (6c): thiết kế

Trạng thái: viết 2026-10-15. Các lựa chọn trong bản này **chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15** (*"Đúng, làm vậy"*); chủ quán xem lại cả mẻ lúc tổng kết.

Nguồn:
- Kế hoạch chung, hàng 6c: thống nhất một khuôn, rồi soát mọi trang theo cùng một luật; trang nào có cách làm tốt hơn thì đề xuất (chủ quán 2026-10-14).
- Đề xuất nền tảng `docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md`: chốt khuôn chung một lần trước khi vẽ mảng Bán hàng.
- Khuôn đã có, bản này không viết lại:
  - danh sách, chi tiết, sửa: `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md`;
  - từng thành phần (nút, ô số, bảng, hộp tổng, đầu trang): `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md`;
  - luật `BR-UI-001` đến `BR-UI-014` trong `docs/02-rules/business-rules/screens.md`, `BR-DATA-007`, `BR-DATA-008`.
- Hệ thống lớn đã tra (2026-10-15):
  - Shopify Polaris, khuôn trang danh sách và trang chi tiết: https://shopify.dev/docs/api/app-home/patterns/templates/resource-index, https://shopify.dev/docs/api/app-home/patterns/templates/details. Thanh lưu chỉ hiện khi có thay đổi, chữ nút một động từ ("Save", "Discard"): https://polaris.shopify.com/components/deprecated/contextual-save-bar.
  - KiotViet FnB, Kiểm kho: lọc và tìm theo mã hoặc tên; tạo phiếu là màn riêng, không phải khung bật; thẻ Tất cả / Khớp / Lệch / Chưa kiểm: https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-hang-hoa/kiem-kho/.
  - Square, sửa món: trường hay sửa đưa lên đầu trang: https://squareup.com/help/au/en/article/8335-create-and-edit-items. Báo cáo: chọn khoảng ngày rồi so theo ngày, tuần, tháng: https://squareup.com/help/ca/en/article/5072.
  - Toast, báo cáo: thanh lọc trên đầu (khoảng thời gian, điểm bán), bảng bên dưới: https://support.toasttab.com/en/article/Getting-Started-with-Analytics-and-Reports.

## 1. Hiện trạng: năm câu

Đo 2026-10-15 trên nhánh `chore/next-16`, 106 file `page.tsx` trong `app/admin`.

1. **Trạng thái.** Không có dữ liệu mới. Khuôn biết sáu kiểu trang: danh sách (33), chi tiết (25), tạo (21), sửa (22), trang việc riêng như Huỷ phiếu, và báo cáo (3, cộng Tổng quan). Ô nhập có ba trạng thái hiển thị như khuôn 2026-10-07. Trang tạo và sửa thêm một trạng thái mới: **có thay đổi chưa lưu**.
2. **Nút.**
   - Danh sách, chi tiết: theo khuôn 2026-10-02, đã dựng.
   - Tạo, sửa: chữ nút cuối form không thống nhất. Đếm trên mã nguồn: "Bỏ" 27, "Tạo" 20, "Cập nhật/Tạo" 4, "Cập nhật/Lưu" 3, "Lưu" 3, cùng "Lưu món", "Lưu thông tin", "Lưu Nhân Sự", "Lưu Thương Hiệu", "Lưu Quy Đổi". Ba chữ cuối viết hoa từng từ, trái `BR-UI-013`.
   - Nút lưu luôn nằm cuối form. Form dài (Món 358 dòng, Phiếu nhập, Khuyến mãi) phải cuộn hết mới thấy nút. 0 trang có thanh lưu đứng yên.
3. **Danh sách.** 16 trên 33 trang danh sách có ô tìm. 20 file dùng `EmptyState`; chưa có luật phân biệt "chưa có gì" với "lọc không ra".
4. **Ô nhập.** Không áp dụng: luật ô nhập đã chốt ở khuôn 2026-10-07 và `BR-UI-008`. Bản này không đổi ô nào.
5. **Phục vụ gì, cố ý không phục vụ gì.** Phục vụ mọi trang `app/admin`. Cố ý không đụng máy bán hàng (`app/pos`, có khuôn riêng), trang đăng nhập, trang lỗi. Không tạo bảng, không migration, không đổi server action.

Thêm cho việc này:

6. **Bản này khác các khuôn trước ở đâu?** Khuôn 2026-10-02 và 2026-10-07 lo danh sách, chi tiết và từng thành phần. Còn hở ba chỗ: chân form tạo/sửa, ô tìm cùng trang trống, và vỏ trang báo cáo. Bản này lấp ba chỗ đó và gom mọi luật về một bảng soát (mục 4) để mỗi mảng dùng.
7. **Cái gì của hệ thống lớn cố ý không lấy?**
   - Trang chi tiết hai cột của Shopify (cột phải: trạng thái, tóm tắt). Chủ quán đã chốt một cột ngày 2026-10-02 ("3a"); không mở lại.
   - Hỏi khi rời trang lúc chưa lưu. Shopify chặn rời trang; ở đây phải dùng hộp của trình duyệt, trái `BR-DATA-007` ("no browser dialog"). Thay bằng dòng chữ "Có thay đổi chưa lưu" trên thanh lưu (mục 2.1).
   - Tải báo cáo ra file (Toast, Square). Chủ quán chưa hỏi, chưa ai cần; hỏi lại khi có người làm sổ sách cần.
   - Sửa ngay tại trang chi tiết như Shopify. Trang sửa `/[id]/edit` dựng giống hệt trang chi tiết nên người dùng thấy như nhau; không viết lại.

Đã xem: ba bản khuôn trước, `screens.md`, `BR-DATA-007`, `ProductForm.tsx`, `PhoneNavBar.tsx`, `app/admin/layout.tsx`, các phép kiểm canh trong `components/ui/`, ba trang báo cáo (chỉ thành phần dùng). Chưa xem: bên trong từng form tạo/sửa ngoài Món; từng danh sách có quá 20 dòng hay không (mỗi mảng đo khi soát); trang Tổng quan.

## 2. Ba khuôn mới

### 2.1 Chân form tạo và sửa (`BR-UI-015`)

Một thành phần chung `FormActionBar` trong `components/ui/`, đặt cuối mọi form tạo và sửa.

- **Chữ nút cố định theo kiểu trang**, trang không tự đặt:

  | Trang | Nút chính | Nút phụ |
  |---|---|---|
  | Tạo | "Tạo" (`BR-UI-002`) | "Bỏ" |
  | Sửa | "Lưu thay đổi" | "Bỏ thay đổi" |

  Trang có việc riêng giữ chữ của việc đó: "Ghi phiếu", "Xác nhận huỷ", "Lưu nháp". Đang gửi thì nút chính hiện "Đang lưu…" và không bấm lại được.
- **Thanh đứng yên ở đáy màn hình** khi form dài hơn màn hình (giống thanh lưu Shopify, nhưng luôn hiện): nền trắng, đường kẻ trên. Form ngắn thì thanh nằm ngay dưới ô cuối, không cách xa.
  - Máy tính: nút canh phải, nút chính ở ngoài cùng bên phải.
  - Điện thoại: hai nút chia đôi bề ngang, nút chính bên phải; thanh nằm trên thanh menu đáy (`PhoneNavBar`), không che nó.
- **"Có thay đổi chưa lưu"**: khi người dùng gõ hay chọn bất kỳ ô nào trong form, bên trái thanh hiện dòng chữ xám này. Không hỏi, không chặn rời trang (mục 1, câu 7).
- **Báo lỗi sau khi bấm lưu** vẫn nằm ngay trên thanh (`Alert`), như hôm nay.

Ví dụ: trang Sửa món "Cà phê sữa đá". Cuộn giữa danh sách size, thanh dưới đáy vẫn hiện "Bỏ thay đổi" và "Lưu thay đổi". Đổi giá size 500ml từ 20,000 thành 22,000 thì bên trái thanh hiện "Có thay đổi chưa lưu".

### 2.2 Ô tìm và trang trống ở danh sách (`BR-UI-016`)

- **Ô tìm**: danh sách nào có thể dài quá một trang (20 dòng) thì có ô tìm theo mã hoặc tên, đứng đầu khung lọc, nằm trên địa chỉ trang như các ô lọc khác. Danh sách ngắn cố định (Điểm bán, Thương hiệu, Đơn vị tính) không cần. Mỗi mảng đo số dòng thật khi soát.
- **Hai kiểu trống**, như Shopify:
  - Chưa có dòng nào: "Chưa có … nào" kèm nút "Tạo" (nếu người xem được tạo).
  - Có dòng nhưng lọc không ra: "Không có dòng nào khớp bộ lọc" kèm "Xoá lọc" (khuôn 2026-10-02).

### 2.3 Vỏ trang báo cáo (`BR-UI-017`)

Thứ tự từ trên xuống, giống Toast và Square:
1. `PageHeader`: tên báo cáo.
2. Thanh lọc: khoảng ngày (`BR-UI-007`), điểm bán nếu báo cáo tách được theo điểm bán. Lọc nằm trên địa chỉ trang.
3. Hộp tổng (`MoneySummary` hoặc thẻ số chính) cho con số quan trọng nhất của khoảng đã chọn.
4. Bảng chi tiết, có dòng tổng dưới tiêu đề (`BR-UI-004`).

Dựng khi làm mảng Báo cáo (bước 6 của Kế hoạch A), không làm trước.

## 3. Trang mẫu

Thanh `FormActionBar` dựng trước ở **Tạo món và Sửa món**, form dài nhất (358 dòng) và nằm trong mảng Bán hàng, mảng làm kế tiếp. Chủ quán xem trên trang thật lúc đẩy. Các trang tạo/sửa khác chuyển sang thanh này khi mảng của chúng được soát.

Phép kiểm canh `components/ui/form-action-bar.guard.test.ts`, cùng kiểu `template.guard.test.ts`: mọi trang tạo và sửa trong `app/admin` dùng `FormActionBar`; danh sách file còn nợ chỉ được ngắn đi.

## 4. Bảng soát cho từng mảng

Mỗi mảng (Bán hàng, Kho, Thu chi, Báo cáo, Máy bán hàng) soát mọi trang của mình theo bảng này, ghi kết quả vào kế hoạch của mảng. Cột "Canh bằng" cho biết luật nào đã có phép kiểm tự đỏ, luật nào phải nhìn bằng mắt.

| Kiểu trang | Luật | Canh bằng |
|---|---|---|
| Mọi trang | Chữ tiếng Việt (`BR-UI-001`); tên viết hoa chữ đầu (`BR-UI-013`); khung tối đa 1,280px (`BR-UI-012`); không khung bật (`BR-DATA-007`); số viết `1,250.5` (`BR-UI-008`); hai bố cục máy tính và điện thoại | `spelling`, `page-title`, `page-width`, `no-popups`, `format` guard; bố cục: mắt, ba cỡ 1568/1024/390px |
| Danh sách | Đầu trang + nút "Tạo"; khung lọc; bảng/thẻ; bấm dòng mở chi tiết; sắp theo mã giảm dần (`BR-DATA-008`); 20 dòng một trang; dòng tổng (`BR-UI-004`); dòng không in đậm (`BR-UI-003`); ô tìm và hai kiểu trống (`BR-UI-016`) | `template`, `list-rows`, `list-totals`, `table-head`, `filter-fields` guard; ô tìm: mắt |
| Chi tiết | `DetailHeader` (quay lại, tên, trạng thái, Chỉnh sửa, Xoá/Ngừng dùng); một cột nhãn–giá trị; bảng liên quan bên dưới | mắt |
| Tạo, sửa | Ô theo khuôn 2026-10-07 (`Field`, `NumberInput`, `MoneyInput`, `SearchableSelect`); hai ô một hàng trên máy tính (`BR-UI-014`); ví dụ mờ (`BR-UI-009`); lỗi dưới ô; `FormActionBar` (`BR-UI-015`) | `form-columns`, `placeholder`, `form-action-bar` guard |
| Việc riêng (Huỷ, Thanh lý) | Khuôn Huỷ phiếu nhập: tóm tắt bên trái, lý do và nút xác nhận bên phải; điện thoại một cột | mắt |
| Báo cáo | Vỏ `BR-UI-017` | mắt |

Mỗi mảng còn tra một hệ thống lớn cho đúng loại trang của mình và đề xuất làm lại nếu thấy cách tốt hơn, như hai bản đề xuất Bán hàng và Kho đã làm.

## 5. Ai làm

| Việc | Ai |
|---|---|
| `FormActionBar`, gắn vào Tạo món và Sửa món, test | Gemini (giao diện) |
| Phép kiểm canh `form-action-bar.guard.test.ts`, luật `BR-UI-015` đến `BR-UI-017`, soát | Opus |

Không có phần máy chủ.

## 6. Kiểm thế nào

- `FormActionBar`:
  - trang tạo hiện "Tạo" và "Bỏ"; trang sửa hiện "Lưu thay đổi" và "Bỏ thay đổi";
  - gõ một ô thì hiện "Có thay đổi chưa lưu"; chưa gõ thì không;
  - đang gửi thì nút chính khoá và hiện "Đang lưu…";
  - "Bỏ" về đúng `returnTo`.
- Test cũ của `ProductForm` vẫn xanh; test nào tìm nút "Lưu món" thì sửa sang chữ mới, nói rõ lý do.
- Phép kiểm canh phải đỏ trên bản chưa sửa (Tạo món, Sửa món chưa dùng thanh) trước khi gạch hai file đó khỏi danh sách nợ.
- Mắt: trang Sửa món ở 1568px, 1024px, 390px; thanh không che thanh menu đáy trên điện thoại.

## 7. Ảnh hưởng chéo

- Nút "Lưu món" đổi thành "Tạo" (trang tạo) và "Lưu thay đổi" (trang sửa). Nhân viên quen chữ cũ cần biết.
- Thanh đứng yên chiếm khoảng 64px đáy màn hình điện thoại, trên thanh menu đáy. Trang tạo/sửa trên điện thoại ngắn đi bấy nhiêu chỗ nhìn.
- Máy bán hàng không đổi.
