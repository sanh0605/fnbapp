# Bộ lọc thời gian kiểu Looker: thiết kế

Trạng thái: chủ quán đã chọn mọi điểm nghiệp vụ 2026-10-09, sau khi bấm thử trang mẫu. Bản thiết kế này chờ chủ quán duyệt; duyệt xong mới viết kế hoạch.

Nguồn:
- Luật: `BR-UI-007` trong `docs/02-rules/business-rules/screens.md` (toàn bộ lựa chọn của chủ quán ngày 2026-10-09, kèm lời gốc). Chỉ lọc theo ngày, không theo giờ: `BR-DATA-006` trong `docs/02-rules/business-rules/data-integrity.md`.
- Trang mẫu chủ quán đã bấm thử: https://claude.ai/artifact/GomjK35YDJQsYBk1sajNJD (kiểu B là kiểu được chọn; có nút đổi máy tính / điện thoại).
- Kế hoạch chung: `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md`, mục 1b.

Ngày dùng trong mọi ví dụ: **thứ Sáu 09/10/2026**.

## 1. Hiện trạng: năm câu

Đã xem: `lib/shared/date-range-presets.ts`, `app/admin/finance/resolve-date-range.ts`, `components/ui/DateRangeFilter.tsx`, `app/admin/reports/sales/page.tsx` (dòng 1–200), `lib/reports/dashboard-periods.ts`, `lib/reports/daily-digest.ts`, bốn trang danh sách (`page.tsx` của Đơn hàng, Phiếu xuất, Phiếu nhập, Nhật ký), `app/admin/reports/pnl/page.tsx`, `lib/reports/profit-and-loss.ts` (dòng 55–115), `lib/finance/cash-book-rows.ts` (dòng 35–70). Chỉ tìm dòng (chưa đọc cả file): `app/admin/page.tsx`, `SalesFilter.tsx`, bốn file giao diện danh sách, `lib/stock/issue-slip-list.ts`, `app/admin/reports/pnl/actions.ts`.
Chưa xem: phần thân `getSalesDataV2` và `getOrdersV2`; `PnlTableView` khi có hơn 12 cột; cách `CashBookClient` truyền ngày mặc định cho `CashEntryForm`; `profit-and-loss.ts` từ dòng 116; ô tìm của Nhật ký tìm trong những trường nào; thân trang Tổng kết ngày. Kế hoạch đọc các chỗ này trước khi giao việc.

1. **Trạng thái.** Bộ lọc có hai trạng thái: đóng (một nút ghi tên khoảng và ngày) và mở (bảng chọn dưới nút). Khi mở có hai chế độ: chọn khoảng có sẵn, và Tuỳ chọn (gõ hoặc bấm ngày, chờ "Áp dụng"). Trên danh sách có thêm trạng thái thứ ba: **đang tìm**, khi ô tìm có chữ thì khoảng ngày tạm gác. Khoảng đang dùng nằm trên địa chỉ trang (mục 3), nên tải lại trang hay gửi đường dẫn vẫn giữ nguyên. Không thêm bảng dữ liệu nào.
   Hiện nay có năm kiểu lọc khác nhau: Sổ thu chi dùng ô xổ 16 khoảng (`DateRangeFilter`); bốn danh sách dùng hai ô gõ ngày, để trống là xem mọi ngày; Tổng quan dùng 8 nút; Doanh số dùng 3 nút và hai ô lịch; Lãi lỗ chọn năm.
2. **Nút.**
   - Nút bộ lọc: bấm để mở hoặc đóng bảng chọn. Trên danh sách, khi ô tìm có chữ thì nút mờ đi, không bấm được, và dưới nút ghi "Đang tìm trên mọi ngày · xoá ô tìm để lọc theo ngày".
   - Mỗi khoảng có sẵn: bấm là lọc luôn và đóng bảng.
   - Tuỳ chọn: chuyển sang hai ô ngày và lịch, chưa lọc.
   - "Áp dụng": chỉ hiện ở chế độ Tuỳ chọn; mờ cho tới khi hai ô ngày hợp lệ và ngày đầu không sau ngày cuối.
   - "Huỷ", bấm ra ngoài, hoặc phím Esc: đóng bảng, bỏ ngày đang chọn dở, giữ khoảng cũ.
   - "Xoá lọc" trên Phiếu nhập và Phiếu xuất: trước đây làm trống hai ô ngày (về mọi ngày); nay đưa khoảng về **Tháng này**.
3. **Danh sách khoảng.**
   - Máy tính: đủ 16 khoảng của `lib/shared/date-range-presets.ts`, theo đúng thứ tự trong file đó.
   - Điện thoại: 9 nút, ba hàng ba cột: Hôm nay, Hôm qua, Tuần này / Tuần trước, Tháng này, Tháng trước / Quý này, Năm nay, Tuỳ chọn. Bảy khoảng còn lại chỉ đến được qua Tuỳ chọn; vì sao loại: chủ quán muốn bảng gọn trong một màn hình.
   - Lãi lỗ, cả hai máy: Tháng này, Tháng trước, Quý này, Quý trước, Năm nay, Năm trước, Từ đầu năm đến nay, Tuỳ chọn. Loại các khoảng cắt ngang tháng, vì chủ quán chọn chỉ xem trọn tháng (tiền thuê một tháng không dồn vào một tuần).
   - Không có khoảng "Tất cả" trên danh sách. Tổng quan bỏ nút "Tất cả" cũ.
4. **Ô nhập.**
   - Hai ô ngày "Từ ngày", "Đến ngày" dùng `DayInput` (gõ dd/mm/yyyy). Ngày không có thật (31/02) báo "Ngày không hợp lệ" dưới ô. Ngày đầu sau ngày cuối báo "Ngày đầu phải trước ngày cuối" (chữ đang dùng ở `DateRangeFilter`). Ngày tương lai được nhận, vì Tháng này cũng chứa ngày chưa tới. Không có giới hạn ngày sớm nhất.
   - Lãi lỗ, Tuỳ chọn: hai ô tháng "Từ tháng", "Đến tháng" (chọn tháng và năm, không chọn ngày). Tháng đầu sau tháng cuối báo "Tháng đầu phải trước tháng cuối". Tháng sau tháng hiện tại không có cột nào, như hiện nay với năm tương lai.
   - Địa chỉ trang bị sửa tay sai (khoảng lạ, ngày hỏng, ngày đầu sau ngày cuối): trang dùng khoảng mặc định, không báo lỗi, giống `resolveDateRange` hiện nay.
5. **Phục vụ gì, cố ý không phục vụ gì.**
   - Phục vụ: Đơn hàng, Phiếu nhập, Phiếu xuất, Nhật ký hoạt động, Sổ thu chi, Tổng quan, Doanh số, Lãi lỗ.
   - Cố ý không đổi: Giá trị xuất kho (giữ thẻ riêng, chủ quán chốt); các ô ngày trong biểu mẫu nhập liệu (ngày phiếu, ngày thu chi); máy bán hàng.
   - Bỏ hẳn: trang Tổng kết ngày (`/admin/reports/daily`), chủ quán chốt.
   - Không lọc theo giờ (`BR-DATA-006`).

### Câu hỏi riêng cho việc này

6. **Hôm nay là ngày nào?** Luôn là ngày ở Việt Nam (`saigonToday()`), trang máy chủ tính rồi truyền xuống. Máy chủ Vercel chạy giờ UTC, nên 06:30 sáng ở quán vẫn là "hôm nay" của Việt Nam, không phải hôm qua.
7. **Khoảng có ngày chưa tới thì so với gì?** Cắt ở hôm nay rồi mới so (mục 4). Tháng này ngày 09/10 so với 01/09–09/09.
8. **Đường dẫn cũ còn chạy không?** Sổ thu chi có các dòng bấm sang Đơn hàng và Phiếu nhập với `from=…&to=…`; các đường dẫn đó vẫn mở đúng ngày (mục 3). Đường dẫn cũ của Tổng quan (`filter=`) và Sổ thu chi (`preset=`) không đọc nữa, mở ra Tháng này. `year=` của Lãi lỗ vẫn đọc, vì chủ quán có thể đã lưu trang một năm cụ thể.

## 2. Cái nút và bảng chọn

Một thành phần dùng chung thay `components/ui/DateRangeFilter.tsx`: `components/ui/DateRangeButton.tsx`. Khi Sổ thu chi chuyển sang nó, `DateRangeFilter` bị xoá cùng test của nó (không để lại code chết).

**Nút.** Tên khoảng đậm, ngày nhạt bên cạnh (máy tính) hoặc bên dưới (điện thoại):
- "Tháng này · 01/10/2026 – 31/10/2026"
- "Hôm nay · 09/10/2026"
- "Tuỳ chọn · 15/09/2026 – 24/09/2026"
- Lãi lỗ: "Năm nay · 01/2026 – 10/2026"

**Máy tính.** Bảng mở ngay dưới nút, đè lên phần trang bên dưới. Trái: danh sách khoảng, khoảng đang dùng tô màu. Phải: hai ô ngày, hai tháng lịch cạnh nhau, nút Huỷ và Áp dụng. Bấm một ngày trên lịch rồi một ngày nữa là chọn xong hai đầu; khoảng giữa tô màu. Gõ vào ô ngày cũng cập nhật lịch.

**Điện thoại.** Nút rộng hết bề ngang. Bấm mở bảng ngay dưới nút, đẩy phần trang xuống (không che); trang tự cuộn để nút nằm đầu màn hình, bảng gọn trong một màn hình 667px chiều cao. Chín nút to, ba hàng ba cột. Tuỳ chọn đổi chín nút thành hai ô ngày, một tháng lịch, Huỷ và Áp dụng. Khoảng đặt trên máy tính mà điện thoại không có nút (ví dụ 7 ngày qua) vẫn lọc đúng; nút ghi "7 ngày qua · 02/10/2026 – 08/10/2026", không nút nào trong chín nút được tô.

**Không phải hộp nổi.** Bảng chọn bám dưới nút như danh sách xổ của `SearchableSelect`, không phủ kín màn hình, không dùng `FormModal`, `ModalPortal` hay lớp `fixed inset-0`. Phép kiểm `app/admin/no-popups.test.ts` (`BR-DATA-007`) phải giữ xanh mà không thêm tên nào vào danh sách cho phép.

**Thành phần nhận gì.** Giá trị `{ preset, start, end }`, hàm báo thay đổi, ngày hôm nay, và tuỳ chọn chế độ tháng cho Lãi lỗ (danh sách khoảng rút gọn, hai ô tháng thay cho ngày, ngày ghi dạng `yyyy-mm`). Thành phần không tự đổi địa chỉ trang; trang nào dùng thì trang đó ghi lên địa chỉ bằng hàm chung ở mục 3.

**Hai thiết bị cùng tên, cùng cách tính.** Cả hai đọc tên và cách tính từ `lib/shared/date-range-presets.ts`. Không chỗ nào tự tính "tháng trước".

## 3. Địa chỉ trang

Một cách viết cho mọi trang:

| Tham số | Nghĩa |
|---|---|
| `range` | Tên khoảng, đúng khoá trong `date-range-presets.ts`: `THIS_MONTH`, `LAST_7_DAYS`, `CUSTOM`… |
| `from`, `to` | Chỉ dùng với `CUSTOM`: `yyyy-mm-dd`; Lãi lỗ dùng `yyyy-mm` |

- Không có `range` nhưng có đủ `from` và `to` hợp lệ: hiểu là `CUSTOM`. Nhờ vậy các dòng bấm từ Sổ thu chi sang Đơn hàng, Phiếu nhập (`lib/finance/cash-book-rows.ts`) vẫn mở đúng một ngày. Các dòng đó cũng được sửa để ghi `range=CUSTOM` cho rõ.
- Không có gì, hoặc sai: khoảng mặc định của trang (Tháng này; Lãi lỗ: Năm nay).
- Lãi lỗ còn đọc `year=2025` cũ, hiểu là Tuỳ chọn 01/2025 – 12/2025.
- Đổi khoảng thì về trang 1 của danh sách.

Hàm chung, thuần tính toán, không phụ thuộc giờ của máy chạy:
- `lib/shared/date-range-params.ts`: đọc tham số ra `{ preset, start, end }` theo luật trên (thay `app/admin/finance/resolve-date-range.ts`, chuyển test của nó sang); và ghi `{ preset, start, end }` vào tham số. Có biến thể tháng cho Lãi lỗ.
- `lib/reports/compare-periods.ts`: tính kỳ so (mục 5.2).
- Hai file mới tính ngày bằng các hàm sẵn có của `date-range-presets.ts` (`addDays`, đầu tuần, cuối tháng; hàm nào đang ẩn thì xuất ra), không tự gọi `getDate()` hay `toISOString().slice(0, 10)`. Như vậy `lib/shared/timezone-guard.test.ts` giữ xanh mà không thêm dòng cho phép nào.

## 4. Danh sách

Áp dụng cho Đơn hàng, Phiếu nhập, Phiếu xuất, Nhật ký hoạt động.

- **Mở ra là Tháng này.** Ví dụ ngày 09/10: Phiếu xuất hiện các phiếu từ 01/10 đến hôm nay. Hai ô gõ ngày cũ bỏ, thay bằng nút bộ lọc.
- **Gõ gì vào ô tìm cũng tìm trên mọi ngày** (mã, tên nguyên liệu, nhà cung cấp, số hoá đơn). Máy chủ bỏ qua khoảng ngày khi ô tìm có chữ; các lọc khác (trạng thái, nhà cung cấp, người, thanh toán, thương hiệu) vẫn áp. Khoảng vẫn nằm trên địa chỉ trang, nên xoá chữ trong ô tìm là khoảng cũ quay lại.
  - Ví dụ: đang ở Tháng này, gõ "ISL-00053" (phiếu ngày 08/09) thì phiếu đó hiện ra. Xoá ô tìm thì danh sách quay về các phiếu tháng 10.
  - Ví dụ: Phiếu nhập, gõ "sữa tươi" thì hiện mọi phiếu nhập có sữa tươi, mới nhất trên đầu. Muốn xem riêng một nhà cung cấp trong tháng, chọn ở ô "Nhà cung cấp" và để trống ô tìm.
- **Danh sách trống nói rõ đã tìm ở đâu.** Có chữ tìm: "Không tìm thấy phiếu nào trên mọi ngày". Không có chữ tìm: "Không có phiếu nào trong Tháng này (01/10/2026 – 31/10/2026)", kèm nút "Xoá lọc" nếu đang có lọc khác.
- Việc bỏ qua khoảng ngày khi có chữ tìm làm ở một chỗ cho mỗi danh sách (trang máy chủ đọc tham số), không rải trong giao diện.

## 5. Báo cáo

### 5.1 Tổng quan và Doanh số

- Dùng nút bộ lọc chung, mở ra là **Tháng này**. Tổng quan bỏ tám nút cũ; Doanh số bỏ ba nút và hai ô lịch, giữ ba ô chọn Thương hiệu, Nhân viên, Nhóm SP và nút "Lọc" của ba ô đó (đổi khoảng ngày thì lọc ngay, không cần bấm "Lọc").
- Doanh số hiện mở ra là "từ đầu tháng đến hôm nay" (`MONTH_TO_DATE`); nay là Tháng này. Con số như nhau vì ngày chưa tới chưa có đơn; chỉ nhãn khác.
- Tổng quan hiện tính "7 ngày" và "30 ngày" theo 24 giờ lùi từ lúc mở trang, nên đơn lúc 08:00 bảy ngày trước có thể rơi ra hoặc vào tuỳ giờ mở. Nay dùng 7 ngày qua, 30 ngày qua của `date-range-presets.ts`: trọn ngày, không tính hôm nay (02/10–08/10 vào ngày 09/10).
- Biểu đồ "7 ngày gần nhất" của Tổng quan giữ nguyên, không theo bộ lọc.

### 5.2 So sánh với kỳ trước

Chỉ Tổng quan và Doanh số. Luôn bật, không có nút tắt.

**Cách lấy kỳ so.** Gọi E là ngày cuối của khoảng, nhưng không quá hôm nay.

| Khoảng (ngày 09/10/2026) | Đang xem | So với |
|---|---|---|
| Hôm nay | 09/10 | 08/10 (hôm trước) **và** 02/10 (thứ Sáu tuần trước) |
| Hôm qua | 08/10 | 07/10 **và** 01/10 |
| Tuỳ chọn một ngày, ví dụ 15/09 | 15/09 | 14/09 **và** 08/09 |
| 7 ngày qua | 02/10–08/10 | 25/09–01/10 |
| 28 ngày qua | 11/09–08/10 | 14/08–10/09 |
| 30 ngày qua | 09/09–08/10 | 10/08–08/09 |
| Tuần này (thứ Hai–Chủ nhật) | 05/10–09/10 | 28/09–02/10 |
| Tuần trước | 28/09–04/10 | 21/09–27/09 |
| Tháng này, Từ đầu tháng đến nay | 01/10–09/10 | 01/09–09/09 |
| Tháng trước | 01/09–30/09 | 01/08–31/08 |
| Quý này | 01/10–09/10 | 01/07–09/07 |
| Quý trước | 01/07–30/09 | 01/04–30/06 |
| Năm nay, Từ đầu năm đến nay | 01/01–09/10/2026 | 01/01–09/10/2025 |
| Năm trước | cả năm 2025 | cả năm 2024 |
| Tuỳ chọn nhiều ngày, ví dụ 15/09–24/09 | 10 ngày | 10 ngày ngay trước: 05/09–14/09 |
| Tuỳ chọn có ngày chưa tới, ví dụ 01/10–20/10 | 01/10–09/10 | 9 ngày ngay trước: 22/09–30/09 |

Luật tính, cho kế hoạch:
- **Một ngày** (ngày đầu bằng ngày cuối): hai kỳ so, lùi 1 ngày và lùi 7 ngày.
- **Tuần, tháng, quý, năm** (này hoặc trước, kể cả "từ đầu … đến nay"): kỳ so bắt đầu ở đầu tuần, tháng, quý, năm liền trước.
  - Nếu E là ngày cuối của tuần, tháng, quý, năm đó (khoảng đã trọn), kỳ so là trọn kỳ liền trước: Tháng trước 01/09–30/09 so với 01/08–31/08, không phải 01/08–30/08. Tháng này xem ngày 31/10 so với 01/09–30/09.
  - Nếu chưa trọn, đầu cuối kỳ so là E lùi đúng một tuần, tháng, quý, năm; ngày không có trong tháng đó thì lấy ngày cuối tháng: Quý này xem ngày 30/11 so với 01/07–30/08; Năm nay xem ngày 29/02/2028 so với 01/01–28/02/2027.
- **7, 28, 30 ngày qua và Tuỳ chọn nhiều ngày**: cùng số ngày, ngay trước ngày đầu.
- **Khoảng bắt đầu sau hôm nay**: không có kỳ so, thẻ ghi "—".
- Tháng này ngày 01/10 là một tháng mới có một ngày: theo luật tháng, so với 01/09, chỉ một kỳ so (luật "một ngày" chỉ dành cho khoảng mà ngày đầu bằng ngày cuối).

**Hiển thị.** Dưới số chính của mỗi thẻ, một dòng cho mỗi kỳ so, ghi phần trăm và ngày của kỳ so, ví dụ:
- "▲ 12.5% so với 01/09 – 09/09"
- Hôm nay: "▲ 8.0% so với hôm qua" và "▼ 3.1% so với thứ Sáu 02/10"
- Kỳ so bằng 0: "Kỳ trước chưa có số" thay vì phần trăm (hiện nay `calcTrend` của Tổng quan trả rỗng khi kỳ trước bằng 0).
Phần trăm một chữ số lẻ, dấu chấm thập phân (`BR-UI-008`, mục ba phần trăm trong `BR-DATA-005`).

**Thẻ nào so.**
- Tổng quan: năm số đang có mũi tên so (doanh thu, số đơn, trung bình mỗi đơn, số ly, trung bình mỗi ly).
- Doanh số: ba thẻ đầu trang (doanh thu thuần, số đơn, trung bình mỗi đơn). Kỳ so dùng đúng các lọc Thương hiệu, Nhân viên, Nhóm SP đang chọn. Kế hoạch chọn cách lấy số kỳ so sao cho không gọi lại toàn bộ `getSalesDataV2` hai lần (hàm đó còn tính món bán chạy, biểu đồ giờ…).

### 5.3 Lãi lỗ

- Dùng nút bộ lọc chung ở chế độ tháng (mục 2), mở ra là **Năm nay**: 01/2026 – 10/2026, mười cột, như hiện nay.
- Khoảng cắt ngang năm được: Quý trước vào tháng 01/2027 là 10/2026 – 12/2026; Tuỳ chọn 07/2025 – 06/2026 là mười hai cột qua hai năm.
- Năm nay và Từ đầu năm đến nay ra cùng các cột (tháng sau tháng hiện tại không có cột). Giữ cả hai vì chủ quán liệt kê cả hai.
- Không so với kỳ trước.
- Phần tính: `computeProfitAndLoss` nhận tháng đầu và tháng cuối thay cho năm; lấy dữ liệu theo khoảng đó thay cho cả năm. Trang trống ghi "Từ 07/2025 đến 06/2026 chưa có số liệu nào."
- Không giới hạn số cột. Kế hoạch kiểm `PnlTableView` và `PnlMonthCards` với 24 cột trên máy tính và điện thoại.

### 5.4 Bỏ trang Tổng kết ngày

Bỏ cùng đợt với phần so sánh, để không có lúc nào mất dòng "so hôm qua" và "so cùng thứ tuần trước".
- Xoá `app/admin/reports/daily/` (trang, bộ lọc, actions, ba test), `lib/reports/daily-digest.ts` và test của nó.
- Bỏ "Tổng kết ngày" khỏi menu `app/admin/nav-items.ts` và `app/admin/nav-items.test.ts`.
- Địa chỉ cũ `/admin/reports/daily` chuyển sang `/admin/reports/sales?range=TODAY` (chuyển hướng trong cấu hình Next, không giữ thư mục trang), để lối tắt đã lưu trên điện thoại không ra trang lỗi.
- Sửa tài liệu đang nhắc trang này: `docs/03-workflows/reports.md` (dòng 4, 18, 50), `docs/02-rules/business-rules/data-integrity.md` dòng 67, bảng menu trong `docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md` dòng 89.
- Ô "Cần đặt hàng sớm" của trang này đang tắt; bỏ theo trang. Không chuyển đi đâu.

## 6. Sổ thu chi

Đổi ô xổ 16 khoảng sang nút bộ lọc chung, mặc định vẫn Tháng này. Tham số đổi từ `preset/start/end` sang `range/from/to`. Số đầu kỳ, cuối kỳ không đổi cách tính.

## 7. Chia việc

Theo `CLAUDE.md`, mục "Ai viết code": phần trong `lib/` và trang máy chủ giao Sonnet; giao diện giao Gemini qua `agy`; Opus viết test chấp nhận, soát lại.

| Đợt | Việc | Ai |
|---|---|---|
| T1 | `date-range-params.ts`, `compare-periods.ts`, test bảng mục 5.2 | Sonnet |
| T2 | `DateRangeButton` (máy tính, điện thoại, chế độ tháng); Sổ thu chi chuyển sang; xoá `DateRangeFilter` | Gemini |
| T3 | Bốn danh sách: mặc định Tháng này, tìm trên mọi ngày, chữ danh sách trống | Sonnet (trang máy chủ, `lib/`) + Gemini (giao diện) |
| T4 | Tổng quan, Doanh số, so sánh; bỏ Tổng kết ngày | Sonnet + Gemini |
| T5 | Lãi lỗ theo khoảng tháng | Sonnet + Gemini |

T1 trước; T2 trước T3–T5. Mỗi đợt xanh đủ năm lệnh trước khi sang đợt sau.

Kế hoạch kèm một ví dụ bằng số thật, đo trên máy chủ lúc viết kế hoạch: doanh thu và số đơn Tháng này so với 01/09–09/09, và Hôm nay so với hôm qua và thứ Sáu tuần trước, để chủ quán bấm thử đối chiếu.

## 8. Test

- `date-range-params`: mỗi luật mục 3 (thiếu `range` có `from/to`; khoảng lạ; ngày hỏng; ngày đầu sau ngày cuối; `year=` của Lãi lỗ; biến thể tháng).
- `compare-periods`: từng dòng bảng mục 5.2, cộng ngày 31/10, 29/02/2028, Quý trước vào tháng 1, khoảng bắt đầu sau hôm nay.
- `DateRangeButton`: bấm khoảng có sẵn báo thay đổi ngay; Tuỳ chọn chỉ báo khi bấm Áp dụng; Áp dụng mờ khi ngày sai; Huỷ giữ khoảng cũ; máy tính 16 khoảng, điện thoại 9 nút; khoảng không có nút trên điện thoại vẫn ghi đúng tên; chế độ tháng.
- Danh sách: không tham số thì lọc Tháng này; có chữ tìm thì bỏ qua khoảng ngày nhưng giữ lọc khác; chữ danh sách trống.
- Tổng quan, Doanh số: kỳ so đúng ngày; kỳ trước bằng 0 ghi "Kỳ trước chưa có số".
- Lãi lỗ: khoảng tháng cắt ngang năm; `year=` cũ.
- Menu: "Tổng kết ngày" không còn; `/admin/reports/daily` chuyển hướng.
- `app/admin/no-popups.test.ts` xanh, không thêm tên.
