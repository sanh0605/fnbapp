# Báo cáo lãi lỗ theo tháng — đặc tả

Ngày: 2026-09-11. Chốt với chủ quán trong phiên cùng ngày, sau khi chủ quán bấm
thử trang xem thử bằng số thật:
https://claude.ai/code/artifact/bc2aced4-378c-43b5-8cee-93f80cfdf2d7

## Vì sao làm

Chủ quán tự tính lãi lỗ bằng tay trong Google Sheet "Beverages CCDC - Phin Đi &
Uchako" (bảng PNL, mỗi tháng một dòng). App đã có đủ nguyên liệu để tính thay:
doanh thu, giá vốn, đơn nhập, sổ thu chi, sổ dụng cụ. Nhưng chưa có trang nào
ghép chúng lại. Hai khoản app đã tính ra mà chưa dẫn đi đâu:

- Nguyên liệu mua dùng ngay (`BR-COGS-007`, dòng thứ ba chủ quán chốt 2026-08-19).
- Khấu hao dụng cụ (`BR-COGS-008`: "Not yet consumed anywhere").

`getPnLDataV2` trong `app/admin/reports/actions.ts` ghi sẵn rằng báo cáo lãi lỗ
đang được làm lại thành báo cáo tài chính thật. Đây là đợt đó.

## Luật đòi gì, và vì sao làm bảng quản trị trước

Tra 2026-09-11 (nguồn ở cuối file):

- **Hộ kinh doanh.** Doanh thu dưới 1 tỷ/năm (NĐ 141/2026) thì không nộp thuế.
  Thông tư 152/2025, Điều 4, chỉ bắt giữ sổ doanh thu S1a-HKD (ngày, diễn giải,
  số tiền). Không có báo cáo tài chính. Thông tư vẫn ghi mốc 500 triệu; mốc
  1 tỷ là do NĐ 141/2026 nâng. Việc S1a-HKD nay áp cho mức dưới 1 tỷ là em suy
  ra, chưa đọc văn bản gốc.
- **Công ty siêu nhỏ** (quán sẽ thuộc loại này). Theo Thông tư 58/2026/TT-BTC
  (hiệu lực 01/07/2026, thay TT 132/2018), nếu nộp thuế thu nhập theo lợi nhuận
  thì mỗi năm lập B01-DNSN và B02-DNSN, chậm nhất 90 ngày sau khi hết năm.
  Không bắt buộc báo cáo dòng tiền. B02-DNSN chỉ có năm chỉ tiêu:
  - 01: doanh thu và thu nhập thuần;
  - 02: các khoản chi phí;
  - 03: lợi nhuận trước thuế;
  - 10: thuế thu nhập doanh nghiệp;
  - 20: lợi nhuận sau thuế.

Cho chủ quán xem những điều trên, chủ quán chọn **làm lãi lỗ theo tháng trước**
(2026-09-11), đổi thứ tự "đúng luật trước" đã chọn ngày 2026-09-06. Bảng
tháng chi tiết hơn B02-DNSN. Cộng dồn các dòng của bảng ra đúng năm chỉ tiêu
đó, nên sau này làm mẫu nộp nhà nước chỉ là trình bày lại.

## Hiện trạng đo được (2026-09-11)

- Doanh thu: `getPnLDataV2` từng tháng. Tháng 4 là 2.190.000đ, tháng 6 là
  22.157.000đ, tháng 8 là 17.682.000đ (644 đơn).
- Giá vốn: cũng từ `getPnLDataV2`. Tháng 4, 5, 6 bằng 0; tháng 7 là 48.600đ;
  tháng 8 là 46.418.990đ, trong đó 34.864.627đ là lần kiểm kho `STK-001` còn
  11.554.363đ là 37 phiếu xuất. Hao hụt bằng 0 ở mọi tháng.
- Nguyên liệu mua dùng ngay: đơn nhập đã hoàn tất, dòng hàng có
  `purchased_items.is_non_inventory = true`. 15 món có cờ này. Tính theo giá đã
  trả (`BR-COGS-006`). Tháng 8 là 1.760.000đ:
  - Đá viên 990.000đ;
  - Khoai lang 680.000đ;
  - Trái tắc 60.000đ;
  - Túi đựng khoai 30.000đ.
- Sổ thu chi: 38 dòng, 6 nhóm. Hai dòng doanh thu bị mất (`CE-033`, `CE-034`,
  8.411.868đ) chủ quán đã tự dời sang 2026-04-30. Chủ quán cũng đã tự tạo
  nhóm Thu "Doanh thu ghi tay" (`CFC-006`, tính vào lãi lỗ) và chuyển hai dòng
  đó sang nhóm này (đo 2026-09-11, trước khi có đặc tả). Nhóm "Thu khác"
  (`CFC-004`) nay không còn dòng nào.
- Khấu hao: 84 dụng cụ, 2 lần thanh lý. Cộng lịch khấu hao từng món
  (`lib/assets/asset-depreciation.ts`): tháng 7 là 982.050đ, tháng 8 là
  790.978đ.
- Phiếu xuất ghi món không quản lý tồn: 2 dòng, cùng món Khăn lau đa năng,
  +1 rồi −1, cộng lại bằng 0.
- Tài khoản đang dùng: 1 ADMIN, 1 MANAGER.

Đã xem:

- `app/admin/reports/actions.ts` và `app/admin/reports/issued/actions.ts`;
- `lib/assets/asset-depreciation.ts`;
- `docs/02-rules/business-rules/cogs.md`, `sales.md` và `cash-book.md`;
- bảng PNL trong Sheet của chủ quán.

Chưa xem:

- phần ruột của `lib/costing/issue-costing.ts`;
- `computeIssuedMonthFigures` (`lib/reports/issued-value-report.ts`) có tách
  được theo `is_shrinkage` không.

## Chủ quán đã chốt (2026-09-11)

| Câu hỏi | Chốt | Lời chủ quán |
|---|---|---|
| Làm gì trước | Lãi lỗ theo tháng | "Lãi lỗ theo tháng" |
| Hai khoản doanh thu mất | Tính vào doanh thu, dòng riêng | "Tính vào doanh thu", đã dời sang 30/04 |
| Tách quán | Một bảng chung, không tách cả doanh thu | "Chỉ một bảng chung" |
| Ai xem | ADMIN và quản lý | "Anh và quản lý" |
| Kiểu bảng | Tháng theo cột, khoản theo dòng | "Tháng theo cột" |

Bốn điều này đã ghi thành `BR-PNL-001` đến `BR-PNL-004` trong
`docs/02-rules/business-rules/profit-and-loss.md`; điều về hai khoản doanh thu
mất cũng nằm trong `BR-CASH-001`.

Đã chốt từ trước, không hỏi lại:

- `BR-COGS-005`: tháng 6 và tháng 7 có lãi gộp gần bằng doanh thu.
- `BR-COGS-007`: `STK-001` ở lại trong giá vốn mãi mãi.
- `BR-CASH-003`: vốn góp không vào lãi lỗ.
- `BR-SALE-005`: doanh thu trước 19/07/2026 không kiểm chứng được.
- Không khoá sổ ("khoan làm tới kế toán", 2026-09-08).

## Phạm vi

Trong đợt này:

- Trang Lãi lỗ, lối vào ở menu Báo cáo, đường dẫn `/admin/reports/pnl`.
- Một cờ mới trên nhóm thu chi: "Tính là doanh thu bán hàng".
- Bỏ phiếu xuất của món không quản lý tồn ra khỏi giá vốn (xem mục Giá vốn).

Cố ý để ngoài:

- báo cáo dòng tiền;
- mẫu nộp nhà nước (S1a-HKD, B01-DNSN, B02-DNSN);
- thuế;
- tách theo quán;
- khoá sổ;
- xuất ra Excel;
- ngân sách, so với kế hoạch.

## Trang trông thế nào

Theo đúng trang thử, kiểu "tháng theo cột".

**Trên cùng:** ô chọn năm, mặc định năm hiện tại. Năm nào có dữ liệu mới có
trong danh sách.

**Bốn ô số:**

- doanh thu từ đầu năm;
- lợi nhuận ròng từ đầu năm, kèm biên lợi nhuận;
- tháng lời nhất;
- tháng lỗ nhất, nếu có tháng lỗ.

**Biểu đồ:** mỗi tháng một cột lời (xanh) hoặc lỗ (đỏ), cộng một đường "cộng
dồn từ đầu năm".

**Bảng:**

- Mỗi tháng một cột, từ tháng đầu tiên có dữ liệu của năm đó đến tháng hiện
  tại. Tiếp theo là cột Tổng, rồi cột % doanh thu.
- Tháng đang chạy ghi thêm "đến dd/mm".
- Các dòng, từ trên xuống:

| Dòng | Lấy từ | Hiện khi |
|---|---|---|
| Doanh thu | Doanh thu máy bán hàng + Doanh thu ghi tay | luôn |
| · trong đó ghi tay | dòng sổ thuộc nhóm có cờ "Tính là doanh thu bán hàng" | năm đó có |
| Giá vốn | phiếu xuất kho + lần kiểm kho không tính hao hụt | luôn |
| Nguyên liệu mua dùng ngay | đơn nhập, món không quản lý tồn | luôn |
| Hao hụt | lần kiểm kho tính hao hụt | năm đó có |
| **Lợi nhuận gộp** | Doanh thu − ba dòng trên | luôn |
| Một dòng cho mỗi nhóm Chi | sổ thu chi, nhóm Chi, tính vào lãi lỗ | nhóm đang dùng, hoặc năm đó có số |
| Khấu hao | sổ dụng cụ | luôn |
| Thu khác | sổ thu chi, nhóm Thu, tính vào lãi lỗ, không phải doanh thu | năm đó có |
| **Lợi nhuận ròng** | Lợi nhuận gộp − chi phí + Thu khác | luôn |
| Biên lợi nhuận | Lợi nhuận ròng ÷ Doanh thu | luôn |
| Cộng dồn từ đầu năm | cộng Lợi nhuận ròng từ tháng đầu năm | luôn |

**Bấm một ô là hiện các khoản làm nên ô đó,** ngay dưới bảng:

| Dòng | Hiện |
|---|---|
| Doanh thu | số đơn máy bán hàng, từng dòng ghi tay |
| Giá vốn, Hao hụt | từng lần kiểm kho và từng phiếu xuất, kèm ngày và giá trị |
| Nguyên liệu mua dùng ngay | từng món, kèm mã đơn nhập |
| Nhóm chi, Thu khác | từng dòng sổ: ngày, ghi chú, số tiền |
| Khấu hao | từng dụng cụ có khấu hao tháng đó |
| Dòng lợi nhuận | phép tính |

**Ghi chú dưới bảng** chỉ hiện khi dữ liệu có, không viết cứng:

1. Tháng có doanh thu ghi tay: nêu số tiền.
2. Tháng có lần kiểm kho không tính hao hụt: nêu giá trị và ngày, nói rõ đó là
   hàng đã dùng mà chưa ghi.
3. Tháng trước ngày bắt đầu có sổ tiền nhận (`order_payments` bắt đầu
   2026-07-19; lấy ngày này từ dữ liệu): doanh thu không có sổ tiền để đối
   chiếu (`BR-SALE-005`).

**Trên điện thoại:**

- Không dùng bảng ngang (`.claude/rules/ui-devices.md`).
- Trên cùng là thẻ tổng năm.
- Sau đó mỗi tháng một thẻ, tháng mới nhất ở trên. Thẻ hiện lợi nhuận ròng và
  doanh thu; chạm vào thì mở các dòng.
- Chạm một dòng thì hiện các khoản làm nên nó, như trên máy tính.

Chữ hiển thị tiếng Việt, số tiền dấu chấm ngăn nghìn. Số âm có dấu trừ và màu
đỏ.

## Cách tính từng dòng

Mọi tháng tính theo giờ Sài Gòn. Trang **tính lại từ dữ liệu gốc mỗi lần mở**,
không lưu bảng tổng, không khoá tháng. Sửa một đơn nhập hay một dòng sổ của
tháng cũ thì tháng đó đổi theo. Đây là hệ quả của việc chủ quán bác khoá sổ,
cũng là cách `BR-COGS-006` đã chọn: không lưu giá vốn đã tính.

- **Doanh thu máy bán hàng.** Đúng bộ lọc của `getPnLDataV2`: đơn COMPLETED,
  bản mới nhất, theo ngày tạo đơn. Tổng từng tháng phải bằng
  `getPnLDataV2({tháng}).totalRevenue` đến từng đồng.
- **Doanh thu ghi tay.** Dòng sổ ACTIVE thuộc nhóm Thu có `affects_pnl` và có
  cờ mới. Tính theo `entry_date`.
- **Giá vốn và Hao hụt.** Cùng bộ máy với `getPnLDataV2`
  (`computePeriodIssuedValueSplit`, tách theo `stocktake_sessions.is_shrinkage`).
  Với mọi tháng, Giá vốn + Hao hụt phải bằng `getPnLDataV2({tháng}).totalCOGS`.
- **Món không quản lý tồn không bao giờ vào giá vốn.** Tiền của chúng đã tính
  lúc mua, trên dòng Nguyên liệu mua dùng ngay. Nếu phiếu xuất của các món này
  vẫn vào giá vốn thì tiền bị tính hai lần. Việc bỏ ra làm ở hàm lọc dùng chung
  (cạnh `filterOutEquipmentIssues`), nên `getPnLDataV2` và trang Giá trị hàng đã
  xuất cũng đổi theo. Đo 2026-09-11 thì mức ảnh hưởng là 0đ, vì chỉ có 2 phiếu
  và chúng triệt tiêu nhau. `scripts/verify-cogs.ts` phải được sửa trong cùng
  lần lưu để giữ Gate 2.
- **Nguyên liệu mua dùng ngay.**
  - Tính từ đơn nhập COMPLETED, lấy các dòng có `is_non_inventory`.
  - Số tiền là phần đã phân bổ theo `allocatePurchaseOrderCost` (`BR-COGS-006`).
  - Tháng theo `transaction_date`.
  - Món thuộc nhóm Dụng cụ không bao giờ tính vào dòng này, vì đã khấu hao.
- **Chi phí theo nhóm.** Dòng sổ ACTIVE, nhóm Chi có `affects_pnl`. Tính theo
  `entry_date`. Dòng đã huỷ không tính (`BR-CASH-002`). Nhóm Chi không tính vào
  lãi lỗ thì đứng ngoài bảng.
- **Khấu hao.** Cộng `chargeForMonth` của `buildAssetSchedule` từng dụng cụ.
  Tháng thanh lý mang phần giá trị còn lại (`BR-COGS-008`). Tháng đang chạy
  tính trọn tháng, giống Sheet của chủ quán.
- **Làm tròn.** Theo luật của chủ quán ngày 2026-07-30 (`displayMoney`):
  - Mỗi ô chi phí làm tròn lên từ số chính xác của chính nó.
  - Ô Tổng làm tròn từ tổng chính xác, không cộng các ô đã làm tròn.
  - Lợi nhuận tính từ số chính xác (`BR-COGS-007`, mục làm tròn).

  Nên cộng tay các ô tháng có thể lệch ô Tổng vài đồng. Kế hoạch phải có phép
  kiểm cho chuyện này. Ghi chú dưới bảng nói rõ lý do khi có lệch.

## Cờ "Tính là doanh thu bán hàng"

Thêm cột boolean `cash_categories.is_sales_revenue`, mặc định `false`. Ô đánh
dấu nằm trên form nhóm thu chi. Chỉ đánh dấu được khi nhóm là Thu và có tính
vào lãi lỗ. Bỏ "Tính vào lãi lỗ" thì cờ này cũng tự bỏ, và máy chủ từ chối cờ
bật trên nhóm Chi hoặc nhóm không tính vào lãi lỗ.

Cờ nằm trên nhóm, không nằm trên từng dòng, cùng lối với `affects_pnl`
(`BR-CASH-003`). Đổi cờ thì mọi dòng cũ của nhóm được tính lại, nên form hỏi
lại trước khi lưu, như `affects_pnl`. Đây là luật mới `BR-CASH-006`, ghi cùng
lần lưu với test.

Nhóm "Doanh thu ghi tay" đã có sẵn và đã chứa hai dòng. Sau khi lên bản mới,
chủ quán chỉ còn một việc: mở nhóm đó và đánh dấu ô "Tính là doanh thu bán
hàng". Migration không tự đánh dấu hộ, nên không có ghi vào dữ liệu thật ngoài
cú bấm của chủ quán. Chưa đánh dấu thì hai dòng hiện ở dòng "Thu khác" của
bảng. Chúng vẫn cộng vào lợi nhuận ròng, nhưng Doanh thu tháng 4 thiếu
8.411.868đ.

## Ví dụ bằng số thật

Đo 2026-09-11 bằng script đọc, chưa phải bằng hàm của trang. Giả định nhóm
"Doanh thu ghi tay" đã được đánh dấu cờ. Số sẽ đổi khi dữ liệu đổi,
ví dụ khi chủ quán tạo đơn đá viên tháng 6 (935.000đ, đang chờ xác nhận).

| Khoản | 04 | 06 | 07 | 08 | 09 (đến 11/09) | Tổng năm |
|---|---:|---:|---:|---:|---:|---:|
| Doanh thu | 10.601.868 | 22.157.000 | 18.661.000 | 17.682.000 | 5.054.000 | 81.830.868 |
| · ghi tay | 8.411.868 | | | | | 8.411.868 |
| Giá vốn | 0 | 0 | 48.600 | 46.418.990 | 1.678.674 | 48.146.264 |
| NL mua dùng ngay | 506.597 | 2.438.727 | 2.891.814 | 1.760.000 | 360.000 | 8.173.198 |
| **Lợi nhuận gộp** | 10.095.271 | 19.718.273 | 15.720.586 | −30.496.990 | 3.015.326 | 25.511.406 |
| Vận hành | 540.000 | 470.000 | 275.000 | 615.000 | 1.057.000 | 2.957.000 |
| Điện, nước, gas | 0 | 470.000 | 470.000 | 470.000 | 470.000 | 1.880.000 |
| Marketing | 0 | 0 | 330.000 | 0 | 0 | 750.000 |
| Khấu hao | 319.595 | 598.477 | 982.050 | 790.978 | 790.978 | 4.104.777 |
| **Lợi nhuận ròng** | 9.235.676 | 18.179.796 | 13.663.536 | −32.372.968 | 697.348 | 15.819.629 |
| Cộng dồn | 9.186.450 | 33.831.713 | 47.495.249 | 15.122.281 | 15.819.629 | |

Tháng 3 và tháng 5 không in trong bảng này cho gọn:

| Khoản | 03 | 05 |
|---|---:|---:|
| Doanh thu | 0 | 7.675.000 |
| NL mua dùng ngay | 0 | 216.060 |
| Marketing | 0 | 420.000 |
| Khấu hao | 49.226 | 573.473 |
| **Lợi nhuận ròng** | −49.226 | 6.465.467 |

Cột Tổng năm tính cả hai tháng này.

**So với Sheet của chủ quán, tháng 8:** lợi nhuận ròng −32.128.725đ trong Sheet,
−32.372.968đ ở đây, lệch 244.243đ. Có hai lý do:

- Sheet để đá viên, tắc, khoai lang trong Vận hành (1.695.000đ). App tách chúng
  ra dòng Nguyên liệu mua dùng ngay.
- Sheet chia khấu hao đều 12 tháng (1.226.735đ). App tính theo thời hạn từng món.

Chủ quán đã được cho xem cả hai lý do trước khi chốt.

## Quyền

`requireAdmin` (ADMIN và MANAGER), giống các báo cáo đang có. Chủ quán đề nghị
chỉ ADMIN, rồi chọn cho quản lý xem luôn.

## Kiểm tra khi xong

Phải đạt cả bốn:

- Mọi tháng: Doanh thu máy bán hàng = `getPnLDataV2(tháng).totalRevenue`, và
  Giá vốn + Hao hụt = `getPnLDataV2(tháng).totalCOGS`.
- Bảng số thật ở trên khớp đến từng đồng, trừ những ô mà dữ liệu đã đổi. Ô nào
  đổi thì giải thích bằng dữ liệu.
- `npx vite-node scripts/verify-cogs.ts` xanh sau khi bỏ phiếu xuất của món
  không quản lý tồn.
- Chủ quán mở trên máy tính và điện thoại, bấm ô "Vận hành tháng 8" và thấy
  đủ 4 dòng sổ.

## Nguồn luật

- [TT 152/2025 – luatvietnam](https://luatvietnam.vn/ke-toan/thong-tu-152-2025-tt-btc-huong-dan-ke-toan-cho-ho-kinh-doanh-ca-nhan-kinh-doanh-423164-d1.html)
- [TT 58/2026 – luatvietnam](https://luatvietnam.vn/doanh-nghiep/thong-tu-58-2026-tt-btc-huong-dan-che-do-ke-toan-cho-doanh-nghiep-sieu-nho-435647-d1.html)
- [Mẫu B02-DNSN – luatvietnam](https://luatvietnam.vn/bieu-mau/mau-so-b02-dnsn-bao-cao-ket-qua-hoat-dong-kinh-doanh-cua-doanh-nghiep-sieu-nho-571-109415-article.html)
- [TT 58/2026 thay TT 132/2018 – MISA](https://asp.misa.vn/tt/kien-thuc/chinh-thuc-tu-01-07-2026-thong-tu-58-2026-tt-btc-thay-the-thong-tu-132-2018-tt-btc-huong-dan-che-do-ke-toan-doanh-nghiep-sieu-nho/)
