# Khuôn dùng chung cho từng thành phần màn hình: thiết kế

Trạng thái: chủ quán duyệt trang mẫu 2026-10-07 (*"Đồng ý"*). Chưa dựng.

Nguồn:
- Luật: `BR-UI-005` (một khuôn cho mỗi thành phần), `BR-UI-003` (dòng danh sách một kiểu), `BR-UI-001` (toàn bộ chữ tiếng Việt), trong `docs/02-rules/business-rules/screens.md`. Ô tiền: `BR-CASH-005` trong `docs/02-rules/business-rules/cash-book.md`.
- Trang mẫu chủ quán đã xem và đồng ý: https://claude.ai/artifact/BqXUcoDTzcV9bHYfGm8Ypu (sáu mục, mỗi mục đặt "Đang có" cạnh "Khuôn đề xuất").
- Chủ quán 2026-10-07, đổi cách viết số (`BR-UI-008`): dấu phẩy chia hàng nghìn và không được gõ; dấu chấm là dấu duy nhất được gõ, cho phần lẻ; ô số có ví dụ mờ; đổi ở mọi chỗ, kể cả báo cáo và máy bán hàng; một hàm chung và một luật cho mọi tính năng sau.
- Chủ quán 2026-10-07, trả lời "Đúng" cho bản hiểu việc gồm: khuôn có nút, ô chữ, ô số, ô tiền, ô chọn, bảng, hộp tổng tiền, đầu trang; ô số theo mẫu ô "Số lượng" trang tạo phiếu xuất; máy bán hàng giữ nguyên; dựng trang mẫu trước rồi mới thay; việc "gắn ô tiền tự thêm dấu chấm vào các màn khác" (xếp sau báo cáo tài chính ngày 11/09/2026) làm luôn trong việc này.
- Khuôn trang đã có: `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md` (danh sách, chi tiết, mảnh dùng chung mục 5). Việc này không đổi bố cục trang, chỉ đổi từng thành phần bên trong.
- Màu: `docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md` mục 3.1, khai trong `app/globals.css`.

## 1. Hiện trạng: năm câu

Đếm 2026-10-07 trên 255 file `.tsx` trong `app` và `components`, không tính test, không tính `app/pos`.

1. **Trạng thái.** Không áp dụng cho dữ liệu, vì việc này không thêm bảng hay trạng thái nào. Mỗi ô nhập có ba trạng thái hiển thị: bình thường, đang chọn (viền nâu), sai (viền đỏ, chữ đỏ dưới ô). Hiện chỉ trang tạo phiếu xuất và ô tiền có trạng thái sai hiện dưới ô; các ô `type="number"` để trình duyệt tự báo.
2. **Nút.** 138 thẻ `<button>` tự vẽ và 41 chỗ dùng `Button` của `components/ui/Button.tsx`. Hai kiểu nút chính tự vẽ lặp nhiều nhất: 18 và 14 lần. Có nút phụ nền `surface-secondary`, tức màu đường kẻ, nên trông như nút bị tắt.
3. **Danh sách.** `DataList` (`components/ui/list/DataList.tsx`) phục vụ 17 trang; 23 file khác tự vẽ `<table>`. Tiêu đề cột có ít nhất 7 kiểu, kiểu phổ biến nhất in hoa, cỡ 11px, nền màu đường kẻ. Chữ đậm trong dòng dồn ở 5 file: Phiếu nhập, Phiếu xuất, chi tiết phiếu xuất, tạo phiếu xuất, Kiểm kê.
4. **Ô nhập.**
   - 24 ô `type="number"`: có mũi tên tăng giảm, lăn chuột làm đổi số, không có dấu chấm hàng nghìn. Không ô nào nhận số âm (mọi `min` là 0 hoặc 1).
   - 23 ô `inputMode` số (`numeric` hoặc `decimal`), mỗi ô tự lọc ký tự theo cách riêng.
   - `MoneyInput` (`components/ui/MoneyInput.tsx`) đúng `BR-CASH-005` nhưng mới dùng ở 2 chỗ: Sổ thu chi và Chuyển tiền.
   - 50 ô chọn thường, 12 ô `SearchableSelect`.
5. **Phục vụ gì, cố ý không phục vụ gì.** Phục vụ mọi trang quản trị trong `app/admin` và trang đổi mật khẩu. Cố ý không đổi khuôn của máy bán hàng (`app/pos`), vì máy đó bấm bằng tay trên màn cảm ứng, có kiểu nút riêng; riêng cách viết số thì máy bán hàng cũng đổi (mục 2.7). Không đổi màu, phông chữ, bố cục trang, chữ hiển thị (trừ chữ tiếng Anh và chữ viết hoa từng từ). Máy chủ chỉ đổi một chỗ: ô tiền (mục 2.7).

## 2. Sáu khuôn

Đúng như trang mẫu. Mỗi khuôn là một thành phần trong `components/ui/`; trang không tự đặt màu, cỡ, viền cho thứ mà khuôn đã lo.

### 2.1 Nút

| Loại | Dùng cho | Hình |
|---|---|---|
| Chính | Việc quan trọng nhất của màn: Tạo, Lưu, Ghi phiếu | Nền nâu `primary`, chữ trắng |
| Phụ | Lọc, Chỉnh sửa, Huỷ bỏ thao tác đang làm | Nền trắng, viền `border`, chữ đen |
| Xoá | Mở việc xoá, huỷ phiếu, ngừng dùng | Nền trắng, viền và chữ đỏ `danger` |
| Xác nhận xoá | Bước cuối của việc xoá, huỷ | Nền đỏ đặc, chữ trắng |
| Quay lại | Về trang trước | Mũi tên kèm chữ, không viền, không nền (`BackLink` hiện có) |

- Mọi nút cao 44px, bo góc như nhau, chữ 14px đậm vừa. Không còn cỡ nhỏ 32px cho nút bấm việc; biểu tượng nhỏ trong dòng bảng (thùng rác) giữ vùng bấm 44px.
- Mỗi màn có nhiều nhất một nút chính đang hiện.
- Trên điện thoại, nút chính ở cuối form trải hết chiều ngang.
- `Button` nhận thêm `href` để vẽ liên kết trông như nút (nút "Tạo" trên danh sách là liên kết). Biến thể `ghost` và `warning` hiện có gộp vào "Phụ" và "Xoá"; `warning` đã cùng màu `danger`.

### 2.2 Ô nhập số và ô nhập tiền

Một thành phần `NumberInput` mới, đặt trong `components/ui/`. Lõi tách chữ số và chèn dấu phẩy nằm ở `lib/shared/money-digits.ts`, mở rộng thêm phần lẻ. Cách viết số theo `BR-UI-008` (chủ quán 2026-10-07): dấu phẩy chia hàng nghìn, dấu chấm cho phần lẻ.

- **Gõ:** chỉ nhận chữ số và một dấu chấm cho phần lẻ. Dấu phẩy do ô tự chèn mỗi ba chữ số: gõ `1250.5` ô hiện `1,250.5`. Dấu phẩy gõ hoặc dán vào thì bị bỏ, như mọi ký tự khác. Dán `1,250.5` ra `1,250.5`, vì dấu phẩy bị bỏ rồi ô tự chèn lại.
- **Ô không có phần lẻ** (ô tiền, ô số nguyên) bỏ cả dấu chấm.
- **Số chữ số lẻ** do trang khai cho từng ô. Gõ quá số đó thì phím bị bỏ, không làm tròn. Ô tiền: 0 chữ số lẻ.
- **Ví dụ mờ trong ô** khi ô còn trống, đúng đơn vị và số chữ số lẻ của ô đó: "Ví dụ: 1,250.5" cho ô số lượng, "Ví dụ: 150,000" cho ô tiền, "Ví dụ: 12" cho ô số nguyên. Trang có thể đưa ví dụ riêng.
- **Bàn phím điện thoại:** bàn phím số; có phím dấu chấm khi ô nhận phần lẻ.
- Hôm nay ô số lượng ở trang tạo và trang sửa phiếu xuất bỏ phím `.`, nên gõ `1.5` thành 15. Khuôn mới sửa luôn chỗ này.
- **Không có mũi tên tăng giảm. Lăn chuột không làm đổi số.**
- **Đơn vị** (`ml`, `g`, `đ`, `%`) đứng cố định ở mép phải trong ô. Số canh phải, chữ số thẳng hàng.
- **Sai thì báo ngay dưới ô, chữ đỏ, viền đỏ.** Không bật cửa sổ (`BR-DATA-007`).
  - Ô bắt buộc để trống: "Cần nhập số."
  - Nhỏ hơn mức thấp nhất trang khai, ví dụ 0 khi phải lớn hơn 0: "Nhập số lớn hơn 0." hoặc "Nhập số từ {min} trở lên."
  - Lớn hơn mức cao nhất trang khai: câu do trang đưa, ví dụ "Vượt tồn hiện tại 3,200 ml." Không có câu thì "Nhập số không quá {max}."
- **Gửi đi:** ô gửi kèm một ô ẩn mang số dạng máy đọc (`1250.5`), như `MoneyInput` đang gửi chữ số trơn. Nhờ vậy máy chủ đọc như cũ, không sửa server action nào. Máy chủ vẫn kiểm lại; ô trên màn chỉ giúp nhập đúng.
- **Dùng được hai cách:** trong form gửi thẳng (có `name`, giá trị ban đầu), hoặc do trang tự giữ giá trị (nhận số, báo số mới mỗi lần gõ), như ô số lượng phiếu xuất đang làm.
- **Không nhận số âm.** Đo 2026-10-07 không ô nào cần.
- `MoneyInput` giữ tên và giữ mọi test hiện có, bên trong dùng `NumberInput` với 0 chữ số lẻ và giới hạn 15 chữ số.

Số chữ số lẻ cho từng loại ô (Opus chọn, giữ cách đang chạy):

| Ô | Chữ số lẻ | Vì sao |
|---|---|---|
| Tiền | 0 | `BR-CASH-005`: tiền là đồng chẵn |
| Ô hiện đang nhận số nguyên (`min="1"`, `step="1"`) | 0 | Giữ như cũ |
| Số lượng hàng (g, ml, cái) | 3 | Đủ cho 0.5 g. Trước khi chốt, đo số chữ số lẻ lớn nhất đang có trong dữ liệu thật của từng cột |
| Hệ số quy đổi | 6 | Đo như trên trước khi chốt |
| Phần trăm | 2, tối đa 100 | Giữ như cũ |

### 2.3 Ô nhập chữ và ô chọn

- Cao 44px, nền trắng, viền `border`, bo góc như nút. Đang chọn: viền nâu.
- Nhãn đặt trên ô, chữ 13px đậm vừa. Gợi ý (ví dụ "Tồn hiện tại: 3.200 ml") đặt dưới ô, chữ xám 12px. Báo sai cũng đặt dưới ô và thay chỗ gợi ý.
- Danh sách chọn dài trên 10 lựa chọn, hoặc lấy từ bảng dữ liệu có thể dài thêm (mặt hàng, nhà cung cấp, món), dùng `SearchableSelect`. Danh sách ngắn, cố định dùng ô chọn thường đã được tô theo khuôn.
- Thêm `TextInput`, `Select`, `Field` (nhãn, ô, gợi ý, báo sai) trong `components/ui/`.

### 2.4 Bảng và dòng danh sách

- **Tiêu đề cột:** chữ thường, xám `text-secondary`, 13px đậm vừa, nền `page`. Bỏ in hoa và giãn chữ.
- **Dòng tổng:** nằm ngay dưới tiêu đề, nền `primary-soft`. Khuôn có sẵn chỗ cho dòng này. Cột nào được cộng và cộng theo bộ lọc ra sao là việc riêng (`BR-UI-004`, phần 1b kế hoạch chung); việc này chỉ dựng chỗ và hình.
- **Dòng dữ liệu:** mọi ô cùng cỡ 14px, cùng độ đậm thường (`BR-UI-003`). Chỉ mã có liên kết dùng màu nâu. Trạng thái dùng `Badge`. Cột số canh phải, chữ số thẳng hàng.
- **Điện thoại:** mỗi dòng thành một thẻ, dòng tổng thành thẻ đầu tiên nền `primary-soft`, như `DataList` đang làm.
- `DataList` đổi sang khuôn này. Bảng tự vẽ chuyển sang bộ `Table` mới trong `components/ui/` (bảng, tiêu đề, dòng, ô, dòng tổng). Bảng trong trang chi tiết dùng cùng bộ.

### 2.5 Hộp tổng tiền

- `MoneySummary` mới trong `components/ui/`: nền trắng, viền mảnh, bo góc như thẻ. Mỗi dòng có nhãn xám bên trái và số bên phải. Dòng cuối là con số chính, có đường kẻ phía trên, chữ to và đậm hơn.
- Thay 13 hộp tổng đang có, gồm hộp nền màu đường kẻ trông như ô bị khoá.

### 2.6 Đầu trang

- Trang danh sách: `ListPageHeader` giữ như khuôn ngày 2026-10-02.
- Trang chi tiết: `DetailHeader`, "Quay lại" nằm trên tên.
- Trang khác dùng `PageHeader`. 12 chỗ tự viết `<h1>` chuyển sang một trong ba.
- Tên và nhãn viết hoa kiểu câu: "Chi tiết nhập hàng", không viết "Chi Tiết Nhập Hàng". Đếm 2026-10-07: 6 nhãn viết hoa từng từ. Tên riêng và chữ viết tắt (Topping, MR.PHIN, PO) giữ nguyên.

### 2.7 Cách viết số (`BR-UI-008`)

Chủ quán 2026-10-07: dấu phẩy chia hàng nghìn, dấu chấm cho phần lẻ, ở mọi chỗ: màn quản trị, báo cáo, biểu đồ, máy bán hàng. Ví dụ 1,250.5 ml; 1,250,000đ; 18.13%; 100.12k. Ngày tháng không đổi (dd/mm/yyyy, `BR-DATA-006`).

- **Một hàm chung viết mọi con số:** `formatNumber` trong `lib/shared/format.ts`, đổi sang kiểu mới. Các hàm hiển thị riêng gọi qua nó thay vì tự định dạng: `lib/reports/display-rounding.ts`, `lib/reports/compact-money.ts`, `lib/stock/issue-slip-onhand-display.ts`, `lib/stock/item-stock-display.ts` và các file báo cáo. Đo 2026-10-07: 17 file tự gọi `toLocaleString`, `Intl.NumberFormat` hoặc `toFixed`; 73 file dùng hàm định dạng chung, 7 trong số đó thuộc máy bán hàng.
- **Một ô chung nhận mọi con số gõ vào:** `NumberInput` (mục 2.2).
- **Máy chủ, ô tiền:** `parseAmountVn` trong `lib/finance/cash-entry-rules.ts` hôm nay đọc `150.000` là một trăm năm mươi nghìn. Theo luật mới dấu chấm là phần lẻ, nên hàm này đổi: nhận chữ số trơn hoặc nhóm bằng dấu phẩy (`150,000`), từ chối dấu chấm với câu "Số tiền chỉ gồm chữ số; dấu phẩy chỉ dùng để chia hàng nghìn (ví dụ 150,000)". Ô trên màn gửi chữ số trơn nên người dùng không gặp câu này; nó là chốt chặn cuối.
- **Đổi cả hệ thống trong cùng một đợt** (K1), cùng lúc với các ô đang tự lọc dấu phẩy ở trang tạo và trang sửa phiếu xuất và với `MoneyInput`. Như vậy không lúc nào bảng viết một kiểu mà ô gõ kiểu kia.
- **Luật cho mọi tính năng sau:** phép kiểm canh ở mục 3 đỏ khi code mới tự định dạng số.

## 3. Phép kiểm canh

Một file test kiểu `app/admin/no-popups.test.ts`, chạy trong `npx vitest run`, canh để khuôn không trôi lại:

- Không ô `type="number"` nào trong `app` và `components`.
- Không file nào ngoài `lib/shared/format.ts` gọi `toLocaleString`, `Intl.NumberFormat`, `toFixed` để viết số (`BR-UI-008`). Ngày tháng có hàm riêng, không bị chặn.
- Không thẻ `<button>` hay liên kết nào ngoài `components/ui/` tự đặt `bg-primary`, `bg-danger` làm nền nút. Máy bán hàng được miễn.
- Không thẻ `<table>` nào ngoài `components/ui/`. Máy bán hàng được miễn.
- Không ô `<td>` nào trong bảng danh sách đặt `font-bold`, `font-semibold`, `font-medium`.
- Không nhãn nào có cặp ngoặc chứa chữ tiếng Anh (`BR-UI-001`).

Mỗi luật có danh sách file còn nợ. Danh sách chỉ được ngắn đi: thêm file mới vào là đỏ, sửa xong một file mà quên gạch khỏi danh sách cũng đỏ. Đợt cuối danh sách rỗng.

`it.todo` trong `components/ui/MoneyInput.test.tsx` (gắn ô tiền vào giá món, tuỳ chọn món, phiếu nhập, khuyến mãi, thanh lý tài sản) đổi thành test xanh ở đợt chứa các màn đó, nên mục ấy tự rời `docs/04-operations/OPEN-ITEMS.md`.

## 4. Làm theo đợt

Mỗi đợt xong thì chạy năm lệnh kiểm, rồi chủ quán bấm thử ở lần đẩy. Mỗi đợt cũng đọc lại mọi chữ trên các màn của đợt đó để tìm chữ tiếng Anh còn sót (`BR-UI-001`).

| Đợt | Việc | Ai làm |
|---|---|---|
| K1 | Cách viết số cả hệ thống (mục 2.7): lõi tách chữ số có phần lẻ trong `lib/shared/money-digits.ts`, `formatNumber` và các hàm hiển thị trong `lib`, `parseAmountVn`, kèm test. Phần màn hình của đợt này: ô số lượng phiếu xuất, `MoneyInput`, chỗ tự định dạng số trong các file màn hình kể cả máy bán hàng. Phép kiểm canh luật định dạng số | Sonnet (`lib`), Gemini (màn hình), Opus (phép kiểm canh) |
| K2 | Dựng khuôn: `Button` (thêm `href`, gộp biến thể), `NumberInput`, `MoneyInput` dùng `NumberInput`, `TextInput`, `Select`, `Field`, bộ `Table`, `MoneySummary`; `DataList` đổi tiêu đề cột và dòng. Các luật còn lại của phép kiểm canh, với danh sách nợ đầy đủ | Gemini (khuôn), Opus (phép kiểm canh) |
| K3 | Kho: Phiếu nhập, Phiếu xuất, Kiểm kê, Hàng hoá, Quy đổi, Tài sản, Thời hạn khấu hao | Gemini |
| K4 | Bán hàng: Món, Topping & tuỳ chọn, Khuyến mãi, Đơn hàng | Gemini |
| K5 | Tài chính và báo cáo: Sổ thu chi, Chuyển tiền, Danh mục, Tài khoản, các trang báo cáo, Tổng quan | Gemini |
| K6 | Còn lại: Nhân sự, Thương hiệu, Điểm bán, Nhật ký, Cài đặt, Đổi mật khẩu. Danh sách nợ về rỗng | Gemini |

Đợt 8b của kế hoạch chung (chuyển Phiếu nhập, Phiếu xuất sang mảnh dùng chung, tách `IssueSlipDetailClient.tsx`) làm sau K3 hoặc gộp vào K3, để hai trang đó chỉ phải sửa một lần.

## 5. Kiểm thế nào

- Lõi tách chữ số, Sonnet viết trước khi code, phải đỏ trên bản cũ:
  - `1250.5` với 3 chữ số lẻ ra `1,250.5` và số 1250.5.
  - `1.2345` với 3 chữ số lẻ thì bỏ phím thứ tư.
  - `0.5` giữ số 0 đứng đầu; `.5` ra `0.5`.
  - Dán `1,250.5abc` ra `1,250.5`.
  - Dấu phẩy gõ vào bị bỏ; dấu chấm thứ hai bị bỏ.
  - Ô 0 chữ số lẻ bỏ dấu chấm.
- `formatNumber(1250000)` ra `1,250,000`; số có phần lẻ ra dấu chấm. Biểu đồ: `100.12k`, `100tr`. Phần trăm: `18.13%`.
- `parseAmountVn("150,000")` ra 150000; `parseAmountVn("150.000")` bị từ chối (hôm nay nhận là 150000, nên test đỏ vì giá trị sai).
- `NumberInput` có test cho:
  - con trỏ đứng đúng chỗ sau khi chèn dấu phẩy;
  - chặn lăn chuột;
  - ví dụ mờ đúng đơn vị và số chữ số lẻ;
  - ba câu báo sai;
  - ô ẩn mang `1250.5`;
  - cách dùng do trang tự giữ giá trị.
- Test cũ có chữ số viết kiểu cũ (`15.000`) sửa sang kiểu mới trong cùng lần lưu với hàm, nói rõ lý do. Không xoá test nào.
- Mỗi màn đổi sang `NumberInput` thì test cũ của màn đó vẫn xanh; nếu test cũ gõ vào ô `type="number"` thì sửa test, nói rõ lý do trong lần lưu.
- Mở bằng mắt ở ba cỡ: 1568px, 1024px, 390px. Playwright không đăng nhập được, nên chủ quán bấm thử ở lần đẩy.

## 6. Ảnh hưởng chéo

- **Sau đợt K1, mọi con số trên mọi màn đổi cách viết cùng lúc**, kể cả máy bán hàng: `25,000` thay cho `25.000`. Báo chủ quán trước khi đẩy để anh dặn nhân viên đứng quầy. Đợt này không làm máy bán hàng ngừng nhận đơn: chỉ đổi cách hiện số, không đổi cách tính hay cách lưu.
- **Ai quen gõ dấu chấm hàng nghìn** (`150.000`) vào ô tiền sẽ thấy ô bỏ dấu chấm và hiện `150,000`: không sai số. Gõ `1.000` vào ô số lượng nhận phần lẻ thì ra một, nhưng ô hiện `1.000` không có dấu phẩy, khác với `1,000` nên nhìn ra được; ví dụ mờ trong ô nhắc cách gõ.
- Số đã lưu không đổi. Chỉ cách hiện và cách gõ đổi.
- Các con số ghi trong tài liệu luật cũ giữ dấu cũ làm lịch sử (`BR-UI-008`).

## 7. Còn chờ chủ quán

- Chủ quán có muốn tự đổi cách viết số trong Cài đặt không, hay một chỗ chung trong code là đủ.
