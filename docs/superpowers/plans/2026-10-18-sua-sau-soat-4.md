# Sửa sau soát 4 (chụp toàn trang, 2026-10-18)

Nguồn: bốn báo cáo soát ảnh `.worktrees/audit4-review-{d,p,d2,p2}.md` (Opus, mỗi agent một phần), ảnh `.worktrees/shots/audit4/` và `.worktrees/shots/pos4/`. Opus mở lại ảnh của các mục cao và vừa trước khi đưa vào phiếu. Kế hoạch này thay mục "Kiểm" cuối của `2026-10-18-soat-kho-ban-hang.md`: "Mọi lỗi còn lại sửa tiếp trong cùng đợt."

Đã xem: bốn báo cáo; ảnh Phiếu xuất, Nhóm tuỳ chọn, máy bán hàng 6 cỡ; `DataList`, `NumberInput`, `FilterCard`, `ItemPicker`, `PromotionDetailView` + `page.tsx`, `IssueSlipsClient`, `CashBookClient`, `CategoryForm`; luật `screens.md` (BR-UI-005…019), `cash-book.md`. Chưa xem: từng ảnh mục thấp (dựa vào báo cáo, kiểm lại khi chụp sau sửa).

## Hiện trạng

1. **Trạng thái:** không áp dụng, vì không thêm trạng thái nào; chỉ sửa cách hiện.
2. **Nút:** không thêm nút. Đổi chỗ hai nút ở bốn trang huỷ cho cùng một kiểu (Quay lại trái, Xác nhận huỷ phải, như thanh nút cuối form `BR-UI-015`).
3. **Danh sách:** không đổi cái gì vào, cái gì ra. Chỉ đổi độ rộng cột, dòng điện thoại, chữ.
4. **Ô nhập:** không đổi khoảng nhận. Chỉ: ô số có đơn vị dài ("miếng") không còn đè số; ô chọn chưa chọn hiện chữ xám như ô gõ; giờ mở/đóng cửa điểm bán thành ô chọn 30 phút một bước thay ô giờ của trình duyệt.
5. **Dữ liệu:** không ghi gì. Không đụng cách tính số. Không đổi nhãn mà luật đã chốt.

## Không sửa (luật, dữ liệu, máy thử)

- Ngày giờ đủ giây, kể cả 00:00:00 (BR-DATA-006). Vì vậy không theo gợi ý "bỏ giây cho dòng gọn".
- Dòng điện thoại có dòng 2 tối đa hai dòng (BR-UI-018): dòng 87 px là đúng luật. Chỉ sửa dòng 2 dài quá hai dòng, hay chữ bị cắt.
- "Bộ lọc" (mở thêm lọc) và "Lọc" (áp dụng) là hai nút khác việc (BR-UI-018).
- Lãi lỗ trên điện thoại giữ thẻ tháng (BR-UI-019).
- Viết tắt "TB", "SL", "Nhóm SP": chờ bảng viết tắt chủ quán tự sửa (BR-UI-006, chưa làm).
- Mã nhỏ chữ nâu đơn cách ở cột Mã: kiểu chung.
- Ô "Tính là doanh thu bán hàng" chỉ hiện khi Bên = Thu và tính lãi lỗ: đúng luật.
- "Giá áp dụng" ở khuyến mãi đồng giá là giá bán thật; chỉ sai nhãn ở loại giảm % và giảm tiền.
- Dữ liệu: PRM-004 kết thúc 12:59, mã SUP-001, tên tài khoản "ADMIN".
- Máy thử: huy hiệu "N" của Next.js, thẻ "Góp ý".

## Để sau, ghi vào kế hoạch chung (làm lại cả phần, không phải sửa nhỏ)

- Khuyến mãi, ô chọn món: trang dài ~7.000 px, mỗi size một ô, lồng bốn lớp. Cần tìm món và gập nhóm. Lần này chỉ thay biểu tượng emoji và sửa nhãn "Đã chọn" bị ép.
- Doanh số: cột không có số, bỏ giờ không bán, ngày không bán. Lần này chỉ sửa chữ chồng, tiêu đề, cuộn lồng.
- Topping, công tắc "Bán độc lập" lưu ngay trong một form có nút Lưu: đổi cách lưu là việc máy chủ.
- Máy bán hàng 1024×600: khung chọn món chỉ thấy 1,5 nhóm. Ẩn lưới món khi mở khung là đổi việc một lần chạm làm, cần chủ quán duyệt bằng ví dụ.

## Phiếu (Gemini `gemini-3.8-flash-high`, lần lượt, mỗi phiếu một worktree)

### G4 — Ngày giờ đủ giây (BR-DATA-006)

Mọi ngày hiển thị ngoài bộ lọc dùng `formatDateTimeFull` (`lib/shared/datetime.ts`). Chỗ còn sai: ActivityLogClient:362; BrandsClient:107, 220; BrandDetailView:60; CashBookClient:228, 614 (448/450 là khoảng lọc, giữ); CashTransferDetailView:89, 107; CashEntryDetailView:65, 96, 107, 134; StockOnHandClient:145, 232; OutletsClient:162, 319; OutletDetailView:118, 122; PromotionsClient:69; PromotionDetailView:47; reports/issued EventCard:18 và page:194; UsersClient:137, 288; UserDetailView:37. Máy bán hàng giữ ngày hôm nay ở đầu màn hình (kiểu riêng của máy bán hàng). Kèm phép canh: `formatDate(` / `formatDateTime(` trong `app/` và `components/` chỉ được ở chỗ trong danh sách cho phép (nhãn bộ lọc, máy bán hàng).

### G5 — Phần dùng chung

- `DataList`: chữ dòng tổng trải qua các cột trống đầu (colSpan) thay vì nới cột 1. Phiếu nhập ở 1280 thấy lại cột Tổng tiền; Tài sản không còn ép cột Tên.
- `NumberInput`: chỗ cho đơn vị rộng theo độ dài chữ; "miếng" không đè số.
- `Select`, `SearchableSelect`: khi chưa chọn, chữ màu xám như chữ ví dụ của ô gõ.
- Ô tích và nút tròn: màu nâu của quán (`accent-color`), không xanh trình duyệt.
- `FilterCard`: nút "Lọc" cùng hàng với ô cuối khi đủ chỗ; cỡ chữ như ô nhập.
- `ListPagination`: một kiểu; có "trang x/y".
- `BackLink`: vùng bấm 44 px trên điện thoại.
- Trang sửa trên điện thoại: thẻ form không kéo cao bằng màn hình, không có thanh cuộn thừa.
- Trang "Tạo …": dòng quay lại và tiêu đề cùng chỗ với trang chi tiết, trang sửa.

### G6 — Kho, Nhập hàng

- Tồn kho: số và đơn vị không tách dòng ("42,000 g", "khoảng 120 ngày"). Điện thoại: dòng 2 tối đa hai dòng.
- Kiểm kê: danh sách điện thoại, ngày không bị số tiền cắt. Trang hoàn tác: bảng rộng hết khung trên máy tính; điện thoại dùng dòng gọn như trang chi tiết; bỏ "(BR-INV-009)" khỏi chữ cho chủ quán; tiêu đề không ngắt giữa mã; ghi rõ hai mốc giờ ("Tạo lúc", "Xác nhận lúc"). Trang đếm: có dòng quay lại; "Thiếu 500 g" có đơn vị; dòng khớp ghi "Khớp". Trang chi tiết: đơn vị không rơi một mình; ô tìm có nhãn; mã phiên cùng kiểu chữ.
- Phiếu xuất: bỏ cột "Loại" luôn trống, huy hiệu "Đã huỷ" đặt cạnh mã. Tạo phiếu: nút lưu không xuống dòng; "Đã điền đủ" nằm gần các dòng. Huỷ phiếu: đầu trang không treo dấu chấm, không thẻ trong thẻ.
- Hàng hoá: lịch sử nhập có "đ", cùng màu, mã phiếu canh trái. Sửa: một quy đổi trên một dòng, không thẻ lồng. Danh sách điện thoại: nhãn phải ngắn để tên không bị cắt. Danh sách máy tính: Quy đổi cùng cỡ chữ. Tạo mới: dòng gợi ý "chọn phân loại để hiện thêm ô".
- Quy đổi: Hệ số canh phải. Phân loại hàng: huy hiệu "Vật tư" màu trung tính, không lặp tên; "Xem hàng hoá" vùng bấm 44 px; trang sửa có gợi ý Đặc tính như trang tạo. Đơn vị: không lặp ví dụ dưới ô.
- Tài sản thanh lý: ô "Sẽ ghi nhận chi phí" trung tính, chỉ hiện số khi đã nhập.
- Thời hạn khấu hao, sửa: bỏ khoảng trống đầu thẻ.
- Phiếu nhập: tiêu đề nhóm "NHẬP HÀNG"; điện thoại bỏ chữ "Mua ngoài" lặp mỗi dòng; tạo phiếu: ví dụ "Ví dụ: 5,000" ở phí vận chuyển và voucher, ô đủ rộng, hình thức thanh toán nằm trong thẻ Thanh toán, mũi tên dùng biểu tượng chung; chữ trạng thái "Hoàn thành" giống danh sách; trang huỷ: thẻ thanh toán như trang chi tiết.
- Bốn trang huỷ (phiếu nhập, phiếu xuất, kiểm kê, đơn hàng): "Quay lại" trái, "Xác nhận huỷ" phải.

### G7 — Bán hàng

- Nhóm tuỳ chọn: cột Tuỳ chọn lấy chỗ trống, không cuộn ngang ở 1280. Sửa/tạo: nhóm món là tiêu đề, không thẻ ba lớp; tên món xuống dòng thay vì cắt.
- Tiêu đề nhóm "BÁN HÀNG" cho Nhóm món, Loại món, Nhóm tuỳ chọn, Topping & tuỳ chọn.
- Đơn hàng: trang huỷ có "—" ở Tuỳ chọn trống; trang chi tiết có "·" giữa giờ và thương hiệu, dòng món điện thoại thẳng hàng.
- Trang sửa: tiêu đề "Chỉnh sửa" ở bốn trang còn "Sửa …"; dòng phụ là tên.
- Món tạo, Nhóm tuỳ chọn tạo: có dòng phụ như mọi trang tạo. Mã không hiện hai lần (dòng phụ và dòng "Mã"); chi tiết không nói một ý hai lần. "Mở tuỳ chọn →" không xuống dòng.
- Loại món: ô tích cỡ chuẩn, cả dòng bấm được.
- Một kiểu huy hiệu trạng thái ("Đang dùng", "Đang bán").
- Khuyến mãi: danh sách không cuộn ngang ở 1280; điện thoại 360 dòng 2 tối đa hai dòng. Chi tiết: nhãn cột theo loại ("Mức giảm" hay "Giá đồng giá"), không hiện trạng thái hai lần. Tạo/sửa: ví dụ tiếng Việt, phần "để trống nếu tự động" thành dòng gợi ý, "Toàn hệ thống" ngắn, tiêu đề phần đậm như nhãn; ngày kết thúc mặc định 23:59 của ngày thứ 7; biểu tượng thay emoji; "Đã chọn: 14 mục" không bị ép.

### G8 — Thu chi

- Sổ thu chi: bảng không cuộn ngang ở 1280 (cột Mã hẹp, Nhóm và Cách trả không xuống dòng). Chữ cảnh báo viết hoa đầu câu. Thẻ đang chọn không giống nút "Tạo". Điện thoại: nhãn tiền mặt thẳng hàng, số không dính nhau ở 360, các thẻ tóm tắt gọn hơn, dải tổng không ngắt giữa "Thu" và số.
- Danh mục thu chi: dòng điện thoại có nhãn ("Thu · Tính lãi lỗ"); dòng ô tích bấm được cả dòng.
- Nút trang chi tiết: "Ngừng dùng" cùng kiểu ở mọi trang; nút xoá cùng một chữ.
- Khoản hằng tháng: "0 dòng" có nhãn; "Tạo" không rơi xuống dòng ở 360. Danh sách xếp theo mã thì hiện mã.

### G9 — Báo cáo, Tổng quan

- Lãi lỗ máy tính: bảng tháng mở sẵn ở các tháng mới nhất. Ô trống một kiểu "–"; chú thích dấu "*"; số chú thích dễ đọc; "Luỹ kế" viết hoa. Điện thoại: chú thích 2 không nói tới dòng không có.
- Hàng đã xuất điện thoại: cột đầu tối đa ~150 px, chữ xuống dòng; số nguyên không có ".00"; tổng không màu đỏ; tab không vỡ chữ.
- Doanh số: nhãn giờ không chồng nhau; tiêu đề không ép bên cạnh tab; viết hoa chữ đầu câu; chú giải và "Top món - Nước" không cuộn trong trang; ô bảng giờ không cắt "48…"; "Trước giảm giá… • Giảm giá…" xuống dòng gọn; ghi "đơn vị: đồng".
- Tổng quan: ghi "đơn vị: đồng"; bảng 7 ngày ở 360 cột đầu hẹp lại; nút "Cài đặt Tổng quan" 48 px trên điện thoại.

### G10 — Còn lại

- Điểm bán: tiêu đề cột, mã không vỡ dòng; giờ mở/đóng là ô chọn 30 phút; bỏ "--" và chữ đơn cách; nút trang chi tiết điện thoại cùng kiểu trang khác; dòng điện thoại "Giờ: chưa đặt".
- Nhân sự: một chữ "nhân viên" trên trang ("Tìm nhân viên", "… nhân viên", "← Nhân viên & quyền", "Mã nhân viên").
- Đổi mật khẩu: có đường về trang quản trị cho quản lý và chủ quán; "máy bán hàng" thay "POS".
- Nhật ký: "Lọc" đứng cuối; điện thoại là dòng hai tầng (BR-UI-018); máy tính dòng gọn; chữ số liệu không viết hoa hết; ví dụ ô tìm đúng kiểu mã đơn.
- Cài đặt Tổng quan: món đã chọn hiện trước; gợi ý dưới nhãn; thanh nút cuối form chung.
- Nhà cung cấp: form hai cột trên máy tính; đường dẫn trong ghi chú bấm được.
- Thương hiệu: mã không hiện hai lần; "Điểm bán 2" trông bấm được.

### G11 — Máy bán hàng (đổi chữ và kiểu, không đổi việc một lần chạm làm)

- Món không phải thức uống: nhóm 1 đọc "Cỡ", thức uống giữ "Cỡ ly" (loại món có `is_drink`).
- Viết hoa chữ đầu thôi: "Hoá đơn", "Đơn mới", "Lưu nháp" (BR-UI-013).
- Dòng topping đã chọn: nút bớt là biểu tượng, vùng bấm 44 px, không phải dấu "-" trơn.
- Khung chọn trên máy tính: thẻ nhóm cao theo nội dung, không kéo trắng.
- Ở 1024: cột nhóm món không ngắt "Cà / phê".
- Độ ngọt, Đá: nút chọn một báo cho máy đọc màn hình như nhóm Cỡ (radio).

## Kiểm

- Mỗi phiếu: Opus chạy `npx tsc --noEmit` và test vùng; soát độc lập (Opus `reviewer`); `npx next build --webpack` trong worktree; gộp; chụp lại trang của phiếu ở 1280×800 và 390×844 (360×780 cho danh sách), xem ảnh.
- Cuối: năm lệnh kiểm ở main; bảng bước | mong đợi | thực tế | ảnh | đạt.

## Review focus

- Dòng tổng `DataList` vẫn thẳng cột ở cả 1280 (cột phụ ẩn) và 1920 (cột phụ hiện).
- Ô số có đơn vị ngắn ("g", "%", "đ") không rộng ra thừa.
- Ngày đủ giây không làm vỡ dòng điện thoại nào thành ba dòng chữ phụ.
- Đổi chữ không làm đỏ test đang tìm chữ cũ: test sửa theo chữ mới, không xoá.
- Máy bán hàng: không đổi việc của bất kỳ lần chạm nào; giỏ, thanh toán, nháp chạy như cũ.
