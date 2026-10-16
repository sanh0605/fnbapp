# Khuôn chung trên điện thoại — thiết kế

Ngày 2026-10-16. Người viết: Opus (phiên chính). Chủ quán uỷ quyền lấy khuyến nghị, duyệt lại cuối đợt.

Lời chủ quán (2026-10-16): *"lên kế hoạch làm lại các bản trên điện thoại luôn. Các nơi trên điện thoại dùng thẻ để thay thế bảng thì nên có cách khác vì càng nhiều thẻ thì lại càng dài… Đồng thời thiết kế lại cả màn hình của nút thêm. Lập mẫu và khuôn chung cho điện, nếu có thì cần cải thiện để dễ thấy chữ và dễ bấm. Làm xong hết thì dùng playwright để kiểm tra trước."*

Phạm vi: mọi màn hình quản trị trên điện thoại (bề rộng dưới 768 px). Máy tính giữ nguyên. Máy bán hàng (`app/pos/`) giữ bố cục riêng (`BR-UI-005`).

## 1. Hiện trạng (đo trong code 2026-10-16)

Đã xem: `components/ui/list/DataList.tsx`, `FilterCard.tsx`, `ListPageHeader.tsx`, `TotalCard` trong `components/ui/Table.tsx`, `Field.tsx`, `TextInput.tsx`, `Select.tsx`, `NumberInput.tsx`, `SearchableSelect.tsx`, `Button.tsx`, `components/ui/list-rows.guard.test.ts`, thẻ điện thoại của Phiếu nhập (`app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx`), `.claude/rules/ui-devices.md`, `docs/02-rules/business-rules/screens.md`, `docs/superpowers/specs/2026-10-15-khuon-chung-design.md`. Danh sách màn hình lấy từ bản dò của Haiku, Opus kiểm lại bằng grep.
Chưa xem: chưa mở trang thật ở 390 px (máy chủ 8386 đang tắt); chưa đọc từng thẻ của 24 danh sách còn lại; chưa đọc từng biểu mẫu trong 21 trang tạo và 21 trang sửa.

Số đếm:
- 25 danh sách dùng `DataList` với `renderCard`: tài sản, tồn kho, kiểm kê, phiếu xuất, phiếu nhập, hàng hoá, quy đổi, đơn vị, nhóm hàng, thời hạn khấu hao, món, nhóm món, loại món, tuỳ chọn, nhóm tuỳ chọn, khuyến mãi, thương hiệu, điểm bán, nhà cung cấp, nhân sự, đơn hàng, sổ thu chi, danh mục thu chi, tài khoản ngân hàng, khoản hằng tháng.
- 6 bố cục điện thoại tự dựng: Tổng quan 7 ngày (`DashboardView.tsx`), các mục của Doanh số, Hàng đã xuất, Lãi lỗ theo tháng (`PnlMonthCards`), Sổ thu chi theo tháng (`CashBookMonthsClient`), Nhật ký.
- Khoảng 15 trang chi tiết có cặp bảng/thẻ cho các dòng con (dòng phiếu nhập, dòng phiếu xuất, món trong đơn…).
- 42 trang tạo và sửa; 6 trang có thanh lưu chung `FormActionBar`, 19 trang còn nợ (`components/ui/form-action-bar.guard.test.ts`).
- 32 file có chữ 9–11 px.

Một dòng Phiếu nhập trên điện thoại hôm nay cao khoảng 110 px:
- dòng mã phiếu 12 px, có tổng tiền bên phải;
- tên nhà cung cấp, tối đa 2 dòng;
- ngày · nguồn · thanh toán 12 px, có nhãn trạng thái bên phải;
- đệm 16 px trên và dưới;
- nút thùng rác 44 px ở góc.

Phía trên dòng đầu tiên còn ba khối nữa:
- tiêu đề, với nút "Tạo" kéo hết bề ngang, nằm riêng một hàng;
- khung lọc với mọi ô lọc xếp dọc, mỗi ô 44 px;
- thẻ tổng.

Nên trên điện thoại 390 × 844 trừ thanh menu dưới, chỉ còn khoảng 3–4 phiếu lọt màn hình đầu.

Năm câu hiện trạng:

1. **Trạng thái.** Danh sách có các trạng thái:
   - xem;
   - đang chọn: bấm "Chọn" để vào, bấm "Xong" để ra;
   - rỗng, hai loại theo `BR-UI-016`;
   - đang tải.

   Thiết kế này thêm hai trạng thái:
   - Khung lọc đóng hoặc mở. Bấm nút "Bộ lọc" để đổi. Khung đóng sẵn khi mở trang. Chỉ danh sách có ô tìm hoặc có ô lọc mới gập; báo cáo giữ khung lọc như hôm nay.
   - Mỗi dòng hàng trong biểu mẫu nhiều dòng thu gọn hoặc mở ra. Bấm vào dòng để mở, bấm "Xong" để thu lại. Mỗi lúc chỉ mở một dòng.
2. **Nút.**
   - "Tạo" nằm cùng hàng với tiêu đề.
   - "Bộ lọc (n)": n là số bộ lọc đang thu hẹp danh sách (khoảng ngày cũng tính), nút này mở và đóng khung lọc. Không đặt tên "Lọc" để khỏi trùng nút "Lọc" bên trong.
   - Trong khung lọc có "Lọc" và "Xoá lọc".
   - "Chọn" / "Xong".
   - Bấm cả dòng để mở trang chi tiết.
   - Trong chế độ chọn có thanh "Xoá (n)" hoặc "Ngừng dùng (n)" như hôm nay. Trên điện thoại thanh này dính ở đáy màn hình, ngay trên thanh menu dưới, để đánh dấu dòng cuối trang vẫn thấy nút.

   Nút thùng rác trên từng dòng **bỏ trên điện thoại**: nó chiếm 44 px bề ngang và dễ bấm nhầm. Xoá vẫn làm được bằng chế độ chọn, hoặc ở trang chi tiết (`RemoveRecordButton`). Máy tính giữ nút thùng rác. Cái giá: xoá một dòng từ danh sách trên điện thoại cần 3 lần bấm ("Chọn", đánh dấu, "Xoá") thay vì 1; điểm này nằm trong danh sách chủ quán duyệt.

   Ở biểu mẫu:
   - Thanh lưu chung `FormActionBar` (`BR-UI-015`).
   - Trên dòng hàng đang mở có "Xong" và "Xoá dòng". "Xoá dòng" chỉ hiện khi dòng đang mở, để không bấm nhầm khi cuộn.
3. **Danh sách.**
   - Cùng bộ lọc, cùng trang, cùng thứ tự, cùng các dòng như trên máy tính.
   - Mỗi dòng trên điện thoại hiện 2–4 thông tin, chọn theo từng danh sách (bảng ở mục 3.1).
   - Thông tin còn lại chỉ thấy ở trang chi tiết.
   - Không lọc bỏ dòng nào chỉ vì đang xem trên điện thoại.
4. **Ô nhập.**
   - Giữ nguyên khoảng giá trị và cách báo lỗi đang có. Thiết kế này chỉ đổi cỡ và cách xếp.
   - Ô tìm (`BR-UI-016`) nhận chữ, tìm theo mã hoặc tên.
   - Ô số vẫn mở bàn phím số (`inputMode`).
5. **Phục vụ dữ liệu nào.**
   - Mọi danh sách, trang chi tiết, báo cáo và biểu mẫu trong `app/admin/`.
   - Cố ý không làm:
     - máy bán hàng (dùng bằng tay ở quầy, đã có bố cục riêng);
     - trang đăng nhập;
     - bố cục máy tính.

Câu thêm cho việc này:

6. **Điện thoại không hiện gì mà máy tính hiện, và người dùng xem ở đâu?** Các cột phụ của bảng. Mở dòng sẽ ra trang chi tiết, nơi có đủ mọi trường.
7. **Tên dài.**
   - Dòng chính được xuống tối đa 2 dòng rồi mới cắt bằng "…". Hướng dẫn của Apple khuyên xuống dòng trước khi cắt.
   - Dòng phụ xuống tối đa 2 dòng rồi cắt. Thông tin quan trọng nhất đặt trước, để phần bị cắt là phần ít cần.
   - Danh sách chọn vẫn hiện tên đầy đủ (`BR-UI-010`).
8. **Máy tính bảng và xoay ngang.** Từ 768 px trở lên dùng bảng máy tính như hôm nay. Điện thoại xoay ngang vẫn dưới 768 px nên vẫn dùng dòng gọn.
9. **Chữ phóng to theo cài đặt điện thoại.** Cỡ chữ tính bằng `rem`, nên dòng cao lên theo chữ chứ không đè lên nhau.

## 2. Các cách đã cân nhắc

| Cách | Được | Mất | Chọn |
|---|---|---|---|
| A. Dòng gọn hai tầng (tên + số bên phải; thông tin phụ + nhãn bên phải) | Ngắn hơn khoảng 40%, chữ to hơn, cùng một khuôn cho 25 danh sách | Phải chọn 2–4 thông tin cho mỗi danh sách | **Danh sách** |
| B. Bảng thu nhỏ, cột đầu đứng yên, kéo ngang | Giữ nguyên bảng, so được theo cột | Danh sách nhiều cột chữ thì phải kéo ngang liên tục | **Báo cáo số** (mục 3.4) |
| C. Gom theo ngày, có đầu mục ngày dính trên cùng | Đỡ lặp ngày trên mỗi dòng | Thêm một kiểu nữa phải giữ; danh sách lọc theo khoảng ngày vốn đã ngắn | Không làm lúc này |

Nguồn đã tra:
- NN/g, *Mobile tables* (https://www.nngroup.com/articles/mobile-tables/). Dữ liệu cần so theo cột thì giữ bảng, cố định cột đầu và cho người dùng thấy rõ còn kéo ngang được. Bài viết không khuyên biến mỗi dòng thành một thẻ.
- Sapo, quản lý bán hàng trên điện thoại (https://www.sapo.vn/cap-nhat-tinh-nang/quan-ly-ban-hang-tren-mobile). Mỗi sản phẩm một dòng gọn có tên, giá và tồn; thao tác phụ cất sau nút "Thao tác khác".
- KiotViet (https://huongdan.kiotviet.vn và ứng dụng KiotViet trên App Store). Danh sách hàng và hoá đơn trên điện thoại là các dòng hai tầng, không phải thẻ to.
- Shopify, mẫu trang danh sách (https://shopify.dev/docs/api/app-home/patterns/templates/resource-index): danh sách dạng dòng, chọn nhiều dòng để làm một việc chung.
- Apple, *Lists and tables* (https://developer.apple.com/design/human-interface-guidelines/lists-and-tables): xuống dòng trước khi cắt chữ; vùng bấm tối thiểu 44 pt.
- Material, lists (https://m3.material.io/components/lists/specs): dòng hai tầng. Con số 56/72 dp chưa kiểm tận nguồn nên không dùng làm căn cứ. Vùng bấm 48 dp là con số quen thuộc của Material.
- WCAG 2.2 mục 2.5.8 (24 px, mức AA) và 2.5.5 (44 px, mức AAA).

## 3. Thiết kế

### 3.1 Dòng gọn cho danh sách (D1)

`DataList` thay `renderCard` bằng `phoneRow`. Đây là dữ liệu có cấu trúc, không phải tự vẽ, nên 25 danh sách trông như nhau:

```ts
phoneRow: (row: T) => {
  title: React.ReactNode;   // line 1, left: the name a person looks for
  value?: React.ReactNode;  // line 1, right: the one number (money, quantity)
  meta?: React.ReactNode;   // line 2, left: date · code · secondary facts, joined by " · "
  badge?: React.ReactNode;  // line 2, right: status badge
}
```

Cách vẽ một dòng:
- Tầng 1 cỡ 16 px, màu chữ chính. Tên được xuống tối đa 2 dòng; số bên phải dùng chữ số đều hàng (`tabular-nums`) và không xuống dòng.
- Tầng 2 cỡ 14 px, màu chữ phụ (`text-text-secondary`, tương phản khoảng 7:1). Xuống tối đa 2 dòng rồi cắt; phần quan trọng đặt trước.
- Không chữ đậm, đúng `BR-UI-003` và phép kiểm `list-rows.guard`.
- Đệm trên dưới 10 px, hai bên 16 px. Dòng một tầng tên cao khoảng 64 px, mỗi dòng là một vùng bấm.
- Không còn nút thùng rác trên từng dòng.
- Ở chế độ chọn, ô đánh dấu nằm bên trái dòng, vùng bấm 48 px. Bấm vào đâu trên dòng cũng là đánh dấu (cả dòng là nhãn của ô đánh dấu).

Tổng (`BR-UI-004`) trên điện thoại là **một dải mỏng** ngay trên danh sách, ví dụ "Tổng (không tính huỷ, nháp): 12,450,000đ". Nhiều giá trị thì nối bằng " · ", hết chỗ thì xuống dòng. Dải này thay cho thẻ tổng cao hôm nay.

Phần đầu trang trên điện thoại:
- Tiêu đề bên trái, nút "Tạo" bên phải, cùng một hàng.
- Khung lọc thu lại còn một hàng: ô tìm (nếu danh sách có) và nút "Bộ lọc (n)". Bấm nút thì các ô lọc mở ra ngay tại chỗ, không phải hộp nổi (`BR-DATA-007`).
- Bộ lọc ngày (`BR-UI-007`) nằm trong phần mở ra. Số trên nút cho biết đang lọc; không thêm dòng tóm tắt riêng (ít code hơn, cùng tác dụng).
- Danh sách chỉ có ô tìm (không có ô lọc nào) thì không có nút gập.

Ví dụ, Phiếu nhập trên điện thoại:

| Tầng | Trái | Phải |
|---|---|---|
| 1 | Tên nhà cung cấp | Tổng tiền |
| 2 | Ngày · mã phiếu · thanh toán | Trạng thái |

Nguồn hàng (ví dụ "Mua ngoài") chuyển vào trang chi tiết. Bảng chọn thông tin cho từng danh sách nằm trong kế hoạch, mỗi danh sách một dòng.

### 3.2 Dòng con ở trang chi tiết (D3)

Các bảng con trên điện thoại dùng cùng dòng gọn đó, tách ra thành component `PhoneRow` trong `components/ui/list/` để `DataList` và các trang chi tiết dùng chung. Ví dụ: dòng hàng của phiếu nhập, phiếu xuất, kiểm kê; món của đơn hàng; lịch sử giá; khấu hao.

Ví dụ một dòng hàng của phiếu nhập:
- Tầng 1: "Sữa đặc Ông Thọ" bên trái, "380,000đ" bên phải.
- Tầng 2: "10 hộp × 38,000đ".

Phần thông tin chung đầu trang chi tiết (`FieldList`) giữ cách "nhãn trái, giá trị phải", mỗi cặp một hàng. Chỉ nâng cỡ chữ theo mục 3.5.

### 3.3 Màn hình Tạo và Sửa (D4)

1. Trên điện thoại chỉ một cột (`BR-UI-014`).
2. Ô nhập, ô chọn, ô số và nút cao **48 px** trên điện thoại (hôm nay 44 px). Máy tính giữ 40 px.
3. Nhãn ô 14 px (hôm nay 13 px), dòng gợi ý và dòng lỗi 13 px (hôm nay 12 px). Chữ trong ô 16 px; `app/globals.css` đã đặt sẵn để iPhone không tự phóng to màn hình.
4. Biểu mẫu dài chia thành từng phần, mỗi phần có tiêu đề nhỏ. Ví dụ Phiếu nhập có ba phần: "Thông tin phiếu", "Hàng nhập", "Thanh toán". Biểu mẫu dưới 6 ô thì không chia.
5. Ô **không bắt buộc** mà dữ liệu thật cho thấy ít dùng (điền ở dưới 10% số phiếu đã lưu) thì cất sau một dòng bấm mở tại chỗ. Phần đó tự mở khi một ô trong đó đã có giá trị hoặc đang báo lỗi. Ô bắt buộc không bao giờ bị cất. Đo 2026-10-16:
   - Phiếu nhập (206 phiếu): Ghi chú 0, Thuế 14, Chiết khấu 15, nên cất ba ô này. Mã hoá đơn 64, Phí vận chuyển 45, Voucher 46 thì vẫn để hiện.
   - Sổ thu chi: Ghi chú có ở 41/41 dòng, nên không cất.
   - Khuyến mãi mới có 2 chương trình, chưa đủ dữ liệu để quyết, nên không cất ô nào.
   - Các biểu mẫu còn lại dưới 6 ô, nên không cất.
6. Thanh lưu chung `FormActionBar` cho đủ 19 trang còn nợ (`BR-UI-015` đã duyệt).
7. Biểu mẫu nhiều dòng hàng là **Phiếu nhập** và **Phiếu xuất**.
   - Sửa kiểm kê không thêm hay bớt dòng. Mỗi dòng ở đó là tên hàng và đơn vị bên trái, ô số 48 px bên phải.
   - Sửa đơn chỉ có tối đa 2 phần thanh toán, nên giữ nguyên cách xếp và chỉ đổi cỡ.
   - Mỗi dòng hiện thu gọn như mục 3.2.
   - Bấm vào dòng thì nó mở ngay tại chỗ, hiện các ô số lượng, đơn vị và đơn giá, cùng "Xong" và "Xoá dòng".
   - Thêm hàng: ô chọn "Thêm hàng…" ở cuối danh sách dòng. Chọn xong, dòng mới mở sẵn để nhập số lượng.
   - Dòng đang lỗi tự mở và có viền đỏ.
8. Ô chọn có tìm (`SearchableSelect`) cao 48 px trên điện thoại. Mỗi lựa chọn trong danh sách xổ ra cũng cao 48 px.

### 3.4 Báo cáo số trên điện thoại (D2)

Các chỗ đổi:
- Tổng quan 7 ngày;
- Doanh số theo ngày và theo món;
- Hàng đã xuất;
- Sổ thu chi theo tháng.

Lãi lỗ theo tháng giữ dạng từng tháng bấm mở ra công thức và nguồn số (`PnlMonthCards`), vì bảng không giữ được phần mở ra đó; chỉ đổi cỡ chữ.

Bốn chỗ này đổi từ thẻ dọc sang **bảng gọn**:
- Cột đầu (ngày, tên món, khoản mục) đứng yên.
- Các cột số kéo ngang được. Cột cuối bị mép màn hình cắt ngang cho thấy còn cột; Playwright cuối đợt xem lại, nếu chưa rõ mới thêm bóng mờ.
- Chữ 14 px, đệm ô gọn trên điện thoại (`px-3 py-2`, như kiểu `statement`), tiêu đề cột không xuống dòng.
- Dòng tổng nằm dưới tiêu đề như trên máy tính (`BR-UI-004`).

Cách này theo NN/g: dữ liệu số cần so theo cột thì giữ bảng. Điều này **đổi luật** "Trên điện thoại: không dùng bảng ngang" trong `.claude/rules/ui-devices.md`. Luật mới:
- Danh sách thì dùng dòng gọn.
- Báo cáo số cần so theo cột thì dùng bảng gọn có cột đầu đứng yên.

Nhật ký giữ dạng dòng thời gian, chỉ đổi cỡ chữ.

### 3.5 Cỡ chữ và vùng bấm trên điện thoại (D5)

| Thứ | Hôm nay | Mới |
|---|---|---|
| Ô nhập, nút, ô chọn | 44 px | 48 px |
| Khoảng cách giữa hai vùng bấm | không thống nhất | ít nhất 8 px |
| Chữ dòng chính | 14 px | 16 px |
| Chữ phụ | 12 px | 14 px trong dòng; 13 px cho gợi ý và lỗi |
| Chữ nhỏ nhất ở bất kỳ đâu trên điện thoại | 9–11 px (32 file) | 12 px (nhãn thanh menu dưới); còn lại ít nhất 13 px |
| Vùng bấm nhỏ nhất (nút chỉ có biểu tượng) | không thống nhất | 44 × 44 px |

Các con số đặt trong component dùng chung ở `components/ui/`, không đặt trên từng trang (`BR-UI-005`). Máy tính giữ nguyên `BR-UI-014`: 40 px, chữ 14 px.

## 4. Phép kiểm

1. `phone-rows.guard`:
   - không file nào trong `app/` còn `renderCard`;
   - mọi `<DataList` có `phoneRow`.
2. Test của `PhoneRow`:
   - đủ bốn ô;
   - không có chữ đậm;
   - ở chế độ chọn, cả dòng là một nút.
3. Test của các component dùng chung: lớp chiều cao `min-h-[48px] md:min-h-[40px]` có mặt ở `Button`, `TextInput`, `Select`, `NumberInput` và `SearchableSelect`.
4. `text-size.guard`: đếm số file có chữ dưới 12 px. Danh sách chỉ được rút ngắn, giống cách `form-action-bar.guard` đang làm.
5. Cuối đợt, mở bằng Playwright ở 390 × 844 và 1280 × 800:
   - mọi danh sách;
   - một trang chi tiết của mỗi vùng;
   - mọi trang tạo.

   Mỗi trang chụp một ảnh, kèm số dòng lọt màn hình đầu: Phiếu nhập trước và sau.

## 5. Thứ tự làm

| Đợt | Việc | Ai |
|---|---|---|
| P1 | `PhoneRow`, `DataList.phoneRow`, dải tổng, đầu trang và khung lọc thu gọn, cỡ 48 px và cỡ chữ ở component chung; chạy thử trên Phiếu nhập (danh sách, chi tiết, tạo) và Sổ thu chi | Gemini; phép kiểm 1, 3, 4 do backend-coder |
| P2 | 24 danh sách còn lại, chia theo vùng: Kho, Bán hàng, Tài chính, Hệ thống | Gemini, mỗi vùng một phiếu, chạy song song khi khác file |
| P3 | Dòng con ở khoảng 15 trang chi tiết | Gemini |
| P4 | 5 báo cáo số thành bảng gọn | Gemini |
| P5 | Biểu mẫu: thanh lưu chung cho 19 trang, chia phần, "Thêm thông tin", 4 biểu mẫu nhiều dòng | Gemini |
| P6 | Kiểm bằng Playwright, sửa lỗi tìm được | Opus kiểm, Gemini sửa |

Mỗi đợt đều qua: soát độc lập (agent `reviewer`), năm lệnh kiểm, build trong thư mục làm việc riêng.

## 6. Cần chủ quán duyệt lại cuối đợt

Theo uỷ quyền, đã chọn trước theo khuyến nghị:

1. Danh sách trên điện thoại dùng dòng gọn hai tầng thay cho thẻ, và bỏ nút thùng rác trên từng dòng (xoá qua "Chọn" với thanh xoá dính đáy màn hình, hoặc trang chi tiết; 3 lần bấm thay vì 1).
2. Ô và nút trên điện thoại cao 48 px thay vì 44 px. Điều này đổi `BR-UI-014`.
3. Trong một dòng, tầng 2 nhỏ hơn và nhạt hơn tầng 1. `BR-UI-003` vẫn đúng ở chỗ không chữ đậm, nhưng hai tầng khác cỡ chữ.
4. Báo cáo số trên điện thoại dùng bảng kéo ngang, cột đầu đứng yên. Điều này đổi luật "không dùng bảng ngang".
5. Khung lọc trên điện thoại đóng sẵn, mở bằng "Bộ lọc (n)".
6. Ô không bắt buộc ít dùng cất sau "Thêm thông tin".
