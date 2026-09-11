# Báo cáo lãi lỗ theo tháng — kế hoạch thực hiện

> **Cho agent thực thi:** BẮT BUỘC dùng skill `superpowers:subagent-driven-development`
> (khuyến nghị) hoặc `superpowers:executing-plans` để làm từng mục một. Các bước
> viết dạng ô đánh dấu (`- [ ]`) để theo dõi. Mỗi mục do một agent mới làm; Opus
> soát xong mục này mới giao mục sau.

**Mục tiêu:** Trang `/admin/reports/pnl` cho chủ quán và quản lý xem lãi lỗ từng
tháng của cả năm, tháng theo cột, bấm vào ô nào cũng thấy các khoản làm nên ô đó,
dùng được trên cả máy tính lẫn điện thoại.

**Cách làm:** Một module thuần `lib/reports/profit-and-loss.ts` ghép số từ những
bộ máy đã có (doanh thu như `getPnLDataV2`, giá vốn bằng
`computePeriodIssuedValueSplit`, đơn nhập phân bổ theo `BR-COGS-006`, sổ thu chi,
lịch khấu hao). Một module thuần thứ hai `lib/reports/profit-and-loss-table.ts`
làm tròn và dựng bảng hiển thị. Một server action mỏng nạp dữ liệu. Trang chỉ vẽ.
Thêm một cờ trên nhóm thu chi để tách doanh thu ghi tay ra khỏi Thu khác. Không
lưu bảng tổng nào: mỗi lần mở là tính lại từ dữ liệu gốc.

**Công nghệ:** Next.js 14.2 App Router (`searchParams` là object thường, không phải
Promise), TypeScript, Supabase Postgres, Vitest, `vite-node` cho script.

**Đặc tả:** `docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md`, chủ quán
duyệt 2026-09-11 ("Được"). Đọc trước; kế hoạch này bám theo nó. Luật chủ quán đã
chốt: `BR-PNL-001` đến `BR-PNL-004` trong
`docs/02-rules/business-rules/profit-and-loss.md`.

---

## Hiện trạng

Đo ngày 2026-09-11 trên nhánh `main`, bằng script chỉ đọc chạy vào máy chủ thật.

- **Chưa có trang lãi lỗ.** `app/admin/reports/pnl/page.tsx` cũ đã bị xoá
  2026-08-05, đường dẫn đang trống. `getPnLDataV2` (`app/admin/reports/actions.ts:100`)
  vẫn còn và là cửa kiểm doanh thu, giá vốn của đợt này. Không sửa hành vi của nó
  ngoài bộ lọc ở Mục 1.
- **Doanh thu** trong `getPnLDataV2`: đơn `COMPLETED`, không có `superseded_by`,
  `created_at` nằm trong khoảng giờ Sài Gòn, cộng `coerceOrderV2(o).net_total`.
- **Giá vốn** trong `getPnLDataV2`: `buildIssueCostingPurchases` (chỉ đơn nhập
  `COMPLETED`, phân bổ phí ship/thuế/voucher/giảm giá theo `BR-COGS-006`, ngày lấy
  `transaction_date || created_at`) → `filterOutEquipmentIssues` →
  `computePeriodIssuedValue` (tổng) và `computePeriodIssuedValueSplit` (tách giá vốn
  và hao hụt theo `stocktake_sessions.is_shrinkage`). `totalCOGS` trả ra là
  `displayMoney` của tổng chính xác. Hôm nay `displayMoney` làm tròn lên; từ
  Mục 0 nó làm tròn về đồng gần nhất.
- **Làm tròn, luật mới của chủ quán 2026-09-11** (`BR-DATA-005`,
  `docs/02-rules/business-rules/data-integrity.md`): tính chính xác, chỉ làm tròn
  khi hiện ra, về đồng gần nhất, không số lẻ; lưu số gốc, không lưu kết quả. Thay
  luật 2026-07-30 (chi phí làm tròn lên, tồn kho làm tròn xuống). Code hôm nay còn
  hai chỗ chạm tới trang này: `lib/reports/display-rounding.ts` (làm tròn lên/xuống)
  và `lib/assets/asset-depreciation.ts:235,248` (làm tròn khấu hao từng tháng, tháng
  cuối gánh phần dư). Mục 0 sửa cả hai. `displayMoney`, `displayStock` chỉ có ba nơi
  gọi ngoài test: `app/admin/reports/actions.ts`, `app/admin/reports/issued/actions.ts`,
  `scripts/verify-cogs.ts`. `formatNumber` (`lib/shared/format.ts`) vốn đã hiện số
  nguyên, làm tròn nửa ra xa số 0, nên số khấu hao có phần lẻ vẫn hiện tròn trên
  trang dụng cụ mà không phải sửa trang đó.
- **Món không quản lý tồn** = `purchased_items.is_non_inventory` là `true` hoặc
  `"TRUE"`. Từ 2026-09-01 đây là phép thử duy nhất (màn kiểm kho và màn phiếu xuất
  đều chỉ đọc cờ của chính món, `app/admin/inventory/stocktake/actions.ts:232`,
  `app/admin/inventory/issue-slips/actions.ts:79`). 15 món có cờ, không món nào
  thuộc nhóm Dụng cụ.
- **Phiếu xuất của món không quản lý tồn:** 2 dòng trên 146 dòng `stock_issues`,
  cùng món Khăn lau đa năng (`SPM-057`):
  - `ISS-00120`, 02/09/2026 02:24 giờ Sài Gòn, +1, phiếu `ISL-00042`;
  - `ISS-00121`, 02/09/2026 02:25 giờ Sài Gòn, −1, không có phiếu.

  Hai dòng triệt tiêu nhau, nên bỏ ra thì giá vốn tháng 9 không đổi đồng nào. Hôm
  nay chúng vẫn đi vào giá vốn vì chưa có bộ lọc.
- **Lỗi nhỏ đang có:** `app/admin/reports/issued/actions.ts:96` gọi
  `computeIssuedEventFigures(stockIssues, purchases)` bằng `stockIssues` **chưa lọc**,
  nên tab "Theo lần xuất" vẫn tính phiếu xuất dụng cụ nếu có. Hôm nay 0 phiếu như
  vậy, nên chưa ai thấy. Sửa ở Mục 1.
- **Sổ thu chi:** 38 dòng, 6 nhóm (`CFC-001`…`CFC-006`). Chủ quán đã tự tạo nhóm Thu
  "Doanh thu ghi tay" (`CFC-006`, tính vào lãi lỗ) và chuyển `CE-033`, `CE-034`
  (8.411.868đ, ngày 2026-04-30) vào đó. Nhóm "Thu khác" (`CFC-004`) nay trống.
  Vốn góp (`CE-024`, 1.472.000đ) thuộc nhóm không tính vào lãi lỗ.
- **Bảng `cash_categories`** (`supabase/migrations/0101_cash_book.sql:6`) có `kind`,
  `affects_pnl`, `status` và sáu cột dấu vết. Chưa có cột nào nói "đây là doanh thu
  bán hàng". Migration mới nhất là `0101`; migration của đợt này là `0102`.
- **Form nhóm thu chi** (`app/admin/finance/categories/components/CategoryForm.tsx`):
  ô Bên (Thu/Chi) là select không điều khiển (`defaultValue`), bị khoá khi nhóm đã
  có dòng sổ; ô "Tính vào lãi lỗ" là checkbox điều khiển, đổi trên nhóm đã có dòng
  thì hỏi lại (`shouldConfirmAffectsPnlChange`).
- **Khấu hao:** 84 dụng cụ, đều `ACTIVE`, 2 lần thanh lý, 0 lỗi dựng lịch.
  `buildAssetSchedule` + `chargeForMonth` (`lib/assets/asset-depreciation.ts`). Trang
  dụng cụ bỏ dụng cụ `INACTIVE` (`app/admin/inventory/assets/actions.ts:57`).
- **Sổ tiền nhận** (`order_payments`): dòng đầu tiên lúc 2026-07-19 23:34 giờ UTC,
  tức **06:34 ngày 20/07/2026 giờ Sài Gòn**. `BR-SALE-005` ghi "2026-07-19" là ngày
  UTC; trang Lãi lỗ tính theo giờ Sài Gòn nên ghi chú của nó in 20/07/2026. Đơn bán
  trước mốc này: tháng 4, 5, 6 toàn bộ, tháng 7 là 12.215.000đ trên 18.661.000đ.
- **Kiểm kho:** `STK-001` đã xác nhận, `is_shrinkage = false` (34.864.627đ nằm trong
  giá vốn tháng 8); `STK-002` đã huỷ. Hao hụt bằng 0 ở mọi tháng.
- **Menu** "Báo cáo" ở `app/admin/layout.tsx:70`. Trang mới không có lối vào menu thì
  `app/admin/nav-guard.test.ts` đỏ. Đường dẫn mới phải nằm trong `routes:` của
  `docs/03-workflows/reports.md`, không thì cửa tài liệu `route-coverage` đỏ.
- **Cửa tài liệu cần biết trước:** mọi file `lib/**/*.ts` phải được một file không
  phải test import (`orphan-modules`); lưu `app/admin/finance/categories/actions.ts`
  hay `lib/finance/cash-entry-rules.ts` thì phải lưu kèm
  `docs/03-workflows/cash-book.md` (`flow-doc-staged`); file tài liệu không quá 200
  dòng (`line-ceiling`).

Đã xem: `app/admin/reports/actions.ts`, `app/admin/reports/issued/actions.ts` và
`page.tsx`, `lib/costing/issue-costing-inputs.ts`, `lib/costing/issue-costing.ts`
(hai hàm tính theo kỳ), `lib/reports/issued-value-report.ts`,
`lib/reports/display-rounding.ts`, `lib/shared/report-time.ts`,
`lib/assets/asset-depreciation.ts` (các hàm xuất ra), `app/admin/inventory/assets/actions.ts`,
`app/admin/finance/categories/actions.ts`, `CategoryForm.tsx` và hai file test của
chúng, `types/db.ts` (`DBCashCategory`, `DBCashEntry`, `DBAsset`),
`supabase/migrations/0101_cash_book.sql`, `tests/migrations/cash-book-migration.test.ts`,
`scripts/verify-cogs-core.ts` và `verify-cogs.ts` (Gate 2), `lib/db/tables.ts`
(`findAllWhere` có tự phân trang), `docs/03-workflows/reports.md`, `cash-book.md`,
`app/admin/layout.tsx`, `docs/02-rules/business-rules/cogs.md`, `coerceOrderV2`
(`lib/sales/order-types.ts`), ruột `buildAssetSchedule`,
`lib/costing/purchase-order-cost-allocation.ts`, `lib/assets/asset-purchase-allocation.ts`,
`lib/shared/format.ts`, `lib/auth/auth.ts` (`requireAdmin`).

**Chưa xem:** `CategoriesList.tsx` ngoài dòng 124 và 170; `components/ui/FormModal.tsx`;
thân `app/admin/nav-guard.test.ts`; ruột các cửa trong `scripts/doc-checks/`; các
test hiện có đang ghi cứng số làm tròn lên (Mục 0 phải tự tìm, xem bước 5 của mục đó);
`DisposeAssetForm.tsx` ngoài dòng 139.

## Năm câu bắt buộc

**1. Có mấy trạng thái, đặt mỗi trạng thái bằng cách nào?**

Trang không lưu gì, nên không có trạng thái riêng. Nó đọc trạng thái của dữ liệu
khác, và mỗi trạng thái quyết định số có được tính không:

| Dữ liệu | Được tính | Bị bỏ |
|---|---|---|
| Đơn bán | `COMPLETED`, không bị bản mới thay | mọi trạng thái khác, bản cũ đã bị thay |
| Dòng sổ thu chi | `ACTIVE` | `CANCELLED` (`BR-CASH-002`) |
| Nhóm thu chi | nhóm tính vào lãi lỗ, kể cả đã ngừng dùng | nhóm không tính vào lãi lỗ (vốn góp) |
| Đơn nhập | `COMPLETED` | nháp, đã huỷ |
| Lần kiểm kho | theo `is_shrinkage`: `false` vào Giá vốn, còn lại vào Hao hụt | phiên đã huỷ không ghi `stock_issues` nên tự không có |
| Dụng cụ | mọi trạng thái trừ `INACTIVE` | `INACTIVE` (nhập nhầm), giống trang dụng cụ |

Trạng thái mới duy nhất của đợt này là cờ `cash_categories.is_sales_revenue`
("Tính là doanh thu bán hàng"): `false` mặc định, chủ quán bật hoặc tắt bằng ô đánh
dấu trên form nhóm thu chi. Đi được cả hai chiều.

**2. Có những nút nào, mỗi nút làm gì, nút nào không nên hiện khi nào?**

| Nút | Làm gì | Khi nào không hiện |
|---|---|---|
| Chọn năm | chuyển sang `?year=YYYY` | chỉ hiện những năm có dữ liệu |
| Ô tháng trong bảng (máy tính) | mở phần "các khoản làm nên ô này" ngay dưới bảng | ô không có khoản nào và không phải dòng lợi nhuận: không bấm được |
| Đóng phần chi tiết | ẩn phần đó | khi chưa mở |
| Thẻ tháng (điện thoại) | mở các dòng của tháng | không bao giờ ẩn |
| Dòng trong thẻ (điện thoại) | mở các khoản làm nên dòng đó | dòng không có khoản nào |
| Ô "Tính là doanh thu bán hàng" (form nhóm) | bật cờ mới | nhóm Chi, hoặc bỏ "Tính vào lãi lỗ" |

Ô cột Tổng không bấm được. Chi tiết cả năm của Khấu hao là 84 dụng cụ nhân 7
tháng; bấm từng tháng là đủ.

**3. Danh sách chứa gì, loại cái gì ra, vì lý do gì?**

- **Cột tháng:** từ tháng đầu tiên của năm có bất kỳ con số nào khác 0, đến tháng
  hiện tại (năm nay) hoặc tháng 12 (năm cũ). Năm 2026 bắt đầu từ tháng 3, vì tháng 3
  có 49.226đ khấu hao.
- **Dòng:** theo bảng trong đặc tả. "· trong đó ghi tay", "Hao hụt", "Thu khác" chỉ
  hiện khi năm đó có số. Mỗi nhóm Chi tính vào lãi lỗ một dòng, nếu nhóm đang dùng
  hoặc năm đó có số; nhóm đã ngừng dùng mà năm đó không có số thì không hiện.
- **Chi tiết một ô:** dòng sổ (ngày, ghi chú, số tiền), dòng đơn nhập (ngày, tên
  món, mã đơn nhập, số tiền đã phân bổ), lần kiểm kho và phiếu xuất (ngày, tên, giá
  trị), dụng cụ (tên, khấu hao tháng đó), số đơn máy bán hàng, hoặc phép tính.
- **Cố ý loại ra:** vốn góp; dòng sổ đã huỷ; đơn nhập chưa hoàn tất; đơn nhập dụng
  cụ (đã đi vào khấu hao); phiếu xuất dụng cụ và phiếu xuất món không quản lý tồn
  (đã tính lúc mua, tính nữa là hai lần); dụng cụ `INACTIVE`.

**4. Mỗi ô nhập nhận giá trị nào, nhập ngoài khoảng thì sao?**

| Ô | Nhận | Ngoài khoảng |
|---|---|---|
| `?year=` trên đường dẫn | 4 chữ số, là một năm có dữ liệu | sai dạng, hoặc năm không có dữ liệu: hiện năm mới nhất có dữ liệu, không báo lỗi |
| Ô "Tính là doanh thu bán hàng" | bật hoặc tắt | bật trên nhóm Chi hoặc nhóm không tính vào lãi lỗ: máy chủ từ chối, câu "Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng." |

Trên màn hình, ô đánh dấu ẩn hẳn khi không hợp lệ và tự bỏ đánh dấu khi chủ quán
đổi sang Chi hoặc bỏ "Tính vào lãi lỗ". Máy chủ vẫn kiểm lại, không tin màn hình.
Cơ sở dữ liệu cũng có ràng buộc `check` chặn lần thứ ba.

**5. Phục vụ loại dữ liệu nào, cố ý không phục vụ loại nào?**

- **Phục vụ:** lãi lỗ quản trị theo tháng của cả quán, theo giờ Sài Gòn.
- **Cố ý không phục vụ:** báo cáo dòng tiền; mẫu nộp nhà nước (S1a-HKD, B01-DNSN,
  B02-DNSN); thuế; tách theo quán (`BR-PNL-001`); khoá sổ; xuất Excel; ngân sách.
  Tất cả nằm trong mục "Cố ý để ngoài" của đặc tả.

## Câu hỏi riêng của đợt này

**A. Trước khi migration `0102` lên máy chủ thật thì sao?** Cột `is_sales_revenue`
chưa có, `select *` trả về dòng không có trường đó. Code đọc `=== true` nên trang
Lãi lỗ vẫn chạy, hai dòng doanh thu ghi tay nằm ở Thu khác. Nhưng **lưu một nhóm thu
chi sẽ lỗi** vì code ghi vào cột chưa có. Vậy migration phải lên **trước** khi đẩy
code. Việc thêm cột có giá trị mặc định không làm hỏng code cũ đang chạy: code cũ
không đọc cột này, và dòng code cũ thêm vào tự nhận `false`, thoả ràng buộc.

**B. Tháng của mỗi khoản lấy từ đâu?** Mọi thứ theo giờ Sài Gòn:

| Khoản | Cột ngày | Cách lấy tháng |
|---|---|---|
| Đơn bán | `orders_v2.created_at` (timestamptz) | `saigonBucketKeys(...).monthKey` |
| Dòng sổ | `cash_entries.entry_date` (date, không giờ) | `entry_date.slice(0, 7)` |
| Đơn nhập | `transaction_date`, trống thì `created_at` (timestamptz) | `saigonBucketKeys(...).monthKey` |
| Giá vốn, hao hụt | `stock_issues.issued_at` | khoảng `toSaigonUtcRange(ngày 1, ngày cuối)` |
| Khấu hao | `acquired_date`, `disposed_date` (date) | `chargeForMonth(schedule, "YYYY-MM")` |

Đã có một lần đo sai vì cắt chuỗi UTC: đơn nhập `PO-067` và `PO-173` có
`transaction_date` 2026-05-31T17:00Z, tức 01/06 giờ Sài Gòn, bị xếp nhầm vào tháng 5.
Test ở Mục 3 canh đúng trường hợp này.

**C. Bộ máy giá vốn báo lỗi thì sao?** `computeIssueCosting` ném lỗi khi xuất trước
lần nhập đầu tiên hoặc xuất quá số đang có. Server action để lỗi đi thẳng ra trang
(trang lỗi của Next.js), **không** bắt lỗi rồi trả bảng toàn số 0. Một bảng lãi lỗ
sai mà trông như đúng tệ hơn một trang báo lỗi.

**D. Nạp bao nhiêu dữ liệu?** Đơn bán chỉ nạp năm đang xem (2026 đến nay khoảng
2.669 đơn), `findAllWhere` tự phân trang. Đơn nhập, dòng đơn nhập, phiếu xuất, sổ
thu chi, dụng cụ nạp toàn bộ, vì bộ máy giá vốn phải chạy lại từ đầu lịch sử để ra
giá bình quân đúng. Hôm nay mỗi bảng dưới vài nghìn dòng.

**E. Sửa một đơn nhập tháng cũ thì sao?** Tháng đó đổi theo lần mở sau. Chủ quán đã
bác khoá sổ (2026-09-08), và `BR-COGS-006` đã chọn không lưu giá vốn đã tính.

**F. Một dòng sổ trỏ tới nhóm không có?** Khoá ngoại `RESTRICT` không cho xảy ra.
Nếu vẫn xảy ra thì module ném lỗi nêu mã dòng, không lặng lẽ bỏ qua.

**G. Tháng đang chạy tính khấu hao thế nào?** Trọn tháng, giống Sheet của chủ quán
(đặc tả mục Khấu hao).

---

## Ràng buộc chung cho mọi mục

Mọi agent làm bất kỳ mục nào đều phải giữ những điều sau. Vi phạm một điều là dừng
và báo lại, không tự tìm đường vòng.

- **Không** `git push`. **Không** deploy. **Không** chạy migration lên máy chủ thật
  (`npx supabase db push` hay bất kỳ cách nào khác). **Không** chạy script ghi dữ
  liệu với `--apply`. **Không** gọi agent con.
- **Không bao giờ** dùng `--no-verify`. Hook đỏ thì sửa nguyên nhân.
- Hook đòi lưu một file nằm ngoài mục đang làm thì **dừng và báo lại**, không tự
  sửa file đó.
- Một lệnh bị chặn quyền thì **dừng và báo lại**. Không chạy lại bằng công cụ khác
  (PowerShell thay Bash, `sed` thay Edit…), không nhờ phiên khác chạy.
- Việc đầu tiên: **phản biện kế hoạch của mục mình** trước khi code. Chỗ nào sai,
  thiếu, mâu thuẫn với code thật thì nói ra. Soát mà không thấy gì thì nói rõ là đã
  soát và không thấy gì.
- Tên bảng, cột, hàm, chú thích: tiếng Anh. Mọi chữ chủ quán nhìn thấy: tiếng Việt.
- Import cùng thư mục viết `./TenFile`; khác thư mục viết `@/...`.
- Mỗi bước code: viết test đỏ trước, chạy cho thấy đỏ, nói rõ đỏ vì **thiếu hàm**
  hay vì **giá trị sai**; viết code tối thiểu; chạy cho thấy xanh.
- Đổi một luật kinh doanh thì sửa file luật và test của nó trong **cùng một lần
  lưu**.
- Sau mỗi mục chạy `npx tsc --noEmit` và `npx vitest run`. Sửa tài liệu thì chạy thêm
  `npx vite-node scripts/check-rules-current.ts` và
  `npx vite-node scripts/doc-checks/run-blocking.ts`, rồi
  `git checkout -- docs/generated/system-map.md` (file này hay đổi ký tự xuống
  dòng, không phải thay đổi thật).
- Báo kết quả kèm mẫu số: "0 lệch trên 7 tháng", không nói trống "0 lệch".
- Số tiền hiển thị: dấu chấm ngăn nghìn, không số lẻ (`formatNumber` ở
  `lib/shared/format.ts`, `BR-DATA-005`). Ô số trong bảng, thẻ, biểu đồ và danh
  sách chi tiết **không** kèm "đ": chủ quán chốt 2026-07-06 là số không kèm đơn vị,
  ngữ cảnh lấy từ nhãn (chú thích đầu `lib/shared/format.ts`). Cạnh bảng ghi một lần
  "Đơn vị: đồng". Câu chữ trọn câu (ghi chú dưới bảng) viết kèm "đ". Số âm có dấu
  trừ và màu `text-danger`.

---

## Các file sẽ đụng tới

**Tạo mới**

| File | Mục | Chịu trách nhiệm |
|---|---|---|
| `supabase/migrations/0102_cash_category_sales_revenue.sql` | 2 | cột cờ và ràng buộc |
| `tests/migrations/cash-category-sales-revenue-migration.test.ts` | 2 | kiểm chữ migration |
| `lib/reports/profit-and-loss.ts` + `.test.ts` | 3 | tính số chính xác từng tháng, kèm nguồn |
| `app/admin/reports/pnl/actions.ts` + `.test.ts` | 3 | nạp dữ liệu, chọn năm |
| `scripts/verify-pnl-monthly-core.ts` + `.test.ts` | 3 | so một tháng với `getPnLDataV2` |
| `scripts/verify-pnl-monthly.ts` | 3 | chạy phép so trên dữ liệu thật |
| `lib/reports/profit-and-loss-table.ts` + `.test.ts` | 4 | làm tròn, dựng dòng, ghi chú, tóm tắt, biểu đồ |
| `app/admin/reports/pnl/page.tsx` | 5 | trang |
| `app/admin/reports/pnl/__fixtures__/pnl-2026.ts` | 5 | số thật tháng 3, 8, 9/2026 cho test màn hình |
| `app/admin/reports/pnl/components/YearPicker.tsx` | 5 | chọn năm |
| `app/admin/reports/pnl/components/PnlSummary.tsx` + `.test.tsx` | 5 | bốn ô số |
| `app/admin/reports/pnl/components/PnlChart.tsx` | 5 | biểu đồ cột lời lỗ và đường cộng dồn |
| `app/admin/reports/pnl/components/PnlTableView.tsx` + `.test.tsx` | 5 | bảng máy tính, bấm ô xem chi tiết |
| `app/admin/reports/pnl/components/PnlSourceList.tsx` | 5 | danh sách các khoản làm nên một ô |
| `app/admin/reports/pnl/components/PnlFootnotes.tsx` | 5 | ghi chú dưới bảng |
| `app/admin/reports/pnl/components/PnlMonthCards.tsx` + `.test.tsx` | 6 | thẻ điện thoại |

**Sửa**

| File | Mục | Sửa gì |
|---|---|---|
| `lib/reports/display-rounding.ts` + `.test.ts` | 0 | làm tròn về đồng gần nhất, bỏ làm tròn lên/xuống |
| `lib/assets/asset-depreciation.ts` + `.test.ts` | 0 | khấu hao từng tháng tính chính xác, không làm tròn |
| `docs/02-rules/business-rules/data-integrity.md` | 0 | `BR-DATA-005` đổi sang "đã làm" phần hiển thị và khấu hao |
| `docs/02-rules/business-rules/cogs.md` | 0 | đoạn "Rounding across the split" của `BR-COGS-007` |
| `lib/costing/issue-costing-inputs.ts` + `.test.ts` | 1 | `isNonInventoryItem`, `selectCostedIssues` |
| `app/admin/reports/actions.ts` | 1 | dùng `selectCostedIssues` |
| `app/admin/reports/issued/actions.ts` | 1 | dùng `selectCostedIssues`, sửa tab theo lần xuất |
| `scripts/verify-cogs-core.ts` + `.test.ts` | 1 | Gate 2 bỏ món không quản lý tồn |
| `docs/02-rules/business-rules/cogs.md` | 1, 3 | `BR-COGS-007`, `BR-COGS-008` |
| `types/db.ts` | 2 | `DBCashCategory.is_sales_revenue` |
| `lib/finance/cash-entry-rules.ts` + `.test.ts` | 2 | `parseSalesRevenueFlag` |
| `app/admin/finance/categories/actions.ts` + `.test.ts` | 2 | đọc, kiểm, ghi cờ |
| `app/admin/finance/categories/components/CategoryForm.tsx` + `.test.tsx` | 2 | ô đánh dấu mới |
| `app/admin/finance/categories/components/CategoriesList.tsx` | 2 | hiện cờ |
| `docs/02-rules/business-rules/cash-book.md` | 2 | `BR-CASH-006` |
| `docs/03-workflows/cash-book.md` | 2 | `brCodes` thêm `BR-CASH-006`, một đoạn về cờ |
| `app/admin/reports/pnl/actions.ts` + `.test.ts` | 4 | trả thêm `table` |
| `docs/02-rules/business-rules/profit-and-loss.md` | 4, 5 | cách làm tròn; "đã dựng" |
| `app/admin/layout.tsx` | 5 | menu "Lãi lỗ" |
| `docs/03-workflows/reports.md` | 5 | route mới, một mục về trang |

---

## Mục 0 — Tính chính xác, chỉ làm tròn khi hiện ra (`BR-DATA-005`)

Chủ quán chốt 2026-09-11: *"Tất cả mọi thứ đều phải được tính chính xác. Đối với
hiển thị trên hệ thống thì làm tròn đến chữ số hàng đơn vị và không có số thập
phân."* Luật đã ghi ở `docs/02-rules/business-rules/data-integrity.md` (`BR-DATA-005`),
đang ghi "chưa làm". Mục này làm phần chạm tới trang Lãi lỗ: cách làm tròn khi hiện
ra, và khấu hao. Phần chia phí đơn nhập và các cột lưu sẵn kết quả **không** thuộc
mục này (cần migration trên bảng `assets`, làm sau trang Lãi lỗ).

**File:**
- Sửa: `lib/reports/display-rounding.ts`, `lib/reports/display-rounding.test.ts`
- Sửa: `lib/assets/asset-depreciation.ts` (dòng 235 và 248), `lib/assets/asset-depreciation.test.ts`
- Sửa: các test khác đang ghi cứng số làm tròn lên/xuống (bước 6 tìm ra)
- Sửa: `docs/02-rules/business-rules/cogs.md` (đoạn "Rounding across the split"),
  `docs/02-rules/business-rules/data-integrity.md` (dòng Status của `BR-DATA-005`)

**Giao diện:**
- Giữ nguyên tên và chữ ký `displayMoney(exactValue: number): number` và
  `displayStock(exactValue: number): number`. Chỉ đổi cách làm tròn.
- `buildAssetSchedule` giữ chữ ký; `charge` giờ có thể là số lẻ.
- Mục 3, 4 dùng `displayMoney` cho **mọi** dòng tiền của bảng lãi lỗ. Không có
  `displayProfit`.

- [ ] **Bước 1: Phản biện mục này**

Đọc `lib/reports/display-rounding.ts`, `lib/assets/asset-depreciation.ts` (cả file),
`BR-DATA-005`. Nói ra chỗ nào kế hoạch sai với code thật.

- [ ] **Bước 2: Test đỏ cho cách làm tròn mới**

Thay toàn bộ `lib/reports/display-rounding.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { displayStock, displayMoney } from "./display-rounding";

// BR-DATA-005 (owner, 2026-09-11): exact everywhere, rounded only on
// screen, to the nearest whole unit. Replaces the directional rule of
// 2026-07-30 (money up, stock down).
describe("display-rounding", () => {
  it("rounds money to the nearest đồng, halves away from zero", () => {
    expect(displayMoney(100.4)).toBe(100);
    expect(displayMoney(100.5)).toBe(101);
    expect(displayMoney(100.6)).toBe(101);
    expect(displayMoney(-32_372_968.5)).toBe(-32_372_969);
    expect(displayMoney(-32_372_968.4)).toBe(-32_372_968);
  });

  it("rounds a stock quantity the same way -- no longer always down", () => {
    expect(displayStock(123.123456213 + 123 + 10.5)).toBe(257); // 256.62... was 256 under the old rule
    expect(displayStock(256.4)).toBe(256);
  });

  it("leaves an exact whole number alone", () => {
    expect(displayStock(256)).toBe(256);
    expect(displayMoney(300)).toBe(300);
  });

  it("never shows minus zero", () => {
    expect(Object.is(displayMoney(-0.3), 0)).toBe(true);
    expect(Object.is(displayStock(-0.0000001), 0)).toBe(true);
  });

  it("rounds a half the way a calculator does even when binary floating point lands a hair below it", () => {
    // 1.005 * 1000 / 10 is 100,5 on paper but 100.49999999999999 in JavaScript
    expect(displayMoney(1.005 * 1000 / 10)).toBe(101);
    expect(displayMoney(0.145 * 100)).toBe(15); // 14.499999999999998
  });

  it("200.000đ over 6 months: each month shows 33.333, the exact total shows 200.000", () => {
    const month = 200_000 / 6;
    expect(displayMoney(month)).toBe(33_333);
    expect(displayMoney(month * 6)).toBe(200_000);
  });

  it("rounds each figure from its own exact value, not from rounded parts", () => {
    const parts = [100.4, 100.4, 100.4];
    expect(parts.map(displayMoney)).toEqual([100, 100, 100]);
    expect(displayMoney(parts.reduce((a, b) => a + b, 0))).toBe(301);
    // 100 + 100 + 100 = 300 != 301 -- accepted by the owner; the screen notes it
  });
});
```

Chạy: `npx vitest run lib/reports/display-rounding.test.ts`
Mong đợi: đỏ vì **giá trị sai** (hàm cũ làm tròn lên/xuống).

- [ ] **Bước 3: Viết cách làm tròn mới**

Thay toàn bộ `lib/reports/display-rounding.ts`:

```ts
/**
 * BR-DATA-005, owner rule 2026-09-11 (docs/02-rules/business-rules/
 * data-integrity.md). Replaces the directional rule of 2026-07-30 (stock
 * down, money up, "never flatter the business"), withdrawn by the owner.
 *
 * Every figure is computed exactly. Rounding happens only where a number
 * is shown: to the nearest whole unit, halves away from zero -- the same
 * direction Intl.NumberFormat uses in lib/shared/format.ts.
 *
 * Round from the exact value, then show -- never sum rounded parts. Shown
 * parts can therefore differ from a shown total by a unit or two (three
 * months of 100,4 show 100 each, their total shows 301). Accepted, not a
 * bug: any screen that shows parts beside their total says so where it
 * happens.
 */
function roundToWhole(exactValue: number): number {
  // Snap to 6 decimals first: a value that is a half on paper can land a
  // hair below it in binary floating point (1.005 * 1000 / 10 is
  // 100.49999999999999) and must still round the way a calculator would.
  const snapped = Math.round(Math.abs(exactValue) * 1e6) / 1e6;
  const rounded = Math.sign(exactValue) * Math.round(snapped);
  return rounded === 0 ? 0 : rounded; // never "-0" on screen
}

export function displayStock(exactValue: number): number {
  return roundToWhole(exactValue);
}

export function displayMoney(exactValue: number): number {
  return roundToWhole(exactValue);
}
```

Chạy lại, thấy xanh.

- [ ] **Bước 4: Test đỏ cho khấu hao chính xác**

Trong `lib/assets/asset-depreciation.test.ts`, thêm vào `describe` của
`buildAssetSchedule`:

```ts
  // BR-DATA-005 (owner, 2026-09-11): "200.000 / 6 sẽ ra kết quả không bao giờ chia hết"
  it("200.000đ over 6 months charges 33.333,33...đ every month, not 33.333 five times and 33.335 once", () => {
    const schedule = buildAssetSchedule(
      { acquired_date: "2026-03-15", total_cost: 200_000, quantity: 1, term_months: 6 },
      [],
    );
    for (const m of schedule) expect(m.charge).toBeCloseTo(200_000 / 6, 6);
    expect(schedule[0].charge).not.toBe(33_333);
    expect(totalScheduledCharge(schedule)).toBeCloseTo(200_000, 6);
  });
```

Hai test cũ ghi cứng cách làm tròn từng tháng phải đổi theo luật mới, **cùng lần
lưu** với code:
- Test ở dòng 27 ("8 units, 761.200d … final month absorbs the rounding remainder"):
  đổi tên thành "8 units, 761.200d over 12 months charges 63.433,33…d every month and
  sums to 761.200d"; `toBe(63_433)` (11 tháng đầu) và `toBe(63_437)` (tháng 12) đổi
  thành `toBeCloseTo(761_200 / 12, 6)`.
- Test ở dòng 76 ("2.100.000d over 36 months … final month absorbs the remainder"):
  tương tự, `toBe(58_333)` và `toBe(58_345)` đổi thành `toBeCloseTo(2_100_000 / 36, 6)`.

Chạy: `npx vitest run lib/assets/asset-depreciation.test.ts`
Mong đợi: test mới và hai test vừa sửa đỏ vì **giá trị sai**; các test khác xanh.

- [ ] **Bước 5: Khấu hao không làm tròn**

Trong `lib/assets/asset-depreciation.ts`:
- dòng 235: `: Math.round((total_cost * cohort.qty) / quantity);` thành
  `: (total_cost * cohort.qty) / quantity;`
- dòng 248: `: Math.round(cohortTotalCost / term_months);` thành
  `: cohortTotalCost / term_months;`

Giữ nguyên cách "phần cuối = tổng trừ phần đã tính" ở cả hai chỗ: nó giữ tổng lịch
đúng bằng giá mua. Sửa chú thích quanh hai dòng này nếu còn nói "whole đồng" hay
"rounding remainder", dẫn `BR-DATA-005`.

Chạy lại file test. Test nào kiểm tổng lịch bằng `toBe(...)` mà giờ lệch ở chữ số
thập phân thứ mười mấy (do dấu phẩy động, lịch nhiều nhóm thanh lý) thì đổi sang
`toBeCloseTo(..., 6)` và **ghi rõ test nào** trong báo cáo. Không được đổi con số
mong đợi.

- [ ] **Bước 6: Tìm mọi test khác đang ghi cứng luật cũ**

Chạy `npx vitest run`. Mỗi test đỏ:
- Nếu con số mong đợi là kết quả làm tròn lên (`Math.ceil`) hoặc xuống (`Math.floor`)
  hay khấu hao làm tròn từng tháng, sửa thành số theo luật mới và ghi vào báo cáo:
  tên test, số cũ → số mới, vì sao.
- Nếu đỏ vì lý do khác: **dừng và báo lại**, không sửa.

- [ ] **Bước 7: Kiểm chỗ hiện số khấu hao**

Tìm mọi nơi đọc `buildAssetSchedule`, `summarizeAsset`, `remainingValueAsOf`,
`chargeForMonth` ngoài test. Với mỗi số tiền đi ra màn hình, xác nhận nó qua
`formatNumber` (không truyền `withDecimals`) hoặc `displayMoney`. Liệt kê từng chỗ
trong báo cáo. Chỗ nào hiện số thô (ví dụ nối chuỗi thẳng) thì bọc `formatNumber`.

- [ ] **Bước 8: Tài liệu**

`docs/02-rules/business-rules/cogs.md`, thay nguyên đoạn bắt đầu bằng
`**Rounding across the split.**` bằng:

```markdown
**Rounding across the split.** Each line is shown rounded to the nearest đồng from its own exact value (`BR-DATA-005`, 2026-09-11, which replaced the round-up rule of 2026-07-30), and gross profit is computed from the exact total, never by summing already-rounded lines. The two paths can differ by a đồng — `round(a) + round(b)` is not always `round(a + b)` — and the report must not be built as if they could not.
```

`docs/02-rules/business-rules/data-integrity.md`, trong `BR-DATA-005`, thay câu
bắt đầu bằng `**Not yet implemented:**` bằng:

```markdown
**Implemented 2026-09-11 for display and depreciation** (`lib/reports/display-rounding.ts`, `lib/assets/asset-depreciation.ts`). The items under "Where the code does not follow this yet" below are still open.
```

- [ ] **Bước 9: Kiểm toàn bộ và lưu**

```bash
npx tsc --noEmit
npx vitest run
npx vite-node scripts/verify-cogs.ts
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
git checkout -- docs/generated/system-map.md
git add lib/reports/display-rounding.ts lib/reports/display-rounding.test.ts \
  lib/assets/asset-depreciation.ts lib/assets/asset-depreciation.test.ts \
  docs/02-rules/business-rules/cogs.md docs/02-rules/business-rules/data-integrity.md
# cộng các test khác đã sửa ở bước 6, và file hiện số ở bước 7 nếu có
git commit -m "fix(reports): compute exactly, round only on screen to the nearest dong (BR-DATA-005)"
```

`verify-cogs` phải ra 0 lệch như trước (báo kèm mẫu số nó in ra). Nếu cửa nào đỏ thì
**dừng và báo lại**.

**Opus soát sau mục này:** đo lại khấu hao từng tháng năm 2026 bằng code mới, so
với bảng "Ví dụ bằng số thật" (khấu hao có thể đổi một, hai đồng mỗi tháng), rồi
sửa bảng đó trước khi giao Mục 3.

---

## Mục 1 — Món mua dùng ngay không bao giờ vào giá vốn

**File:**
- Sửa: `lib/costing/issue-costing-inputs.ts`, test `lib/costing/issue-costing-inputs.test.ts`
- Sửa: `app/admin/reports/actions.ts`, test `app/admin/reports/actions.test.ts`
- Sửa: `app/admin/reports/issued/actions.ts`, test `app/admin/reports/issued/actions.test.ts`
- Sửa: `scripts/verify-cogs-core.ts`, test `scripts/verify-cogs-core.test.ts`
- Sửa: `docs/02-rules/business-rules/cogs.md` (`BR-COGS-007`)
- Sửa chú thích: `scripts/verify-cogs.ts`, `app/admin/reports/issued/page.tsx` (bước 11b)

**Giao diện:**
- Cần từ mục trước: không.
- Đưa ra cho mục sau:
  - `isNonInventoryItem(item: { is_non_inventory?: unknown }): boolean`
  - `selectCostedIssues(stockIssues: any[], purchasedItems: any[], itemCategories: any[]): any[]`
    — bỏ dòng xuất dụng cụ **và** dòng xuất món không quản lý tồn. Mọi chỗ đọc giá
    vốn đi qua hàm này.

**Vì sao:** tiền của món mua dùng ngay đã tính lúc mua, trên dòng Nguyên liệu mua
dùng ngay. Phiếu xuất của nó mà vẫn vào giá vốn thì tiền bị tính hai lần. Hôm nay
mức ảnh hưởng là 0đ (hai dòng Khăn lau +1 và −1), việc này là chặn trước.

- [ ] **Bước 1: Viết test đỏ cho hai hàm mới**

Thêm vào `lib/costing/issue-costing-inputs.test.ts` (sửa dòng import cho có hai hàm mới):

```ts
describe("isNonInventoryItem", () => {
  it("reads the item's own flag, as a boolean or the legacy 'TRUE' string", () => {
    expect(isNonInventoryItem({ is_non_inventory: true })).toBe(true);
    expect(isNonInventoryItem({ is_non_inventory: "TRUE" })).toBe(true);
    expect(isNonInventoryItem({ is_non_inventory: false })).toBe(false);
    expect(isNonInventoryItem({ is_non_inventory: null })).toBe(false);
    expect(isNonInventoryItem({})).toBe(false);
  });
});

// Real shape, 2026-09-11: Khăn lau đa năng (SPM-057) carries is_non_inventory
// and was issued +1 then -1 on 02/09/2026 (ISS-00120, ISS-00121).
describe("selectCostedIssues", () => {
  const categories = [
    { id: "NHH-001", system_type: "RAW" },
    { id: "NHH-002", system_type: "CONSUMABLE" },
    { id: "NHH-003", system_type: "EQUIPMENT" },
  ];
  const items = [
    { id: "SPM-001", item_category_id: "NHH-001", is_non_inventory: false },
    { id: "SPM-057", item_category_id: "NHH-002", is_non_inventory: true },
    { id: "SPM-090", item_category_id: "NHH-003", is_non_inventory: false },
  ];

  it("drops issues of items bought for immediate use and of equipment, keeps stocked goods", () => {
    const issues = [
      { id: "ISS-00001", purchased_item_id: "SPM-001" },
      { id: "ISS-00120", purchased_item_id: "SPM-057" },
      { id: "ISS-00121", purchased_item_id: "SPM-057" },
      { id: "ISS-00200", purchased_item_id: "SPM-090" },
    ];
    expect(selectCostedIssues(issues, items, categories).map(r => r.id)).toEqual(["ISS-00001"]);
  });

  it("keeps an issue whose item is missing from the list -- unknown is not assumed bought-for-use", () => {
    const issues = [{ id: "ISS-00300", purchased_item_id: "SPM-999" }];
    expect(selectCostedIssues(issues, items, categories).map(r => r.id)).toEqual(["ISS-00300"]);
  });
});
```

- [ ] **Bước 2: Chạy, thấy đỏ**

Chạy: `npx vitest run lib/costing/issue-costing-inputs.test.ts`
Mong đợi: đỏ vì **thiếu hàm** (`isNonInventoryItem`, `selectCostedIssues` chưa có).

- [ ] **Bước 3: Viết hai hàm**

Thêm vào cuối `lib/costing/issue-costing-inputs.ts`:

```ts
// BR-COGS-007, 2026-09-11 (docs/superpowers/plans/2026-09-11-bao-cao-lai-lo.md
// Mục 1). The item's own flag is the one test since 2026-09-01 -- the
// stocktake and issue-slip screens read nothing else. The legacy "TRUE"
// string is still accepted, same as both of those screens.
export function isNonInventoryItem(item: { is_non_inventory?: unknown }): boolean {
  return item.is_non_inventory === true || item.is_non_inventory === "TRUE";
}

// Every reader of cost of goods goes through this one function, so they can
// only ever agree. Two kinds of row never become cost of goods:
//   - equipment: it depreciates through the asset register (section 3.2);
//   - an item bought for immediate use: its money is counted once, when
//     bought, on the "Nguyên liệu mua dùng ngay" line -- an issue slip for
//     it would count it a second time.
// An issue whose item is not in purchasedItems is kept: unknown is not
// assumed to be either kind.
export function selectCostedIssues(
  stockIssues: any[],
  purchasedItems: any[],
  itemCategories: any[],
): any[] {
  const nonInventoryItemIds = new Set(
    purchasedItems.filter(isNonInventoryItem).map(p => p.id),
  );
  return filterOutEquipmentIssues(stockIssues, purchasedItems, itemCategories)
    .filter(row => !nonInventoryItemIds.has(row.purchased_item_id));
}
```

- [ ] **Bước 4: Chạy, thấy xanh**

Chạy: `npx vitest run lib/costing/issue-costing-inputs.test.ts`
Mong đợi: xanh.

- [ ] **Bước 5: Test đỏ cho hai chỗ đọc giá vốn**

Thêm vào `app/admin/reports/actions.test.ts`, trong `describe("getPnLDataV2")` (dùng
lại cách giả dữ liệu của file; nếu file chỉ có `mockResolvedValue` chung thì dùng
`mockImplementation` theo tên bảng như dưới):

```ts
it("leaves an issue of an item bought for immediate use out of totalCOGS (BR-COGS-007)", async () => {
  (findAllNoCache as any).mockImplementation(async (sheet: string) => {
    if (sheet === "Purchase_Orders") return [{
      id: "PO-900", status: "COMPLETED", transaction_date: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z",
      shipping_fee: 0, tax_amount: 0, voucher_amount: 0, discount_amount: 0,
    }];
    if (sheet === "Purchase_Order_Lines") return [
      { id: "POL-900", purchase_order_id: "PO-900", purchased_item_id: "SPM-057", base_quantity: 10, subtotal: 10_000 },
    ];
    if (sheet === "Stock_Issues") return [
      { id: "ISS-00120", purchased_item_id: "SPM-057", issued_at: "2026-09-01T19:24:00Z", base_quantity: 1, source: "MANUAL", issue_slip_id: "ISL-00042" },
    ];
    return [];
  });
  (findAll as any).mockImplementation(async (sheet: string) => {
    if (sheet === "Purchased_Items") return [{ id: "SPM-057", item_category_id: "NHH-002", is_non_inventory: true }];
    if (sheet === "Item_Categories") return [{ id: "NHH-002", system_type: "CONSUMABLE" }];
    return [];
  });

  const result = await getPnLDataV2({ startDate: "2026-09-01", endDate: "2026-09-30" });

  expect(result.totalCOGS).toBe(0);
  expect(result.manualIssueSlipCount).toBe(0);
});
```

Thêm vào `app/admin/reports/issued/actions.test.ts` một `describe` mới, tách khỏi
phần dùng ảnh chụp dữ liệu thật:

```ts
describe("getIssuedValueReport leaves out equipment and items bought for immediate use", () => {
  it("in the grand total, the item list and the by-event list alike", async () => {
    (findAllNoCache as any).mockImplementation(async (sheet: string) => {
      if (sheet === "Purchase_Orders") return [{
        id: "PO-900", status: "COMPLETED", transaction_date: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z",
        shipping_fee: 0, tax_amount: 0, voucher_amount: 0, discount_amount: 0,
      }];
      if (sheet === "Purchase_Order_Lines") return [
        { id: "POL-900", purchase_order_id: "PO-900", purchased_item_id: "SPM-057", base_quantity: 10, subtotal: 10_000 },
        { id: "POL-901", purchase_order_id: "PO-900", purchased_item_id: "SPM-090", base_quantity: 1, subtotal: 500_000 },
      ];
      if (sheet === "Stock_Issues") return [
        { id: "ISS-00120", purchased_item_id: "SPM-057", issued_at: "2026-09-01T19:24:00Z", base_quantity: 1, source: "MANUAL", issue_slip_id: "ISL-00042" },
        { id: "ISS-00400", purchased_item_id: "SPM-090", issued_at: "2026-09-02T03:00:00Z", base_quantity: 1, source: "MANUAL", issue_slip_id: "ISL-00050" },
      ];
      throw new Error(`unexpected findAllNoCache sheet: ${sheet}`);
    });
    (findAll as any).mockImplementation(async (sheet: string) => {
      if (sheet === "Purchased_Items") return [
        { id: "SPM-057", name: "Khăn lau đa năng", item_category_id: "NHH-002", is_non_inventory: true },
        { id: "SPM-090", name: "Máy xay", item_category_id: "NHH-003", is_non_inventory: false },
      ];
      if (sheet === "Item_Categories") return [
        { id: "NHH-002", system_type: "CONSUMABLE" },
        { id: "NHH-003", system_type: "EQUIPMENT" },
      ];
      return [];
    });

    const report = await getIssuedValueReport();

    expect(report.grandTotal).toBe(0);
    expect(report.items).toEqual([]);
    expect(report.events).toEqual([]);
  });
});
```

- [ ] **Bước 6: Chạy, thấy đỏ**

Chạy: `npx vitest run app/admin/reports/actions.test.ts app/admin/reports/issued/actions.test.ts`
Mong đợi: đỏ vì **giá trị sai**. `totalCOGS` ra 1.000 thay vì 0; `report.events` còn hai
lần xuất (lần của Máy xay lọt qua vì tab này dùng `stockIssues` chưa lọc).

- [ ] **Bước 7: Nối hai chỗ đọc vào `selectCostedIssues`**

Trong `app/admin/reports/actions.ts`:
- import `selectCostedIssues` thay cho `filterOutEquipmentIssues`;
- đổi dòng tạo `nonEquipmentIssues` thành
  `const costedIssues = selectCostedIssues(stockIssues as any[], purchasedItems as any[], itemCategories as any[]);`
- đổi mọi chỗ dùng `nonEquipmentIssues` trong hàm (ba chỗ: `buildIssueCostingIssues`,
  `buildClassifiedIssues`, `manualIssuesInPeriod`) sang `costedIssues`;
- sửa chú thích "section 3.2" ở đó cho nói cả hai loại dòng bị bỏ.

Trong `app/admin/reports/issued/actions.ts`:
- import `selectCostedIssues` thay cho `filterOutEquipmentIssues`;
- `const costedIssues = selectCostedIssues(...)`, dùng cho `buildIssueCostingIssues`;
- sửa `computeIssuedEventFigures(stockIssues as any[], purchases)` thành
  `computeIssuedEventFigures(costedIssues, purchases)`, kèm một dòng chú thích: tab này
  trước đây nhận dòng chưa lọc.

- [ ] **Bước 8: Chạy, thấy xanh**

Chạy: `npx vitest run app/admin/reports lib/costing`
Mong đợi: xanh, kể cả các test dùng ảnh chụp 2026-08-13 (ảnh đó không có món nào mang
cờ, đã kiểm: 0 trên 52 món, 0 trên 59 dòng xuất).

- [ ] **Bước 9: Gate 2 của `verify-cogs` bỏ cùng loại dòng, viết độc lập**

`scripts/verify-cogs-core.ts` cố ý **không** import từ `lib/` (chú thích đầu file giải
thích vì sao). Viết lại phép thử ngay trong file.

Test đỏ trước, thêm vào `scripts/verify-cogs-core.test.ts`:

```ts
it("excludes an issue of an item bought for immediate use (BR-COGS-007, 2026-09-11)", () => {
  const issues = [
    { purchased_item_id: "SPM-057", issued_at: "2026-09-01T19:24:00Z", base_quantity: 1, source: "MANUAL" as const },
    { purchased_item_id: "NNL-001", issued_at: "2026-09-01T19:24:00Z", base_quantity: 2, source: "MANUAL" as const },
  ];
  const purchasedItems = [
    { id: "SPM-057", item_category_id: "CAT-CON", is_non_inventory: true },
    { id: "NNL-001", item_category_id: "CAT-RAW", is_non_inventory: false },
  ];
  const itemCategories = [{ id: "CAT-CON", system_type: "CONSUMABLE" }, { id: "CAT-RAW", system_type: "RAW" }];

  const result = buildChallengerIssues(issues, purchasedItems, itemCategories);

  expect(result).toEqual([{ purchased_item_id: "NNL-001", at: "2026-09-01T19:24:00Z", base_quantity: 2, source: "MANUAL" }]);
});
```

Chạy `npx vitest run scripts/verify-cogs-core.test.ts`, thấy đỏ vì **giá trị sai** (dòng
`SPM-057` còn trong kết quả). Rồi sửa `buildChallengerIssues`:

```ts
export function buildChallengerIssues(
  stockIssues: readonly { purchased_item_id: string; issued_at: string; base_quantity: number; source: "MANUAL" | "STOCKTAKE" }[],
  purchasedItems: readonly { id: string; item_category_id: string; is_non_inventory?: unknown }[],
  itemCategories: readonly { id: string; system_type: string }[],
): ChallengerIssue[] {
  const equipmentCategoryIds = new Set(itemCategories.filter(c => c.system_type === "EQUIPMENT").map(c => c.id));
  const excludedItemIds = new Set(
    purchasedItems
      .filter(p =>
        equipmentCategoryIds.has(p.item_category_id) ||
        // BR-COGS-007, 2026-09-11: bought for immediate use, counted when
        // bought. Written out again here on purpose -- see the header.
        p.is_non_inventory === true || p.is_non_inventory === "TRUE")
      .map(p => p.id),
  );
  return stockIssues
    .filter(row => !excludedItemIds.has(row.purchased_item_id))
    .map(row => ({
      purchased_item_id: row.purchased_item_id,
      at: row.issued_at,
      base_quantity: row.base_quantity,
      source: row.source,
    }));
}
```

Chạy lại, thấy xanh. `scripts/verify-cogs.ts` truyền nguyên dòng `purchased_items`
nên đã có `is_non_inventory`, không phải sửa.

- [ ] **Bước 10: Chạy `verify-cogs` trên dữ liệu thật**

Chạy: `npx vite-node scripts/verify-cogs.ts` (chỉ đọc).
Mong đợi: cả hai gate xanh. Chép nguyên phần in ra vào báo cáo của mục.

- [ ] **Bước 11: Ghi luật**

Trong `docs/02-rules/business-rules/cogs.md`, đoạn "**Widened 2026-08-21:**" của
`BR-COGS-007`, thay hai câu cuối (bắt đầu từ "Excluded from stocktake when either the
linked ingredient is flagged…" đến hết "…today it only controls stocktake eligibility.")
bằng:

```md
Since 2026-09-01 the item's own flag is the only test: the stocktake and issue-slip screens both read `purchased_items.is_non_inventory` and nothing else (`app/admin/inventory/stocktake/actions.ts`, `app/admin/inventory/issue-slips/actions.ts`). Not yet reached by the expense line itself — the P&L page (`docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md`) is what makes this column feed money.
```

Rồi thêm ngay sau đoạn đó một đoạn mới:

```md
**An item bought for immediate use never enters Giá vốn, 2026-09-11.** Its money is counted once, when bought, on the Nguyên liệu mua dùng ngay line; an issue slip naming it would count it a second time. `selectCostedIssues` (`lib/costing/issue-costing-inputs.ts`) drops such rows together with equipment rows, and every reader of cost of goods goes through it: `getPnLDataV2`, the issued-value page, and the P&L page once built. `scripts/verify-cogs-core.ts` drops them independently. Part of the P&L design the owner approved on 2026-09-11. Measured that day: 2 of 146 `stock_issues` rows, both Khăn lau đa năng (`ISS-00120` +1, `ISS-00121` −1, 02/09/2026), net 0đ, so no month's figure moved.
```

- [ ] **Bước 11b: Ba chú thích còn nói luật làm tròn cũ**

Mục 0 (commit `9c7b0a7`) đổi cách làm tròn nhưng để lại ba chú thích nói luật cũ
"làm tròn lên". Chỉ sửa chữ chú thích, không đổi code, không đổi chữ trên màn hình:
- `scripts/verify-cogs.ts:45`: "the owner's fixed display-rounding rule (round cost
  UP, never flatter)" → "the owner's display-rounding rule (BR-DATA-005: nearest đồng)".
- `app/admin/reports/actions.ts:306`: "owner rule 2026-07-30 (lib/display-rounding.ts):
  cost is rounded UP, from each figure's own exact value" → "BR-DATA-005
  (lib/reports/display-rounding.ts): rounded to the nearest đồng, from each figure's
  own exact value".
- `app/admin/reports/issued/page.tsx:160`: "Owner rule 2026-07-30" → "BR-DATA-005".

- [ ] **Bước 12: Kiểm toàn bộ và lưu**

```bash
npx tsc --noEmit
npx vitest run
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
git checkout -- docs/generated/system-map.md
git add lib/costing/issue-costing-inputs.ts lib/costing/issue-costing-inputs.test.ts \
  app/admin/reports/actions.ts app/admin/reports/actions.test.ts \
  app/admin/reports/issued/actions.ts app/admin/reports/issued/actions.test.ts \
  app/admin/reports/issued/page.tsx scripts/verify-cogs.ts \
  scripts/verify-cogs-core.ts scripts/verify-cogs-core.test.ts \
  docs/02-rules/business-rules/cogs.md
git commit -m "fix(cogs): items bought for immediate use never enter cost of goods (BR-COGS-007)"
```

**Opus soát sau mục này:** đo lại `getPnLDataV2` từng tháng 03→09/2026 trước và sau.
Mong đợi: không tháng nào đổi đồng nào.

---

## Mục 2 — Cờ "Tính là doanh thu bán hàng" trên nhóm thu chi

**File:**
- Tạo: `supabase/migrations/0102_cash_category_sales_revenue.sql`
- Tạo: `tests/migrations/cash-category-sales-revenue-migration.test.ts`
- Sửa: `types/db.ts` (`DBCashCategory`)
- Sửa: `lib/finance/cash-entry-rules.ts`, test `lib/finance/cash-entry-rules.test.ts`
- Sửa: `app/admin/finance/categories/actions.ts`, test `actions.test.ts`
- Sửa: `app/admin/finance/categories/components/CategoryForm.tsx`, test `CategoryForm.test.tsx`
- Sửa: `app/admin/finance/categories/components/CategoriesList.tsx`, test mới `CategoriesList.test.ts`
- Sửa: `docs/02-rules/business-rules/cash-book.md` (`BR-CASH-006` mới)
- Sửa: `docs/03-workflows/cash-book.md`

**Giao diện:**
- Cần từ mục trước: không.
- Đưa ra cho mục sau: cột `cash_categories.is_sales_revenue` (boolean, mặc định
  `false`); `DBCashCategory.is_sales_revenue: boolean`. Code đọc cờ luôn viết
  `c.is_sales_revenue === true`, vì trước khi migration lên máy chủ thật trường này
  không có trong dòng trả về.

**Không chạy migration lên máy chủ thật.** Chỉ viết file và test chữ của nó.

- [ ] **Bước 1: Test đỏ cho migration**

Tạo `tests/migrations/cash-category-sales-revenue-migration.test.ts`:

```ts
// tests/migrations/cash-category-sales-revenue-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0102_cash_category_sales_revenue.sql"),
  "utf8",
).toLowerCase();

describe("cash category sales-revenue migration (BR-CASH-006)", () => {
  it("adds the flag as a non-null boolean defaulting to false", () => {
    expect(migration).toContain(
      "add column if not exists is_sales_revenue boolean not null default false",
    );
  });

  it("lets only an income category that counts in profit and loss carry the flag", () => {
    expect(migration).toContain(
      "check (not is_sales_revenue or (kind = 'income' and affects_pnl))",
    );
  });

  it("can run twice: drops the constraint before adding it", () => {
    const drop = migration.indexOf("drop constraint if exists cash_categories_sales_revenue_is_pnl_income");
    const add = migration.indexOf("add constraint cash_categories_sales_revenue_is_pnl_income");
    expect(drop).toBeGreaterThan(-1);
    expect(add).toBeGreaterThan(drop);
  });

  it("sets no row's flag -- the owner ticks it himself after release", () => {
    expect(migration).not.toMatch(/\bupdate\s+public\.cash_categories\b/);
    expect(migration).not.toMatch(/\binsert\s+into\b/);
  });
});
```

Chạy `npx vitest run tests/migrations/cash-category-sales-revenue-migration.test.ts`,
thấy đỏ vì **thiếu file**.

- [ ] **Bước 2: Viết migration**

Tạo `supabase/migrations/0102_cash_category_sales_revenue.sql`:

```sql
-- docs/superpowers/plans/2026-09-11-bao-cao-lai-lo.md Mục 2, BR-CASH-006
-- (docs/02-rules/business-rules/cash-book.md). Owner decision 2026-09-11:
-- hand-recorded sales revenue counts as revenue on the P&L, on its own
-- line (BR-PNL-003). Which categories hold it is a fact about the category,
-- carried as data, the same way affects_pnl is.
--
-- Additive only. Every existing row gets false and no row is set true
-- here: the owner ticks "Doanh thu ghi tay" (CFC-006) himself after
-- release, so this file writes no business data.
--
-- Must reach production BEFORE the code that writes this column: the
-- category save path sends is_sales_revenue on every add and update. Code
-- already running before this migration never reads or writes the column,
-- and its inserts take the default, which satisfies the check below.

alter table public.cash_categories
  add column if not exists is_sales_revenue boolean not null default false;

alter table public.cash_categories
  drop constraint if exists cash_categories_sales_revenue_is_pnl_income;

alter table public.cash_categories
  add constraint cash_categories_sales_revenue_is_pnl_income
  check (not is_sales_revenue or (kind = 'INCOME' and affects_pnl));
```

Chạy lại test, thấy xanh. Thêm `is_sales_revenue: boolean;` vào `DBCashCategory` trong
`types/db.ts`, ngay dưới `affects_pnl`, kèm chú thích một dòng trỏ về `BR-CASH-006`.

- [ ] **Bước 3: Luật thuần, test đỏ**

Thêm vào `lib/finance/cash-entry-rules.test.ts`:

```ts
describe("parseSalesRevenueFlag (BR-CASH-006)", () => {
  it("accepts the flag on an income category that counts in profit and loss", () => {
    expect(parseSalesRevenueFlag("INCOME", true, true)).toEqual({ ok: true, value: true });
  });

  it("refuses it on an expense category", () => {
    expect(parseSalesRevenueFlag("EXPENSE", true, true)).toEqual({ ok: false, error: SALES_REVENUE_FLAG_ERROR });
  });

  it("refuses it on an income category kept out of profit and loss (capital)", () => {
    expect(parseSalesRevenueFlag("INCOME", false, true)).toEqual({ ok: false, error: SALES_REVENUE_FLAG_ERROR });
  });

  it("an unticked box is always fine and saves false", () => {
    expect(parseSalesRevenueFlag("EXPENSE", false, false)).toEqual({ ok: true, value: false });
  });

  it("says why in Vietnamese", () => {
    expect(SALES_REVENUE_FLAG_ERROR).toBe(
      "Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng.",
    );
  });
});
```

Chạy, thấy đỏ vì **thiếu hàm**. Rồi thêm vào `lib/finance/cash-entry-rules.ts`:

```ts
export const SALES_REVENUE_FLAG_ERROR =
  "Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng.";

// BR-CASH-006: only an income category that counts in profit and loss can
// be sales revenue. The form hides the box otherwise; this is the server's
// own check, and migration 0102's check constraint is the third.
export function parseSalesRevenueFlag(
  kind: DBCashCategory["kind"],
  affectsPnl: boolean,
  requested: boolean,
): ParseResult<boolean> {
  if (!requested) return { ok: true, value: false };
  if (kind !== "INCOME" || !affectsPnl) return { ok: false, error: SALES_REVENUE_FLAG_ERROR };
  return { ok: true, value: true };
}
```

Chạy lại, thấy xanh.

- [ ] **Bước 4: Server action, test đỏ**

Thêm vào `app/admin/finance/categories/actions.test.ts` (dùng lại `mocks`, `ADMIN`,
`formData` sẵn có của file):

```ts
describe("sales-revenue flag (BR-CASH-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves the flag on a new income category that counts in profit and loss", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([]);
    mocks.generateNewId.mockResolvedValue("CFC-007");

    const result = await addCashCategory(formData({
      name: "Doanh thu ghi tay 2", kind: "INCOME", affects_pnl: "on", is_sales_revenue: "on",
    }));

    expect(result.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Cash_Categories",
      expect.objectContaining({ id: "CFC-007", is_sales_revenue: true }),
    );
  });

  it("refuses the flag on an expense category, before touching the database", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);

    const result = await addCashCategory(formData({
      name: "Vận hành 2", kind: "EXPENSE", affects_pnl: "on", is_sales_revenue: "on",
    }));

    expect(result.error).toBe("Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng.");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses the flag when an edit takes the category out of profit and loss", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);

    const result = await updateCashCategory(formData({
      id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", is_sales_revenue: "on",
    }));

    expect(result.error).toBe("Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng.");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("an edit with the box unticked writes false", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([
      { id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", affects_pnl: true, is_sales_revenue: true, status: "ACTIVE" },
    ]);

    const result = await updateCashCategory(formData({
      id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", affects_pnl: "on",
    }));

    expect(result.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      "Cash_Categories",
      "CFC-006",
      expect.objectContaining({ is_sales_revenue: false }),
    );
  });
});
```

Chạy, thấy đỏ vì **giá trị sai** (chưa ghi `is_sales_revenue`, chưa từ chối). Rồi sửa
`app/admin/finance/categories/actions.ts`, trong **cả hai** hàm `addCashCategory` và
`updateCashCategory`, ngay sau dòng đọc `affects_pnl` và **trước** khối `try`:

```ts
  const salesRevenue = parseSalesRevenueFlag(kind, affects_pnl, formData.get("is_sales_revenue") === "on");
  if (!salesRevenue.ok) return fail(salesRevenue.error);
```

rồi thêm `is_sales_revenue: salesRevenue.value` vào đối tượng của `insert(...)` và của
`update(...)`. Import `parseSalesRevenueFlag` từ `@/lib/finance/cash-entry-rules`.
Test "guards every exported action behind an auth check" vẫn phải đếm đúng 5 hàm.

Chạy lại, thấy xanh.

- [ ] **Bước 5: Form, test đỏ**

Thêm vào `app/admin/finance/categories/components/CategoryForm.test.tsx`:

```ts
const MANUAL_REVENUE: DBCashCategory = {
  id: "CFC-006",
  name: "Doanh thu ghi tay",
  kind: "INCOME",
  affects_pnl: true,
  is_sales_revenue: true,
  status: "ACTIVE",
} as DBCashCategory;

describe("CategoryForm sales-revenue box (BR-CASH-006)", () => {
  function open(ui: React.ReactElement) {
    render(ui);
    fireEvent.click(screen.getByRole("button", { name: /Sửa|Thêm nhóm/ }));
  }

  it("shows the box, ticked, on an income category already marked", () => {
    open(<CategoryForm category={MANUAL_REVENUE} hasEntries />);
    expect((screen.getByLabelText("Tính là doanh thu bán hàng") as HTMLInputElement).checked).toBe(true);
  });

  it("hides the box on an expense category", () => {
    open(<CategoryForm category={CATEGORY} />);
    expect(screen.queryByLabelText("Tính là doanh thu bán hàng")).toBeNull();
  });

  it("shows the box on a new form once Thu is chosen", () => {
    open(<CategoryForm />);
    expect(screen.queryByLabelText("Tính là doanh thu bán hàng")).toBeNull();
    fireEvent.change(screen.getByLabelText("Bên"), { target: { value: "INCOME" } });
    expect(screen.getByLabelText("Tính là doanh thu bán hàng")).toBeTruthy();
  });

  it("clears the box when 'Tính vào lãi lỗ' is unticked, and does not re-tick it", () => {
    open(<CategoryForm category={MANUAL_REVENUE} hasEntries />);
    fireEvent.click(screen.getByLabelText("Tính vào lãi lỗ"));
    expect(screen.queryByLabelText("Tính là doanh thu bán hàng")).toBeNull();
    fireEvent.click(screen.getByLabelText("Tính vào lãi lỗ"));
    expect((screen.getByLabelText("Tính là doanh thu bán hàng") as HTMLInputElement).checked).toBe(false);
  });
});
```

Nếu nút mở form hay nhãn "Bên" trong file test hiện có được lấy theo cách khác thì làm
theo cách của file; ý của bốn test giữ nguyên. Chạy, thấy đỏ vì **thiếu phần tử**.

- [ ] **Bước 6: Sửa form**

Trong `CategoryForm.tsx`:

```tsx
const [kind, setKind] = useState<"EXPENSE" | "INCOME">(category?.kind ?? "EXPENSE");
const [isSalesRevenue, setIsSalesRevenue] = useState(category?.is_sales_revenue === true);
// BR-CASH-006: only an income category that counts in profit and loss can
// be sales revenue. Hidden otherwise, and cleared the moment either
// condition goes away, so a hidden box can never submit "on".
const canBeSalesRevenue = kind === "INCOME" && affectsPnl;
```

- Ô select "Bên": đổi `defaultValue={category?.kind ?? "EXPENSE"}` thành
  `value={kind}` và thêm
  `onChange={(e) => { const next = e.target.value as "EXPENSE" | "INCOME"; setKind(next); if (next !== "INCOME") setIsSalesRevenue(false); }}`.
  Giữ nguyên `disabled` và ô ẩn khi bị khoá.
- Ô "Tính vào lãi lỗ": `onChange={(e) => { setAffectsPnl(e.target.checked); if (!e.target.checked) setIsSalesRevenue(false); }}`.
- Ngay dưới ô "Tính vào lãi lỗ":

```tsx
{canBeSalesRevenue && (
  <div>
    <label className="flex items-center gap-2 text-sm text-text-primary">
      <input
        type="checkbox"
        name="is_sales_revenue"
        checked={isSalesRevenue}
        onChange={(e) => setIsSalesRevenue(e.target.checked)}
        className="h-4 w-4 rounded border-border focus:ring-2 focus:ring-focus-ring"
      />
      Tính là doanh thu bán hàng
    </label>
    <p className="mt-1 text-xs text-text-muted">
      Đánh dấu khi tiền của nhóm này là tiền bán hàng ghi tay. Trang Lãi lỗ cộng vào dòng Doanh thu thay vì Thu khác.
    </p>
  </div>
)}
```

- Trong `handleSubmit`, hỏi lại khi **một trong hai** cờ đổi trên nhóm đã có dòng sổ
  (dùng lại hàm sẵn có, thân nó không riêng gì `affects_pnl`):

```ts
if (category) {
  const pnlTreatmentChanged =
    shouldConfirmAffectsPnlChange(isKindLocked, category.affects_pnl, affectsPnl) ||
    shouldConfirmAffectsPnlChange(isKindLocked, category.is_sales_revenue === true, isSalesRevenue);
  if (pnlTreatmentChanged) {
    // ... khối confirm hiện có, giữ nguyên câu AFFECTS_PNL_CHANGE_WARNING
  }
}
```

Chạy test form, thấy xanh.

- [ ] **Bước 7: Danh sách nhóm hiện cờ**

Trong `CategoriesList.tsx` thêm và dùng ở cả dòng 124 (máy tính) lẫn dòng 170 (điện
thoại):

```ts
export function pnlTreatmentLabel(category: Pick<DBCashCategory, "affects_pnl" | "is_sales_revenue">): string {
  if (!category.affects_pnl) return "Không";
  return category.is_sales_revenue === true ? "Có — doanh thu bán hàng" : "Có";
}
```

Test `CategoriesList.test.ts` (không cần jsdom):

```ts
import { describe, expect, it } from "vitest";
import { pnlTreatmentLabel } from "./CategoriesList";

describe("pnlTreatmentLabel (BR-CASH-006)", () => {
  it("names the three treatments", () => {
    expect(pnlTreatmentLabel({ affects_pnl: false, is_sales_revenue: false })).toBe("Không");
    expect(pnlTreatmentLabel({ affects_pnl: true, is_sales_revenue: false })).toBe("Có");
    expect(pnlTreatmentLabel({ affects_pnl: true, is_sales_revenue: true })).toBe("Có — doanh thu bán hàng");
  });
});
```

Viết test trước, thấy đỏ vì **thiếu hàm**, rồi viết hàm.

- [ ] **Bước 8: Ghi luật `BR-CASH-006`**

Thêm vào cuối `docs/02-rules/business-rules/cash-book.md`:

```md
### BR-CASH-006 — A category can be marked as sales revenue

**Status:** `APPROVED` — owner decision 2026-09-11 (P&L design, `docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md`).

An income category that counts in profit and loss can carry a second flag, "Tính là doanh thu bán hàng" (`cash_categories.is_sales_revenue`). Its rows then count as sales revenue on the P&L, on the "· trong đó ghi tay" line under Doanh thu (`BR-PNL-003`), instead of under Thu khác. Owner, 2026-09-11, on the two lost-revenue rows: "Tính vào doanh thu".

- **Only an income category that counts in profit and loss** can carry it. The form hides the box otherwise and clears it when the category switches to Chi or stops counting in profit and loss; the server refuses it ("Chỉ nhóm Thu có tính vào lãi lỗ mới đánh dấu được là doanh thu bán hàng."); a database check refuses it a third time (migration `0102`).
- **It sits on the category, not on each row**, like `affects_pnl` (`BR-CASH-003`). Changing it moves every past month of that category, so on a category that already has rows the form asks before saving.
- **Only the owner sets it.** The migration adds the column as false everywhere; after release the owner ticks it on "Doanh thu ghi tay" (`CFC-006`) himself. Until then that category's two rows show under Thu khác, and April's revenue reads 8.411.868đ short while net profit is unchanged.
```

Trong `docs/03-workflows/cash-book.md`: thêm `BR-CASH-006` vào `brCodes:`, và thêm một
đoạn ngắn ở phần mô tả màn nhóm thu chi: form có ô "Tính là doanh thu bán hàng", chỉ
hiện khi nhóm là Thu và tính vào lãi lỗ, luật ở `BR-CASH-006`.

- [ ] **Bước 9: Kiểm toàn bộ và lưu**

```bash
npx tsc --noEmit
npx vitest run
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
git checkout -- docs/generated/system-map.md
git add supabase/migrations/0102_cash_category_sales_revenue.sql \
  tests/migrations/cash-category-sales-revenue-migration.test.ts types/db.ts \
  lib/finance/cash-entry-rules.ts lib/finance/cash-entry-rules.test.ts \
  app/admin/finance/categories/actions.ts app/admin/finance/categories/actions.test.ts \
  app/admin/finance/categories/components/CategoryForm.tsx \
  app/admin/finance/categories/components/CategoryForm.test.tsx \
  app/admin/finance/categories/components/CategoriesList.tsx \
  app/admin/finance/categories/components/CategoriesList.test.ts \
  docs/02-rules/business-rules/cash-book.md docs/03-workflows/cash-book.md
git commit -m "feat(finance): mark a cash category as sales revenue (BR-CASH-006)"
```

---

## Mục 3 — Số chính xác từng tháng, server action và phép so với `getPnLDataV2`

Module và action phải lên cùng một lần lưu: cửa `orphan-modules` đỏ nếu một file
`lib/` chưa có ai import.

**File:**
- Tạo: `lib/reports/profit-and-loss.ts`, test `lib/reports/profit-and-loss.test.ts`
- Tạo: `app/admin/reports/pnl/actions.ts`, test `app/admin/reports/pnl/actions.test.ts`
- Tạo: `scripts/verify-pnl-monthly-core.ts`, test `scripts/verify-pnl-monthly-core.test.ts`
- Tạo: `scripts/verify-pnl-monthly.ts`
- Sửa: `scripts/verify-cogs.ts` (một câu in ra đã cũ)
- Sửa: `docs/02-rules/business-rules/cogs.md` (`BR-COGS-007`, `BR-COGS-008`)

**Giao diện:**
- Cần từ mục trước: `selectCostedIssues`, `isNonInventoryItem` (Mục 1). Cờ
  `is_sales_revenue` (Mục 2), đọc bằng `=== true`.
- Đưa ra cho mục sau: các kiểu và hàm dưới đây, đúng tên.

```ts
export type PnlSourceKind = "CASH_ENTRY" | "PO_LINE" | "STOCKTAKE" | "ISSUE_SLIP" | "ASSET";

export interface PnlSource {
  kind: PnlSourceKind;
  id: string;            // cash entry id, PO line id, session id, slip id, asset id
  date: string | null;   // "YYYY-MM-DD" Saigon; null for depreciation
  label: string;         // what the owner reads: note, item name, asset name
  ref: string | null;    // purchase order id for PO_LINE, otherwise null
  amountExact: number;
}

export interface PnlMonthFigures {
  month: string;                     // "YYYY-MM"
  posRevenue: number;
  posOrderCount: number;
  posRevenueBeforePayments: number;  // part of posRevenue with no payment record to check against
  manualRevenue: number;
  cogsExact: number;
  shrinkageExact: number;
  nonInventoryExact: number;
  expenseByCategory: Record<string, number>;
  otherIncome: number;
  depreciationExact: number;
  sources: {
    manualRevenue: PnlSource[];
    cogs: PnlSource[];
    shrinkage: PnlSource[];
    nonInventory: PnlSource[];
    expense: Record<string, PnlSource[]>;
    otherIncome: PnlSource[];
    depreciation: PnlSource[];
  };
}

export interface PnlFigures {
  year: number;
  months: PnlMonthFigures[];
  expenseCategories: Array<{ id: string; name: string }>;
  firstPaymentDate: string | null;   // "YYYY-MM-DD" Saigon
}

export interface PnlInput {
  year: number;
  today: string;                     // "YYYY-MM-DD" Saigon
  orders: any[];
  cashEntries: any[];
  cashCategories: any[];
  purchaseOrders: any[];
  purchaseOrderLines: any[];
  purchasedItems: any[];
  itemCategories: any[];
  stockIssues: any[];
  stocktakeSessions: any[];
  assets: any[];
  assetDisposals: any[];
  firstPaymentAt: string | null;     // ISO timestamp of the earliest order_payments row
}

export function computeProfitAndLoss(input: PnlInput): PnlFigures;
export function listAvailableYears(saigonDates: Array<string | null | undefined>, currentYear: number): number[];

// app/admin/reports/pnl/actions.ts
export interface ProfitAndLossReport { availableYears: number[]; figures: PnlFigures }
export async function getProfitAndLossReport(year?: number): Promise<ProfitAndLossReport>;
```

- [ ] **Bước 1: Test đỏ cho module**

Tạo `lib/reports/profit-and-loss.test.ts`. Tên và mã trong dữ liệu mẫu lấy theo dữ
liệu thật cho dễ đối chiếu, số tiền làm tròn cho dễ tính nhẩm.

```ts
import { describe, expect, it } from "vitest";
import { computeProfitAndLoss, listAvailableYears, type PnlFigures, type PnlInput } from "./profit-and-loss";

function input(overrides: Partial<PnlInput> = {}): PnlInput {
  return {
    year: 2026,
    today: "2026-09-11",
    orders: [], cashEntries: [], cashCategories: [], purchaseOrders: [], purchaseOrderLines: [],
    purchasedItems: [], itemCategories: [], stockIssues: [], stocktakeSessions: [], assets: [], assetDisposals: [],
    firstPaymentAt: "2026-07-19T01:00:00Z",
    ...overrides,
  };
}
const month = (f: PnlFigures, m: string) => {
  const found = f.months.find(x => x.month === m);
  if (!found) throw new Error(`month ${m} not in figures`);
  return found;
};

const RAW = { id: "NHH-001", system_type: "RAW" };
const CONSUMABLE = { id: "NHH-002", system_type: "CONSUMABLE" };
const EQUIPMENT = { id: "NHH-003", system_type: "EQUIPMENT" };
const po = (id: string, at: string, extra: Record<string, unknown> = {}) => ({
  id, status: "COMPLETED", transaction_date: at, created_at: at,
  shipping_fee: 0, tax_amount: 0, voucher_amount: 0, discount_amount: 0, ...extra,
});

describe("POS revenue", () => {
  it("counts completed, latest-version orders in their Saigon month -- the getPnLDataV2 filter", () => {
    const f = computeProfitAndLoss(input({
      firstPaymentAt: "2026-08-01T00:00:00Z",
      orders: [
        { id: "O1", status: "COMPLETED", superseded_by: null, created_at: "2026-07-31T17:30:00Z", net_total: 50_000 }, // 01/08 Saigon
        { id: "O2", status: "COMPLETED", superseded_by: "", created_at: "2026-08-05T03:00:00Z", net_total: 30_000 },
        { id: "O3", status: "CANCELLED", superseded_by: null, created_at: "2026-08-05T03:00:00Z", net_total: 99_000 },
        { id: "O4", status: "COMPLETED", superseded_by: "O5", created_at: "2026-08-05T03:00:00Z", net_total: 70_000 },
      ],
    }));
    expect(f.months.map(m => m.month)).toEqual(["2026-08", "2026-09"]);
    expect(month(f, "2026-08").posRevenue).toBe(80_000);
    expect(month(f, "2026-08").posOrderCount).toBe(2);
    // O1 is before the first payment record, O2 after it
    expect(month(f, "2026-08").posRevenueBeforePayments).toBe(50_000);
    expect(f.firstPaymentDate).toBe("2026-08-01");
  });
});

describe("cash book", () => {
  const categories = [
    { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
    { id: "CFC-004", name: "Thu khác", kind: "INCOME", affects_pnl: true, status: "ACTIVE" },
    { id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false, status: "ACTIVE" },
    { id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", affects_pnl: true, is_sales_revenue: true, status: "ACTIVE" },
    { id: "CFC-009", name: "Nhóm cũ", kind: "EXPENSE", affects_pnl: true, status: "INACTIVE" },
  ];
  const entries = [
    { id: "CE-023", entry_date: "2026-08-02", category_id: "CFC-001", amount: 300_000, note: "Dán lại xe Phin Đi", status: "ACTIVE" },
    { id: "CE-029", entry_date: "2026-08-31", category_id: "CFC-001", amount: 130_000, note: "Phin Đi - Gửi xe", status: "ACTIVE" },
    { id: "CE-098", entry_date: "2026-08-10", category_id: "CFC-001", amount: 999_000, note: "Nhập nhầm", status: "CANCELLED" },
    { id: "CE-024", entry_date: "2026-08-15", category_id: "CFC-005", amount: 1_472_000, note: "Vốn góp", status: "ACTIVE" },
    { id: "CE-033", entry_date: "2026-04-30", category_id: "CFC-006", amount: 5_000_000, note: null, status: "ACTIVE" },
    { id: "CE-034", entry_date: "2026-04-30", category_id: "CFC-006", amount: 3_411_868, note: null, status: "ACTIVE" },
    { id: "CE-050", entry_date: "2026-08-20", category_id: "CFC-004", amount: 200_000, note: "Bán ve chai", status: "ACTIVE" },
  ];

  it("splits rows into expense groups, sales revenue and other income; leaves out cancelled rows and capital", () => {
    const f = computeProfitAndLoss(input({ cashCategories: categories, cashEntries: entries }));
    const aug = month(f, "2026-08");
    expect(aug.expenseByCategory).toEqual({ "CFC-001": 430_000 });
    expect(aug.sources.expense["CFC-001"].map(s => s.id)).toEqual(["CE-023", "CE-029"]);
    expect(aug.sources.expense["CFC-001"][0]).toEqual({
      kind: "CASH_ENTRY", id: "CE-023", date: "2026-08-02", label: "Dán lại xe Phin Đi", ref: null, amountExact: 300_000,
    });
    expect(aug.otherIncome).toBe(200_000);
    expect(aug.manualRevenue).toBe(0);
    const apr = month(f, "2026-04");
    expect(apr.manualRevenue).toBe(8_411_868);
    expect(apr.sources.manualRevenue.map(s => s.label)).toEqual(["Không có ghi chú", "Không có ghi chú"]);
    expect(f.months[0].month).toBe("2026-04");
  });

  it("shows an expense group while it is in use, or when the year has a figure for it", () => {
    const f = computeProfitAndLoss(input({ cashCategories: categories, cashEntries: entries }));
    expect(f.expenseCategories).toEqual([{ id: "CFC-001", name: "Vận hành" }]);
    const withOld = computeProfitAndLoss(input({
      cashCategories: categories,
      cashEntries: [...entries, { id: "CE-060", entry_date: "2026-05-03", category_id: "CFC-009", amount: 10_000, note: null, status: "ACTIVE" }],
    }));
    expect(withOld.expenseCategories.map(c => c.id)).toEqual(["CFC-001", "CFC-009"]);
  });

  it("without the sales-revenue flag, hand-recorded revenue falls to other income", () => {
    const unflagged = categories.map(c => (c.id === "CFC-006" ? { ...c, is_sales_revenue: undefined } : c));
    const apr = month(computeProfitAndLoss(input({ cashCategories: unflagged, cashEntries: entries })), "2026-04");
    expect(apr.manualRevenue).toBe(0);
    expect(apr.otherIncome).toBe(8_411_868);
  });

  it("refuses a row whose category does not exist, naming the row", () => {
    expect(() => computeProfitAndLoss(input({
      cashCategories: categories,
      cashEntries: [{ id: "CE-777", entry_date: "2026-08-02", category_id: "CFC-404", amount: 1, note: null, status: "ACTIVE" }],
    }))).toThrow("CE-777");
  });
});

describe("bought for immediate use (Nguyên liệu mua dùng ngay)", () => {
  it("takes each flagged line's paid share, in the Saigon month of the order; equipment never counts", () => {
    const f = computeProfitAndLoss(input({
      itemCategories: [RAW, EQUIPMENT],
      purchasedItems: [
        { id: "SPM-010", name: "Đá viên", item_category_id: "NHH-001", is_non_inventory: true },
        { id: "SPM-001", name: "Sữa tươi", item_category_id: "NHH-001", is_non_inventory: false },
        { id: "SPM-091", name: "Ly thuỷ tinh", item_category_id: "NHH-003", is_non_inventory: true },
      ],
      purchaseOrders: [
        po("PO-173", "2026-05-31T17:00:00Z", { shipping_fee: 20_000 }), // 01/06 Saigon
        po("PO-174", "2026-06-10T03:00:00Z", { status: "DRAFT" }),
      ],
      purchaseOrderLines: [
        { id: "POL-a", purchase_order_id: "PO-173", purchased_item_id: "SPM-010", base_quantity: 10, subtotal: 100_000 },
        { id: "POL-b", purchase_order_id: "PO-173", purchased_item_id: "SPM-001", base_quantity: 10, subtotal: 100_000 },
        { id: "POL-c", purchase_order_id: "PO-173", purchased_item_id: "SPM-091", base_quantity: 1, subtotal: 200_000 },
        { id: "POL-d", purchase_order_id: "PO-174", purchased_item_id: "SPM-010", base_quantity: 10, subtotal: 90_000 },
      ],
    }));
    expect(f.months[0].month).toBe("2026-06");
    const jun = month(f, "2026-06");
    // 20.000đ shipping over a 400.000đ order: this line carries 5%, 5.000đ
    expect(jun.nonInventoryExact).toBe(105_000);
    expect(jun.sources.nonInventory).toEqual([
      { kind: "PO_LINE", id: "POL-a", date: "2026-06-01", label: "Đá viên", ref: "PO-173", amountExact: 105_000 },
    ]);
  });
});

describe("cost of goods and shrinkage", () => {
  const items = [
    { id: "SPM-001", name: "Sữa tươi", item_category_id: "NHH-001", is_non_inventory: false },
    { id: "SPM-057", name: "Khăn lau đa năng", item_category_id: "NHH-002", is_non_inventory: true },
  ];
  const base = {
    itemCategories: [RAW, CONSUMABLE],
    purchasedItems: items,
    purchaseOrders: [po("PO-1", "2026-07-01T03:00:00Z"), po("PO-2", "2026-08-01T03:00:00Z")],
    purchaseOrderLines: [
      // 100đ per unit
      { id: "POL-1", purchase_order_id: "PO-1", purchased_item_id: "SPM-001", base_quantity: 1000, subtotal: 100_000 },
      { id: "POL-2", purchase_order_id: "PO-2", purchased_item_id: "SPM-057", base_quantity: 10, subtotal: 10_000 },
    ],
    stocktakeSessions: [
      { id: "STK-001", is_shrinkage: false },
      { id: "STK-003", is_shrinkage: true },
    ],
    stockIssues: [
      { id: "ISS-1", purchased_item_id: "SPM-001", issued_at: "2026-07-10T03:00:00Z", base_quantity: 200, source: "MANUAL", issue_slip_id: "ISL-1", note: "Pha chế" },
      { id: "ISS-2", purchased_item_id: "SPM-001", issued_at: "2026-08-09T03:00:00Z", base_quantity: 300, source: "STOCKTAKE", session_id: "STK-001" },
      { id: "ISS-3", purchased_item_id: "SPM-001", issued_at: "2026-08-20T03:00:00Z", base_quantity: 100, source: "STOCKTAKE", session_id: "STK-003" },
      { id: "ISS-4", purchased_item_id: "SPM-057", issued_at: "2026-08-21T03:00:00Z", base_quantity: 1, source: "MANUAL", issue_slip_id: "ISL-2", note: "Lau bàn" },
    ],
  };

  it("uses the same engine as getPnLDataV2, split by the session's own flag", () => {
    const f = computeProfitAndLoss(input(base));
    expect(month(f, "2026-07").cogsExact).toBeCloseTo(20_000, 6);
    expect(month(f, "2026-07").shrinkageExact).toBeCloseTo(0, 6);
    expect(month(f, "2026-08").cogsExact).toBeCloseTo(30_000, 6);
    expect(month(f, "2026-08").shrinkageExact).toBeCloseTo(10_000, 6);
  });

  it("names each count and each slip, and they add up to the month's figure", () => {
    const f = computeProfitAndLoss(input(base));
    const jul = month(f, "2026-07");
    expect(jul.sources.cogs).toHaveLength(1);
    expect(jul.sources.cogs[0]).toMatchObject({ kind: "ISSUE_SLIP", id: "ISL-1", date: "2026-07-10", label: "Phiếu xuất: Pha chế" });
    const aug = month(f, "2026-08");
    expect(aug.sources.cogs.map(s => [s.kind, s.id, s.date, s.label])).toEqual([["STOCKTAKE", "STK-001", "2026-08-09", "Kiểm kê định kỳ"]]);
    expect(aug.sources.shrinkage.map(s => s.id)).toEqual(["STK-003"]);
    const sum = (xs: { amountExact: number }[]) => xs.reduce((a, s) => a + s.amountExact, 0);
    expect(sum(aug.sources.cogs)).toBeCloseTo(aug.cogsExact, 6);
    expect(sum(aug.sources.shrinkage)).toBeCloseTo(aug.shrinkageExact, 6);
  });

  it("an issue slip for an item bought for immediate use never reaches cost of goods", () => {
    const aug = month(computeProfitAndLoss(input(base)), "2026-08");
    expect(aug.sources.cogs.some(s => s.id === "ISL-2")).toBe(false);
    // its money sits on the bought-for-use line instead, once
    expect(aug.nonInventoryExact).toBe(10_000);
  });
});

describe("depreciation", () => {
  it("charges each asset's own schedule; an INACTIVE asset is a data-entry mistake and is left out", () => {
    const f = computeProfitAndLoss(input({
      assets: [
        { id: "TS-001", name_snapshot: "Máy xay", acquired_date: "2026-03-15", total_cost: 1_200_000, quantity: 1, term_months: 12, status: "ACTIVE" },
        { id: "TS-002", name_snapshot: "Nhập nhầm", acquired_date: "2026-03-01", total_cost: 600_000, quantity: 1, term_months: 12, status: "INACTIVE" },
      ],
    }));
    expect(f.months.map(m => m.month)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(month(f, "2026-03").depreciationExact).toBe(100_000);
    expect(month(f, "2026-03").sources.depreciation).toEqual([
      { kind: "ASSET", id: "TS-001", date: null, label: "Máy xay", ref: null, amountExact: 100_000 },
    ]);
  });
});

describe("which months", () => {
  it("a past year runs to December; a future year has none", () => {
    const asset = { id: "TS-001", name_snapshot: "Máy xay", acquired_date: "2025-11-01", total_cost: 1_200_000, quantity: 1, term_months: 12, status: "ACTIVE" };
    expect(computeProfitAndLoss(input({ year: 2025, assets: [asset] })).months.map(m => m.month)).toEqual(["2025-11", "2025-12"]);
    expect(computeProfitAndLoss(input({ year: 2027, assets: [asset] })).months).toEqual([]);
  });

  it("a year with nothing in it has no months", () => {
    expect(computeProfitAndLoss(input()).months).toEqual([]);
  });
});

describe("listAvailableYears", () => {
  it("runs from the earliest year with data to this year, newest first", () => {
    expect(listAvailableYears(["2026-03-15", null, "2025-11-01", undefined], 2026)).toEqual([2026, 2025]);
  });
  it("offers this year when there is no data at all", () => {
    expect(listAvailableYears([], 2026)).toEqual([2026]);
  });
});
```

- [ ] **Bước 2: Chạy, thấy đỏ**

Chạy: `npx vitest run lib/reports/profit-and-loss.test.ts`
Mong đợi: đỏ vì **thiếu module**.

- [ ] **Bước 3: Viết module**

Tạo `lib/reports/profit-and-loss.ts`. Dán nguyên phần kiểu ở mục "Giao diện" phía
trên, rồi:

```ts
import { ORDER_STATUS, coerceOrderV2 } from "@/lib/sales/order-types";
import { saigonBucketKeys, toSaigonUtcRange } from "@/lib/shared/report-time";
import { allocatePurchaseOrderCost } from "@/lib/costing/purchase-order-cost-allocation";
import { computePeriodIssuedValueSplit } from "@/lib/costing/issue-costing";
import {
  buildClassifiedIssues,
  buildIssueCostingPurchases,
  isNonInventoryItem,
  selectCostedIssues,
} from "@/lib/costing/issue-costing-inputs";
import { computeIssuedEventFigures } from "@/lib/reports/issued-value-report";
import { buildAssetSchedule, chargeForMonth, type DisposalInput } from "@/lib/assets/asset-depreciation";

// docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md. Every figure
// is recomputed from source rows on every read -- nothing here is stored,
// and no month is ever locked (owner, 2026-09-08). Values stay exact; the
// display layer (lib/reports/profit-and-loss-table.ts) rounds them.

const NEAR_ZERO = 0.005;

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

// January of `year` through the current month (this year) or December (a
// past year). A future year has no months.
function candidateMonths(year: number, today: string): string[] {
  const currentYear = Number(today.slice(0, 4));
  if (year > currentYear) return [];
  const last = year === currentYear ? Number(today.slice(5, 7)) : 12;
  return Array.from({ length: last }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

function emptyMonth(month: string): PnlMonthFigures {
  return {
    month,
    posRevenue: 0, posOrderCount: 0, posRevenueBeforePayments: 0, manualRevenue: 0,
    cogsExact: 0, shrinkageExact: 0, nonInventoryExact: 0,
    expenseByCategory: {}, otherIncome: 0, depreciationExact: 0,
    sources: { manualRevenue: [], cogs: [], shrinkage: [], nonInventory: [], expense: {}, otherIncome: [], depreciation: [] },
  };
}

function hasAnyFigure(m: PnlMonthFigures): boolean {
  const figures = [
    m.posRevenue, m.manualRevenue, m.cogsExact, m.shrinkageExact, m.nonInventoryExact,
    m.otherIncome, m.depreciationExact, ...Object.values(m.expenseByCategory),
  ];
  return m.posOrderCount > 0 || figures.some(x => Math.abs(x) > NEAR_ZERO);
}

const byDateThenId = (a: PnlSource, b: PnlSource) =>
  (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id);
const byAmountDesc = (a: PnlSource, b: PnlSource) => b.amountExact - a.amountExact || a.id.localeCompare(b.id);

export function computeProfitAndLoss(input: PnlInput): PnlFigures {
  const months = candidateMonths(input.year, input.today);
  const byMonth = new Map(months.map(m => [m, emptyMonth(m)]));

  // 1. POS revenue: exactly getPnLDataV2's filter (app/admin/reports/actions.ts).
  const firstPaymentMs = input.firstPaymentAt ? new Date(input.firstPaymentAt).getTime() : null;
  for (const o of input.orders) {
    if (o.status !== ORDER_STATUS.COMPLETED) continue;
    if (o.superseded_by && o.superseded_by !== "") continue;
    if (!o.created_at) continue;
    const m = byMonth.get(saigonBucketKeys(o.created_at).monthKey);
    if (!m) continue;
    const net = coerceOrderV2(o).net_total;
    m.posRevenue += net;
    m.posOrderCount += 1;
    // BR-SALE-005: before the first payment record, revenue can only be
    // checked against itself.
    if (firstPaymentMs === null || new Date(o.created_at).getTime() < firstPaymentMs) {
      m.posRevenueBeforePayments += net;
    }
  }

  // 2. Cash book: ACTIVE rows of categories that count in P&L (BR-CASH-002,
  // BR-CASH-003). A sales-revenue category (BR-CASH-006) is revenue, any
  // other income category is Thu khác.
  const categoryById = new Map(input.cashCategories.map(c => [c.id, c]));
  for (const e of input.cashEntries) {
    if (e.status !== "ACTIVE") continue;
    const category = categoryById.get(e.category_id);
    if (!category) {
      throw new Error(`Dòng sổ ${e.id} trỏ tới nhóm ${e.category_id}, nhưng không tìm thấy nhóm này`);
    }
    if (!category.affects_pnl) continue;
    const date = String(e.entry_date).slice(0, 10);
    const m = byMonth.get(date.slice(0, 7));
    if (!m) continue;
    const amount = Number(e.amount);
    const source: PnlSource = {
      kind: "CASH_ENTRY", id: e.id, date, label: e.note?.trim() || "Không có ghi chú", ref: null, amountExact: amount,
    };
    if (category.kind === "EXPENSE") {
      m.expenseByCategory[category.id] = (m.expenseByCategory[category.id] ?? 0) + amount;
      (m.sources.expense[category.id] ??= []).push(source);
    } else if (category.is_sales_revenue === true) {
      m.manualRevenue += amount;
      m.sources.manualRevenue.push(source);
    } else {
      m.otherIncome += amount;
      m.sources.otherIncome.push(source);
    }
  }

  // 3. Bought for immediate use (BR-COGS-007): completed orders only, each
  // line at its paid share (BR-COGS-006), in the order's Saigon month.
  // Equipment never counts here -- it depreciates.
  const itemById = new Map(input.purchasedItems.map(p => [p.id, p]));
  const equipmentCategoryIds = new Set(
    input.itemCategories.filter(c => c.system_type === "EQUIPMENT").map(c => c.id),
  );
  const linesByOrder = new Map<string, any[]>();
  for (const line of input.purchaseOrderLines) {
    const list = linesByOrder.get(line.purchase_order_id) ?? [];
    list.push(line);
    linesByOrder.set(line.purchase_order_id, list);
  }
  for (const po of input.purchaseOrders) {
    if (po.status !== "COMPLETED") continue;
    const lines = linesByOrder.get(po.id) ?? [];
    const flagged = lines.filter(l => {
      const item = itemById.get(l.purchased_item_id);
      return !!item && isNonInventoryItem(item) && !equipmentCategoryIds.has(item.item_category_id);
    });
    if (flagged.length === 0) continue;
    const keys = saigonBucketKeys(po.transaction_date || po.created_at);
    const m = byMonth.get(keys.monthKey);
    if (!m) continue;
    const paidByLineId = allocatePurchaseOrderCost(
      lines.map(l => ({ lineId: l.id, subtotal: Number(l.subtotal) || 0 })),
      (Number(po.shipping_fee) || 0) + (Number(po.tax_amount) || 0),
      (Number(po.voucher_amount) || 0) + (Number(po.discount_amount) || 0),
    );
    for (const line of flagged) {
      const amount = paidByLineId.get(line.id) ?? (Number(line.subtotal) || 0);
      m.nonInventoryExact += amount;
      m.sources.nonInventory.push({
        kind: "PO_LINE", id: line.id, date: keys.dateKey,
        label: itemById.get(line.purchased_item_id)?.name ?? line.purchased_item_id,
        ref: po.id, amountExact: amount,
      });
    }
  }

  // 4. Cost of goods and shrinkage: the same engine and inputs as
  // getPnLDataV2, so Giá vốn + Hao hụt equals its totalCOGS for every month
  // (scripts/verify-pnl-monthly.ts checks this on real data).
  const purchases = buildIssueCostingPurchases(input.purchaseOrders, input.purchaseOrderLines);
  const costedIssues = selectCostedIssues(input.stockIssues, input.purchasedItems, input.itemCategories);
  const classifiedIssues = buildClassifiedIssues(costedIssues, input.stocktakeSessions);
  for (const month of months) {
    const range = toSaigonUtcRange(`${month}-01`, lastDayOfMonth(month))!;
    const split = computePeriodIssuedValueSplit(purchases, classifiedIssues, range.startUtc, range.endUtc);
    const m = byMonth.get(month)!;
    m.cogsExact = split.cost;
    m.shrinkageExact = split.shrinkage;
  }
  // Which count or slip makes up each month's figure. Classified the same
  // way buildClassifiedIssues does: a count is shrinkage unless its session
  // says it is not.
  const notShrinkageSessionIds = new Set(
    input.stocktakeSessions.filter(s => s.is_shrinkage === false).map(s => s.id),
  );
  for (const event of computeIssuedEventFigures(costedIssues, purchases)) {
    const keys = saigonBucketKeys(event.at);
    const m = byMonth.get(keys.monthKey);
    if (!m || Math.abs(event.valueExact) <= NEAR_ZERO) continue;
    const groupId = event.key.slice(2); // "S:<session_id>" or "M:<issue_slip_id>"
    if (event.kind === "STOCKTAKE") {
      const source: PnlSource = {
        kind: "STOCKTAKE", id: groupId, date: keys.dateKey, label: "Kiểm kê định kỳ", ref: null, amountExact: event.valueExact,
      };
      (notShrinkageSessionIds.has(groupId) ? m.sources.cogs : m.sources.shrinkage).push(source);
    } else {
      m.sources.cogs.push({
        kind: "ISSUE_SLIP", id: groupId, date: keys.dateKey, label: `Phiếu xuất: ${event.label}`, ref: null, amountExact: event.valueExact,
      });
    }
  }

  // 5. Depreciation (BR-COGS-008): every asset but INACTIVE ones, which are
  // data-entry mistakes -- the same exclusion as the asset register page.
  const disposalsByAsset = new Map<string, DisposalInput[]>();
  for (const d of input.assetDisposals) {
    const list = disposalsByAsset.get(d.asset_id) ?? [];
    list.push({ quantity: Number(d.quantity), disposed_date: d.disposed_date });
    disposalsByAsset.set(d.asset_id, list);
  }
  for (const asset of input.assets) {
    if (asset.status === "INACTIVE") continue;
    const schedule = buildAssetSchedule(
      {
        acquired_date: asset.acquired_date,
        total_cost: Number(asset.total_cost),
        quantity: Number(asset.quantity),
        term_months: Number(asset.term_months),
      },
      disposalsByAsset.get(asset.id) ?? [],
    );
    for (const month of months) {
      // Exact since Mục 0 (BR-DATA-005): a charge can be 33.333,33...
      const charge = chargeForMonth(schedule, month);
      if (Math.abs(charge) <= NEAR_ZERO) continue;
      const m = byMonth.get(month)!;
      m.depreciationExact += charge;
      m.sources.depreciation.push({
        kind: "ASSET", id: asset.id, date: null, label: asset.name_snapshot, ref: null, amountExact: charge,
      });
    }
  }

  // 6. Months shown: from the first month with anything in it.
  const all = months.map(m => byMonth.get(m)!);
  const first = all.findIndex(hasAnyFigure);
  const shown = first === -1 ? [] : all.slice(first);
  for (const m of shown) {
    m.sources.manualRevenue.sort(byDateThenId);
    m.sources.cogs.sort(byDateThenId);
    m.sources.shrinkage.sort(byDateThenId);
    m.sources.nonInventory.sort(byDateThenId);
    m.sources.otherIncome.sort(byDateThenId);
    for (const list of Object.values(m.sources.expense)) list.sort(byDateThenId);
    m.sources.depreciation.sort(byAmountDesc);
  }

  // 7. Expense groups shown: counting in P&L, and in use or with a figure this year.
  const expenseCategories = input.cashCategories
    .filter(c => c.kind === "EXPENSE" && c.affects_pnl)
    .filter(c => c.status === "ACTIVE" || shown.some(m => Math.abs(m.expenseByCategory[c.id] ?? 0) > NEAR_ZERO))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(c => ({ id: c.id, name: c.name }));

  return {
    year: input.year,
    months: shown,
    expenseCategories,
    firstPaymentDate: input.firstPaymentAt ? saigonBucketKeys(input.firstPaymentAt).dateKey : null,
  };
}

// saigonDates are "YYYY-MM-DD" Saigon dates -- the caller converts
// timestamps first, so an order at 23:30 on 31/12 lands in the right year.
export function listAvailableYears(saigonDates: Array<string | null | undefined>, currentYear: number): number[] {
  let earliest = currentYear;
  for (const d of saigonDates) {
    if (!d) continue;
    const y = Number(String(d).slice(0, 4));
    if (Number.isInteger(y) && y >= 2000 && y < earliest) earliest = y;
  }
  const years: number[] = [];
  for (let y = currentYear; y >= earliest; y--) years.push(y);
  return years;
}
```

- [ ] **Bước 4: Chạy, thấy xanh**

Chạy: `npx vitest run lib/reports/profit-and-loss.test.ts`
Mong đợi: xanh. Nếu test "names each count and each slip" lệch vì thứ tự
`computeIssuedEventFigures` trả ra (mới nhất trước) thì kiểm lại hàm sắp xếp ở bước 6
của module, không sửa test.

- [ ] **Bước 5: Server action, test đỏ**

Tạo `app/admin/reports/pnl/actions.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
}));

import { findAll, findAllNoCache, findAllWhere } from "@/lib/db/tables";
import { getProfitAndLossReport } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T05:00:00Z"));
  requireAdminMock.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" } });
  (findAll as any).mockResolvedValue([]);
  (findAllNoCache as any).mockResolvedValue([]);
  (findAllWhere as any).mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("getProfitAndLossReport", () => {
  it("refuses before loading any data when not signed in as ADMIN or MANAGER", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });
    await expect(getProfitAndLossReport()).rejects.toThrow("Yêu cầu đăng nhập");
    expect(findAll).not.toHaveBeenCalled();
    expect(findAllNoCache).not.toHaveBeenCalled();
    expect(findAllWhere).not.toHaveBeenCalled();
  });

  it("loads only the chosen year's completed orders, bounded in Saigon time", async () => {
    (findAllNoCache as any).mockImplementation(async (sheet: string) =>
      sheet === "assets"
        ? [{ id: "TS-001", name_snapshot: "Máy xay", acquired_date: "2025-11-01", total_cost: 1_200_000, quantity: 1, term_months: 12, status: "ACTIVE" }]
        : []);

    const report = await getProfitAndLossReport(2025);

    expect(report.availableYears).toEqual([2026, 2025]);
    expect(report.figures.year).toBe(2025);
    expect(findAllWhere).toHaveBeenCalledWith("Orders_V2", {
      eq: { status: "COMPLETED" },
      gte: { created_at: new Date("2024-12-31T17:00:00.000Z") },
      lte: { created_at: new Date("2025-12-31T16:59:59.999Z") },
    });
  });

  it("falls back to the newest year when the asked-for year has no data", async () => {
    const report = await getProfitAndLossReport(1999);
    expect(report.figures.year).toBe(2026);
  });

  it("lets an engine error through instead of showing a table of zeros", async () => {
    (findAllNoCache as any).mockImplementation(async (sheet: string) => {
      if (sheet === "Cash_Categories") return [];
      if (sheet === "Cash_Entries") return [{ id: "CE-777", entry_date: "2026-08-02", category_id: "CFC-404", amount: 1, note: null, status: "ACTIVE" }];
      return [];
    });
    await expect(getProfitAndLossReport(2026)).rejects.toThrow("CE-777");
  });
});
```

Chạy `npx vitest run app/admin/reports/pnl/actions.test.ts`, thấy đỏ vì **thiếu module**.

- [ ] **Bước 6: Viết server action**

Tạo `app/admin/reports/pnl/actions.ts`:

```ts
"use server";

import { findAll, findAllNoCache, findAllWhere } from "@/lib/db/tables";
import { requireAdmin } from "@/lib/auth/auth";
import { ORDER_STATUS } from "@/lib/sales/order-types";
import { saigonBucketKeys, toSaigonUtcRange } from "@/lib/shared/report-time";
import { computeProfitAndLoss, listAvailableYears, type PnlFigures } from "@/lib/reports/profit-and-loss";

export interface ProfitAndLossReport {
  availableYears: number[];
  figures: PnlFigures;
}

// BR-PNL-004: ADMIN and MANAGER, the same guard as every other report.
// No try/catch: an engine error must reach the page as an error, never as
// a table of zeros that looks right (plan, question C).
export async function getProfitAndLossReport(year?: number): Promise<ProfitAndLossReport> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const today = saigonBucketKeys(new Date().toISOString()).dateKey;
  const currentYear = Number(today.slice(0, 4));

  // Tables written by RPCs (purchase completion, stocktake confirmation,
  // issue slips) do not revalidate the findAll cache tag, so everything
  // mutable is read uncached. Purchased_Items and Item_Categories are read
  // the way getPnLDataV2 reads them.
  const [
    firstOrders, firstPayments, cashEntries, cashCategories, purchaseOrders, purchaseOrderLines,
    purchasedItems, itemCategories, stockIssues, stocktakeSessions, assets, assetDisposals,
  ] = await Promise.all([
    findAllWhere("Orders_V2", { eq: { status: ORDER_STATUS.COMPLETED }, order: { column: "created_at", ascending: true }, limit: 1 }),
    findAllWhere("Order_Payments", { order: { column: "created_at", ascending: true }, limit: 1 }),
    findAllNoCache("Cash_Entries"),
    findAllNoCache("Cash_Categories"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAll("Purchased_Items"),
    findAll("Item_Categories"),
    findAllNoCache("Stock_Issues"),
    findAllNoCache("stocktake_sessions"),
    findAllNoCache("assets"),
    findAllNoCache("asset_disposals"),
  ]);

  const availableYears = listAvailableYears(
    [
      firstOrders[0]?.created_at ? saigonBucketKeys(firstOrders[0].created_at).dateKey : null,
      ...(cashEntries as any[]).map(e => e.entry_date),
      ...(purchaseOrders as any[])
        .filter(po => po.status === "COMPLETED")
        .map(po => saigonBucketKeys(po.transaction_date || po.created_at).dateKey),
      ...(assets as any[]).map(a => a.acquired_date),
    ],
    currentYear,
  );
  const selectedYear = year !== undefined && availableYears.includes(year) ? year : availableYears[0];

  const yearRange = toSaigonUtcRange(`${selectedYear}-01-01`, `${selectedYear}-12-31`)!;
  const orders = await findAllWhere("Orders_V2", {
    eq: { status: ORDER_STATUS.COMPLETED },
    gte: { created_at: yearRange.startUtc },
    lte: { created_at: yearRange.endUtc },
  });

  const figures = computeProfitAndLoss({
    year: selectedYear,
    today,
    orders: orders as any[],
    cashEntries: cashEntries as any[],
    cashCategories: cashCategories as any[],
    purchaseOrders: purchaseOrders as any[],
    purchaseOrderLines: purchaseOrderLines as any[],
    purchasedItems: purchasedItems as any[],
    itemCategories: itemCategories as any[],
    stockIssues: stockIssues as any[],
    stocktakeSessions: stocktakeSessions as any[],
    assets: assets as any[],
    assetDisposals: assetDisposals as any[],
    firstPaymentAt: (firstPayments[0] as any)?.created_at ?? null,
  });

  return { availableYears, figures };
}
```

Chạy lại test, thấy xanh. Test đầu tiên của file sẽ kiểm `findAllWhere` được gọi
**hai** lần với `Orders_V2` (một lần lấy đơn đầu tiên, một lần lấy năm); test chỉ
khẳng định có lần gọi của năm, không khẳng định số lần.

- [ ] **Bước 7: Phép so từng tháng, test đỏ**

Tạo `scripts/verify-pnl-monthly-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkPnlMonth } from "./verify-pnl-monthly-core";
import type { PnlMonthFigures } from "@/lib/reports/profit-and-loss";

function augustLike(): PnlMonthFigures {
  return {
    month: "2026-08",
    posRevenue: 17_682_000, posOrderCount: 644, posRevenueBeforePayments: 0, manualRevenue: 0,
    cogsExact: 46_418_989.6, shrinkageExact: 0, nonInventoryExact: 1_760_000,
    expenseByCategory: { "CFC-001": 615_000 }, otherIncome: 0, depreciationExact: 790_978,
    sources: {
      manualRevenue: [],
      cogs: [
        { kind: "STOCKTAKE", id: "STK-001", date: "2026-08-09", label: "Kiểm kê định kỳ", ref: null, amountExact: 34_864_626.6 },
        { kind: "ISSUE_SLIP", id: "ISL-00010", date: "2026-08-12", label: "Phiếu xuất: Pha chế", ref: null, amountExact: 11_554_363 },
      ],
      shrinkage: [],
      nonInventory: [{ kind: "PO_LINE", id: "POL-d0228874-66d6-4e78-bef1-059b39ca423d", date: "2026-08-30", label: "Đá viên", ref: "PO-175", amountExact: 1_760_000 }],
      expense: { "CFC-001": [{ kind: "CASH_ENTRY", id: "CE-023", date: "2026-08-02", label: "Dán lại xe Phin Đi", ref: null, amountExact: 615_000 }] },
      otherIncome: [],
      depreciation: [{ kind: "ASSET", id: "TS-001", date: null, label: "Máy xay", ref: null, amountExact: 790_978 }],
    },
  };
}
const reference = { totalRevenue: 17_682_000, totalCOGS: 46_418_990, shrinkageValue: 0 };

describe("checkPnlMonth", () => {
  it("finds nothing wrong when the month agrees with getPnLDataV2 and with its own sources", () => {
    expect(checkPnlMonth(augustLike(), reference)).toEqual([]);
  });

  it("names a revenue mismatch", () => {
    const problems = checkPnlMonth(augustLike(), { ...reference, totalRevenue: 17_681_000 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("revenue");
  });

  it("names a cost-of-goods mismatch", () => {
    const problems = checkPnlMonth(augustLike(), { ...reference, totalCOGS: 46_418_991 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("totalCOGS");
  });

  it("names a line whose sources do not add up to it", () => {
    const month = augustLike();
    month.sources.cogs.pop();
    const problems = checkPnlMonth(month, reference);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("cogs");
  });
});
```

Chạy `npx vitest run scripts/verify-pnl-monthly-core.test.ts`, thấy đỏ vì **thiếu module**.

- [ ] **Bước 8: Viết phép so**

Tạo `scripts/verify-pnl-monthly-core.ts`:

```ts
import { displayMoney } from "@/lib/reports/display-rounding";
import type { PnlMonthFigures, PnlSource } from "@/lib/reports/profit-and-loss";

// Pure: no I/O. scripts/verify-pnl-monthly.ts fetches and prints.
// docs/superpowers/plans/2026-09-11-bao-cao-lai-lo.md Mục 3.

export interface PnlReference {
  totalRevenue: number;     // getPnLDataV2(month).totalRevenue
  totalCOGS: number;        // getPnLDataV2(month).totalCOGS, already displayMoney-rounded
  shrinkageValue: number;   // getPnLDataV2(month).shrinkageValue, already rounded
}

const TOLERANCE = 0.01;
const sum = (xs: PnlSource[]) => xs.reduce((a, s) => a + s.amountExact, 0);

export function checkPnlMonth(month: PnlMonthFigures, reference: PnlReference): string[] {
  const problems: string[] = [];
  const m = month.month;

  if (Math.abs(month.posRevenue - reference.totalRevenue) > TOLERANCE) {
    problems.push(`${m}: POS revenue ${month.posRevenue} != getPnLDataV2 totalRevenue ${reference.totalRevenue}`);
  }
  const cogsPlusShrinkage = displayMoney(month.cogsExact + month.shrinkageExact);
  if (cogsPlusShrinkage !== reference.totalCOGS) {
    problems.push(`${m}: Giá vốn + Hao hụt ${cogsPlusShrinkage} != getPnLDataV2 totalCOGS ${reference.totalCOGS}`);
  }
  if (displayMoney(month.shrinkageExact) !== reference.shrinkageValue) {
    problems.push(`${m}: Hao hụt ${displayMoney(month.shrinkageExact)} != getPnLDataV2 shrinkageValue ${reference.shrinkageValue}`);
  }

  const lines: Array<[string, number, PnlSource[]]> = [
    ["manualRevenue", month.manualRevenue, month.sources.manualRevenue],
    ["cogs", month.cogsExact, month.sources.cogs],
    ["shrinkage", month.shrinkageExact, month.sources.shrinkage],
    ["nonInventory", month.nonInventoryExact, month.sources.nonInventory],
    ["otherIncome", month.otherIncome, month.sources.otherIncome],
    ["depreciation", month.depreciationExact, month.sources.depreciation],
  ];
  const categoryIds = new Set([...Object.keys(month.expenseByCategory), ...Object.keys(month.sources.expense)]);
  for (const id of categoryIds) {
    lines.push([`expense ${id}`, month.expenseByCategory[id] ?? 0, month.sources.expense[id] ?? []]);
  }
  for (const [name, figure, sources] of lines) {
    if (Math.abs(sum(sources) - figure) > TOLERANCE) {
      problems.push(`${m}: ${name} sources add to ${sum(sources)}, line says ${figure}`);
    }
  }
  return problems;
}
```

Chạy lại, thấy xanh.

- [ ] **Bước 9: Script chạy trên dữ liệu thật**

Tạo `scripts/verify-pnl-monthly.ts` (chỉ đọc, tiền tố `verify-`):

```ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Read-only. For every month of every year the P&L page offers:
//   - POS revenue equals getPnLDataV2(month).totalRevenue;
//   - Giá vốn + Hao hụt equals getPnLDataV2(month).totalCOGS;
//   - every line's sources add up to the line.
// docs/superpowers/plans/2026-09-11-bao-cao-lai-lo.md Mục 3.

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

async function main(): Promise<void> {
  const { getProfitAndLossReport } = await import("@/app/admin/reports/pnl/actions");
  const { getPnLDataV2 } = await import("@/app/admin/reports/actions");
  const { checkPnlMonth } = await import("./verify-pnl-monthly-core");

  const { availableYears } = await getProfitAndLossReport();
  const problems: string[] = [];
  let monthsChecked = 0;

  for (const year of availableYears) {
    const { figures } = await getProfitAndLossReport(year);
    console.log(`\n== ${year} ==`);
    console.log("month   | POS revenue | ghi tay | Giá vốn | NL dùng ngay | Hao hụt | Chi phí | Khấu hao | Thu khác");
    for (const month of figures.months) {
      const ref = await getPnLDataV2({ startDate: `${month.month}-01`, endDate: lastDayOfMonth(month.month) });
      problems.push(...checkPnlMonth(month, ref));
      monthsChecked++;
      const expenses = Object.values(month.expenseByCategory).reduce((a, b) => a + b, 0);
      console.log(
        `${month.month} | ${fmt(month.posRevenue)} | ${fmt(month.manualRevenue)} | ${fmt(month.cogsExact)} | ` +
        `${fmt(month.nonInventoryExact)} | ${fmt(month.shrinkageExact)} | ${fmt(expenses)} | ` +
        `${fmt(month.depreciationExact)} | ${fmt(month.otherIncome)}`,
      );
    }
  }

  if (problems.length > 0) {
    console.log(`\nVERIFY-PNL-MONTHLY FAILED -- ${problems.length} mismatch(es) across ${monthsChecked} month(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n0 mismatches across ${monthsChecked} month(s).`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
```

Chạy: `npx vite-node scripts/verify-pnl-monthly.ts`
Mong đợi: "0 mismatches across 7 month(s)." (tháng 3 đến tháng 9/2026). Chép nguyên
bảng in ra vào báo cáo của mục. **Nếu có lệch thì dừng và báo lại**, không sửa code
cho khớp khi chưa hiểu vì sao lệch.

- [ ] **Bước 10: Hai câu tài liệu và một câu in ra đã cũ**

`docs/02-rules/business-rules/cogs.md`:
- Câu Mục 1 đã viết "Not yet reached by the expense line itself — the P&L page (…) is
  what makes this column feed money." đổi thành
  "It feeds the Nguyên liệu mua dùng ngay line of the P&L (`lib/reports/profit-and-loss.ts`) from 2026-09-11, each flagged line at its paid share (`BR-COGS-006`)."
- Trong đoạn "An item bought for immediate use never enters Giá vốn…", đổi "and the P&L
  page once built" thành "and the P&L (`lib/reports/profit-and-loss.ts`)".
- Dòng `**Not yet consumed anywhere.**` của `BR-COGS-008` đổi thành:
  `**Consumed by the P&L.** From 2026-09-11 the monthly charge feeds the Khấu hao line (`lib/reports/profit-and-loss.ts`), every asset except `INACTIVE` ones, the current month charged in full.`

`scripts/verify-cogs.ts` dòng 219–220: đổi "No screen reads those two fields yet -- there
is no P&L page (folded into the future financial-reports work, owner decision
2026-09-08); this script does not gate them." thành "This script does not gate them;
scripts/verify-pnl-monthly.ts checks the split month by month against the P&L."

- [ ] **Bước 11: Kiểm toàn bộ và lưu**

```bash
npx tsc --noEmit
npx vitest run
npx vite-node scripts/verify-cogs.ts
npx vite-node scripts/verify-pnl-monthly.ts
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
git checkout -- docs/generated/system-map.md
git add lib/reports/profit-and-loss.ts lib/reports/profit-and-loss.test.ts \
  app/admin/reports/pnl/actions.ts app/admin/reports/pnl/actions.test.ts \
  scripts/verify-pnl-monthly-core.ts scripts/verify-pnl-monthly-core.test.ts \
  scripts/verify-pnl-monthly.ts scripts/verify-cogs.ts \
  docs/02-rules/business-rules/cogs.md
git commit -m "feat(reports): monthly profit-and-loss figures, checked against getPnLDataV2 (BR-PNL-001)"
```

**Opus soát sau mục này:** so bảng `verify-pnl-monthly` in ra với bảng "Ví dụ bằng số
thật" ở cuối kế hoạch, từng ô.

## Mục 4 — Làm tròn và dựng bảng hiển thị

Module thuần, không đọc dữ liệu. Nhận số chính xác của Mục 3, trả ra đúng thứ màn
hình vẽ: số đã làm tròn, nhãn tháng, phép tính của từng ô lợi nhuận, các khoản làm
nên từng ô, bốn ô tóm tắt, điểm biểu đồ, ghi chú dưới bảng. Mọi chỗ làm tròn của
trang nằm ở đây và chỉ ở đây (`BR-DATA-005`): mỗi ô, mỗi ô Tổng, mỗi ô lợi nhuận làm
tròn từ số chính xác của chính nó, không cộng các ô đã làm tròn.

**File:**
- Tạo: `lib/reports/profit-and-loss-table.ts`, test `lib/reports/profit-and-loss-table.test.ts`
- Sửa: `app/admin/reports/pnl/actions.ts` và `actions.test.ts` (trả thêm `table`)
- Sửa: `docs/02-rules/business-rules/profit-and-loss.md` (một đoạn về làm tròn)

**Giao diện:**
- Cần từ mục trước: `PnlFigures`, `PnlMonthFigures`, `PnlSource`, `PnlSourceKind`
  (Mục 3); `displayMoney` (Mục 0); `formatNumber` (`lib/shared/format.ts`).
- Đưa ra cho mục sau, đúng tên:

```ts
export const PERCENT_DECIMALS = 2;

export type PnlRowKind =
  | "revenue" | "detail" | "cost" | "subtotal" | "expense" | "income" | "net" | "margin" | "cumulative";

export interface PnlCellSource {
  kind: PnlSourceKind | "POS";
  id: string | null;       // null for the POS line
  date: string | null;     // "DD/MM/YYYY"; null when the source has no single date
  label: string;
  ref: string | null;      // purchase order id for a PO line
  amount: number;          // rounded for display
}

export interface PnlCell {
  month: string;             // "YYYY-MM"
  value: number | null;      // null: cannot be computed (margin of a month with no revenue)
  sources: PnlCellSource[];
  formula: string | null;    // profit rows only
}

export interface PnlRow {
  key: string;               // "revenue", "revenueManual", "cogs", "nonInventory", "shrinkage",
                             // "grossProfit", "expense:<category id>", "depreciation",
                             // "otherIncome", "netProfit", "margin", "cumulative"
  label: string;
  kind: PnlRowKind;
  unit: "money" | "percent";
  cells: PnlCell[];
  total: number | null;
  shareOfRevenue: number | null;
}

export interface PnlMonthColumn { month: string; label: string; shortLabel: string }
export interface PnlSummaryMonth { month: string; label: string; netProfit: number }

export interface PnlTable {
  year: number;
  months: PnlMonthColumn[];
  periodLabel: "từ đầu năm" | "cả năm";
  rows: PnlRow[];
  summary: {
    revenue: number;
    netProfit: number;
    margin: number | null;
    bestMonth: PnlSummaryMonth | null;   // highest net profit above 0
    worstMonth: PnlSummaryMonth | null;  // lowest net profit below 0
  };
  chart: Array<{ month: string; shortLabel: string; netProfit: number; cumulative: number }>;
  footnotes: Array<{ key: string; text: string }>;
}

export function formatPercent(value: number | null): string;
export function buildPnlTable(figures: PnlFigures, today: string): PnlTable;  // today "YYYY-MM-DD" Saigon

// app/admin/reports/pnl/actions.ts, widened:
export interface ProfitAndLossReport { availableYears: number[]; figures: PnlFigures; table: PnlTable }
```

Một ô bấm được khi `sources.length > 0` hoặc `formula !== null`. Mục 5 và Mục 6 đọc
đúng điều này, không tự suy thêm.

- [ ] **Bước 1: Test đỏ cho module**

Tạo `lib/reports/profit-and-loss-table.test.ts`. Tháng 8/2026 lấy đúng số chính xác
đo trên máy chủ thật ngày 2026-09-11 (bảng "Ví dụ bằng số thật" cuối kế hoạch). Dấu
trừ trong phép tính là ký tự `−` (U+2212); số âm giữ dấu `-` của `formatNumber`.
Chép nguyên, đừng gõ lại.

```ts
import { describe, expect, it } from "vitest";
import { PERCENT_DECIMALS, buildPnlTable, formatPercent, type PnlRow, type PnlTable } from "./profit-and-loss-table";
import type { PnlFigures, PnlMonthFigures } from "./profit-and-loss";

function monthFigures(month: string, overrides: Partial<PnlMonthFigures> = {}): PnlMonthFigures {
  return {
    month,
    posRevenue: 0, posOrderCount: 0, posRevenueBeforePayments: 0, manualRevenue: 0,
    cogsExact: 0, shrinkageExact: 0, nonInventoryExact: 0,
    expenseByCategory: {}, otherIncome: 0, depreciationExact: 0,
    ...overrides,
    sources: {
      manualRevenue: [], cogs: [], shrinkage: [], nonInventory: [], expense: {}, otherIncome: [], depreciation: [],
      ...overrides.sources,
    },
  };
}
function figures(months: PnlMonthFigures[], extra: Partial<PnlFigures> = {}): PnlFigures {
  return { year: 2026, months, expenseCategories: [], firstPaymentDate: "2026-07-20", ...extra };
}
function row(t: PnlTable, key: string): PnlRow {
  const found = t.rows.find(r => r.key === key);
  if (!found) throw new Error(`row ${key} not in table`);
  return found;
}
const values = (t: PnlTable, key: string) => row(t, key).cells.map(c => c.value);

const CATEGORIES = [
  { id: "CFC-001", name: "Vận hành" },
  { id: "CFC-002", name: "Điện, nước, gas" },
];

// August 2026, exact, as measured on the real server on 2026-09-11. Sources
// are trimmed to what the assertions read: this module shows sources, it
// does not add them up (scripts/verify-pnl-monthly.ts does).
function august(): PnlMonthFigures {
  return monthFigures("2026-08", {
    posRevenue: 17_682_000, posOrderCount: 644,
    cogsExact: 46_418_989.77485121,
    nonInventoryExact: 1_760_000,
    expenseByCategory: { "CFC-001": 615_000, "CFC-002": 470_000 },
    depreciationExact: 790_974.0694444443,
    sources: {
      manualRevenue: [], shrinkage: [], otherIncome: [], depreciation: [],
      cogs: [
        { kind: "STOCKTAKE", id: "STK-001", date: "2026-08-09", label: "Kiểm kê định kỳ", ref: null, amountExact: 34_864_626.83216999 },
      ],
      nonInventory: [
        { kind: "PO_LINE", id: "POL-d0228874-66d6-4e78-bef1-059b39ca423d", date: "2026-08-30", label: "Đá viên", ref: "PO-175", amountExact: 980_000 },
      ],
      expense: {
        "CFC-001": [
          { kind: "CASH_ENTRY", id: "CE-023", date: "2026-08-02", label: "Dán lại xe Phin Đi", ref: null, amountExact: 300_000 },
          { kind: "CASH_ENTRY", id: "CE-025", date: "2026-08-26", label: "Photo giấy bán khoai trứng", ref: null, amountExact: 35_000 },
          { kind: "CASH_ENTRY", id: "CE-029", date: "2026-08-31", label: "Phin Đi - Gửi xe", ref: null, amountExact: 130_000 },
          { kind: "CASH_ENTRY", id: "CE-030", date: "2026-08-31", label: "Uchako - Gửi xe", ref: null, amountExact: 150_000 },
        ],
        "CFC-002": [
          { kind: "CASH_ENTRY", id: "CE-026", date: "2026-08-31", label: "Tiền gas", ref: null, amountExact: 250_000 },
          { kind: "CASH_ENTRY", id: "CE-027", date: "2026-08-31", label: "Tiền điện", ref: null, amountExact: 150_000 },
          { kind: "CASH_ENTRY", id: "CE-028", date: "2026-08-31", label: "Tiền nước sinh hoạt", ref: null, amountExact: 70_000 },
        ],
      },
    },
  });
}
const augustTable = () => buildPnlTable(figures([august()], { expenseCategories: CATEGORIES }), "2026-09-11");

describe("August 2026, real figures", () => {
  it("rounds each cell from its own exact value and computes profit from exact values", () => {
    const t = augustTable();
    expect(t.months).toEqual([{ month: "2026-08", label: "08/2026", shortLabel: "08" }]);
    expect(values(t, "revenue")).toEqual([17_682_000]);
    expect(values(t, "cogs")).toEqual([46_418_990]);
    expect(values(t, "nonInventory")).toEqual([1_760_000]);
    expect(values(t, "grossProfit")).toEqual([-30_496_990]);
    expect(values(t, "expense:CFC-001")).toEqual([615_000]);
    expect(values(t, "expense:CFC-002")).toEqual([470_000]);
    expect(values(t, "depreciation")).toEqual([790_974]);
    expect(values(t, "netProfit")).toEqual([-32_372_964]);
    expect(values(t, "margin")).toEqual([-183.08]);
    expect(values(t, "cumulative")).toEqual([-32_372_964]);
  });

  it("says how each profit cell was reached, in the numbers on screen", () => {
    const t = augustTable();
    expect(row(t, "grossProfit").cells[0].formula).toBe(
      "Doanh thu 17.682.000 − giá vốn 46.418.990 − nguyên liệu mua dùng ngay 1.760.000 = -30.496.990",
    );
    expect(row(t, "netProfit").cells[0].formula).toBe(
      "Lợi nhuận gộp -30.496.990 − chi phí 1.085.000 − khấu hao 790.974 = -32.372.964",
    );
    expect(row(t, "margin").cells[0].formula).toBe("Lợi nhuận ròng -32.372.964 ÷ doanh thu 17.682.000");
    expect(row(t, "cumulative").cells[0].formula).toBe(
      "Tháng đầu tiên có số của năm: bằng lợi nhuận ròng tháng này -32.372.964",
    );
    expect(row(t, "netProfit").cells[0].sources).toEqual([]);
  });

  it("lists what makes up a cell, rounded, with dates written the Vietnamese way", () => {
    const t = augustTable();
    expect(row(t, "revenue").cells[0].sources).toEqual([
      { kind: "POS", id: null, date: null, label: "644 đơn máy bán hàng", ref: null, amount: 17_682_000 },
    ]);
    expect(row(t, "expense:CFC-001").cells[0].sources.map(s => [s.date, s.label, s.amount])).toEqual([
      ["02/08/2026", "Dán lại xe Phin Đi", 300_000],
      ["26/08/2026", "Photo giấy bán khoai trứng", 35_000],
      ["31/08/2026", "Phin Đi - Gửi xe", 130_000],
      ["31/08/2026", "Uchako - Gửi xe", 150_000],
    ]);
    expect(row(t, "cogs").cells[0].sources[0]).toMatchObject({ kind: "STOCKTAKE", id: "STK-001", date: "09/08/2026", amount: 34_864_627 });
    expect(row(t, "nonInventory").cells[0].sources[0]).toMatchObject({ label: "Đá viên", ref: "PO-175", amount: 980_000 });
  });

  it("totals and share of revenue come from exact values", () => {
    const t = augustTable();
    expect(row(t, "cogs").total).toBe(46_418_990);
    expect(row(t, "cogs").shareOfRevenue).toBe(262.52); // 46.418.989,77 ÷ 17.682.000 = 262,521%
    expect(row(t, "revenue").shareOfRevenue).toBe(100);
    expect(row(t, "margin").total).toBe(-183.08);
    expect(row(t, "margin").shareOfRevenue).toBeNull();
    expect(row(t, "cumulative").total).toBeNull();
  });

  it("notes the stocktake inside cost of goods, and says nothing about rounding because nothing differs", () => {
    expect(augustTable().footnotes).toEqual([
      {
        key: "stocktake-STK-001-2026-08",
        text: "Giá vốn tháng 08/2026 có 34.864.627đ từ lần kiểm kho ngày 09/08/2026: hàng đã dùng mà chưa ghi phiếu xuất, không tính là hao hụt.",
      },
    ]);
  });
});

describe("rounding (BR-DATA-005)", () => {
  it("three months of 100,4 show 100 each and a total of 301, and the page says why", () => {
    const months = ["2025-01", "2025-02", "2025-03"].map(m => monthFigures(m, { depreciationExact: 100.4 }));
    const t = buildPnlTable(figures(months, { year: 2025 }), "2026-09-11");
    expect(values(t, "depreciation")).toEqual([100, 100, 100]);
    expect(row(t, "depreciation").total).toBe(301);
    expect(values(t, "netProfit")).toEqual([-100, -100, -100]);
    expect(row(t, "netProfit").total).toBe(-301);
    expect(values(t, "cumulative")).toEqual([-100, -201, -301]);
    expect(row(t, "cumulative").cells[1].formula).toBe(
      "Cộng dồn tháng trước -100 + lợi nhuận ròng tháng này -100 = -201",
    );
    expect(t.footnotes.map(f => f.key)).toEqual(["rounding"]);
    expect(t.footnotes[0].text).toContain("luật ngày 11/09/2026");
  });

  it("shows a percentage with two decimals (owner, 11/09/2026)", () => {
    expect(PERCENT_DECIMALS).toBe(2);
    expect(formatPercent(-183.08)).toBe("-183,08%");
    expect(formatPercent(13.8)).toBe("13,80%");
    expect(formatPercent(100)).toBe("100,00%");
    expect(formatPercent(null)).toBe("---");
  });
});

describe("which rows show", () => {
  it("leaves out the hand-recorded, shrinkage and other-income rows when the year has none", () => {
    expect(augustTable().rows.map(r => r.key)).toEqual([
      "revenue", "cogs", "nonInventory", "grossProfit", "expense:CFC-001", "expense:CFC-002",
      "depreciation", "netProfit", "margin", "cumulative",
    ]);
  });

  it("shows them, and folds them into profit, when the year has them", () => {
    const april = monthFigures("2026-04", {
      posRevenue: 2_190_000, posOrderCount: 53, manualRevenue: 8_411_868, shrinkageExact: 1_000, otherIncome: 200_000,
      sources: {
        manualRevenue: [
          { kind: "CASH_ENTRY", id: "CE-033", date: "2026-04-30", label: "Không có ghi chú", ref: null, amountExact: 5_000_000 },
          { kind: "CASH_ENTRY", id: "CE-034", date: "2026-04-30", label: "Không có ghi chú", ref: null, amountExact: 3_411_868 },
        ],
      } as PnlMonthFigures["sources"],
    });
    const t = buildPnlTable(figures([april]), "2026-09-11");
    expect(t.rows.map(r => r.key)).toEqual([
      "revenue", "revenueManual", "cogs", "nonInventory", "shrinkage", "grossProfit",
      "depreciation", "otherIncome", "netProfit", "margin", "cumulative",
    ]);
    expect(values(t, "revenue")).toEqual([10_601_868]);
    expect(row(t, "revenueManual").label).toBe("· trong đó ghi tay");
    expect(row(t, "revenue").cells[0].sources.map(s => s.label)).toEqual([
      "53 đơn máy bán hàng", "Không có ghi chú", "Không có ghi chú",
    ]);
    expect(row(t, "grossProfit").cells[0].formula).toBe(
      "Doanh thu 10.601.868 − giá vốn 0 − nguyên liệu mua dùng ngay 0 − hao hụt 1.000 = 10.600.868",
    );
    expect(row(t, "netProfit").cells[0].formula).toBe(
      "Lợi nhuận gộp 10.600.868 − chi phí 0 − khấu hao 0 + thu khác 200.000 = 10.800.868",
    );
    expect(t.footnotes).toContainEqual({
      key: "manual-2026-04",
      text: "Doanh thu tháng 04/2026 có 8.411.868đ ghi tay trong sổ thu chi, không qua máy bán hàng.",
    });
  });
});

describe("month labels", () => {
  it("marks the month still running with the day the figures reach", () => {
    const september = monthFigures("2026-09", { posRevenue: 5_054_000, posOrderCount: 213 });
    const t = buildPnlTable(figures([august(), september], { expenseCategories: CATEGORIES }), "2026-09-11");
    expect(t.months.map(m => m.label)).toEqual(["08/2026", "09/2026 (đến 11/09)"]);
    expect(t.periodLabel).toBe("từ đầu năm");
    const past = buildPnlTable(figures([monthFigures("2025-12", { depreciationExact: 1 })], { year: 2025 }), "2026-09-11");
    expect(past.periodLabel).toBe("cả năm");
  });
});

describe("summary and chart", () => {
  it("picks the best and the worst month from exact net profit", () => {
    const t = buildPnlTable(figures([
      monthFigures("2026-05", { posRevenue: 7_675_000, posOrderCount: 302 }),
      august(),
      monthFigures("2026-09", { posRevenue: 5_054_000, posOrderCount: 213 }),
    ], { expenseCategories: CATEGORIES }), "2026-09-11");
    expect(t.summary.revenue).toBe(30_411_000);
    // 7.675.000 − 32.372.963,84 + 5.054.000
    expect(t.summary.netProfit).toBe(-19_643_964);
    expect(t.summary.bestMonth).toEqual({ month: "2026-05", label: "05/2026", netProfit: 7_675_000 });
    expect(t.summary.worstMonth).toEqual({ month: "2026-08", label: "08/2026", netProfit: -32_372_964 });
    expect(t.chart).toEqual([
      { month: "2026-05", shortLabel: "05", netProfit: 7_675_000, cumulative: 7_675_000 },
      { month: "2026-08", shortLabel: "08", netProfit: -32_372_964, cumulative: -24_697_964 },
      { month: "2026-09", shortLabel: "09", netProfit: 5_054_000, cumulative: -19_643_964 },
    ]);
  });

  it("has no worst month when no month lost money", () => {
    const t = buildPnlTable(figures([monthFigures("2026-05", { posRevenue: 7_675_000, posOrderCount: 302 })]), "2026-09-11");
    expect(t.summary.worstMonth).toBeNull();
  });

  it("leaves margin empty for a month with no revenue", () => {
    const t = buildPnlTable(figures([monthFigures("2026-03", { depreciationExact: 49_225.708333333336 })]), "2026-09-11");
    expect(values(t, "margin")).toEqual([null]);
    expect(row(t, "margin").cells[0].formula).toBe("Tháng này chưa có doanh thu, nên không tính được biên lợi nhuận.");
    expect(row(t, "margin").total).toBeNull();
    expect(values(t, "netProfit")).toEqual([-49_226]);
    expect(t.summary.margin).toBeNull();
  });

  it("an empty year gives an empty table", () => {
    const t = buildPnlTable(figures([]), "2026-09-11");
    expect(t.months).toEqual([]);
    expect(t.chart).toEqual([]);
    expect(t.footnotes).toEqual([]);
    expect(t.summary).toEqual({ revenue: 0, netProfit: 0, margin: null, bestMonth: null, worstMonth: null });
  });
});

describe("BR-SALE-005 footnote", () => {
  it("names the months with sales from before the first payment record", () => {
    const t = buildPnlTable(figures([
      monthFigures("2026-06", { posRevenue: 22_157_000, posOrderCount: 793, posRevenueBeforePayments: 22_157_000 }),
      monthFigures("2026-07", { posRevenue: 18_661_000, posOrderCount: 664, posRevenueBeforePayments: 12_215_000 }),
      monthFigures("2026-08", { posRevenue: 17_682_000, posOrderCount: 644 }),
    ]), "2026-09-11");
    expect(t.footnotes).toContainEqual({
      key: "before-payments",
      text: "Doanh thu tháng 06/2026, 07/2026 có phần bán trước ngày 20/07/2026, ngày bắt đầu có sổ tiền nhận, nên phần đó không có sổ tiền để đối chiếu.",
    });
  });
});
```

- [ ] **Bước 2: Chạy, thấy đỏ**

Chạy: `npx vitest run lib/reports/profit-and-loss-table.test.ts`
Mong đợi: đỏ vì **thiếu module**.

- [ ] **Bước 3: Viết module**

Tạo `lib/reports/profit-and-loss-table.ts`. Dán nguyên phần kiểu ở "Giao diện" phía
trên (trừ hai dòng của `actions.ts`), rồi:

```ts
import { formatNumber } from "@/lib/shared/format";
import { displayMoney } from "./display-rounding";
import type { PnlFigures, PnlSource, PnlSourceKind } from "./profit-and-loss";

// Display layer of the monthly P&L
// (docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md).
// lib/reports/profit-and-loss.ts keeps every figure exact; this module is
// the only place the page rounds (BR-DATA-005). Each cell, each total and
// each profit is rounded from its own exact value -- never summed from
// rounded cells -- so a hand-added row can differ from its total by a đồng
// or two, and the page then says so in a footnote.

// Decimals kept on a percentage: two, owner decision 2026-09-11 (BR-DATA-005).
export const PERCENT_DECIMALS = 2;

const NEAR_ZERO = 0.005;
const MINUS = "−"; // U+2212, the operator in a formula; a negative number keeps formatNumber's "-"

const ROUNDING_NOTE =
  "Mỗi ô làm tròn riêng về đồng từ số thật của nó (luật ngày 11/09/2026). Ô Tổng và các ô lợi nhuận cũng làm tròn từ số thật, không cộng từ các ô đã làm tròn, nên cộng tay có thể lệch một, hai đồng.";

const PERCENT_FORMATTER = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: PERCENT_DECIMALS,
  maximumFractionDigits: PERCENT_DECIMALS,
});

export function formatPercent(value: number | null): string {
  return value === null ? "---" : `${PERCENT_FORMATTER.format(value)}%`;
}

// Same snapping as display-rounding.ts, at PERCENT_DECIMALS places.
function roundPercent(exact: number): number {
  const factor = 10 ** PERCENT_DECIMALS;
  const snapped = Math.round(Math.abs(exact) * factor * 1e6) / 1e6;
  const rounded = (Math.sign(exact) * Math.round(snapped)) / factor;
  return rounded === 0 ? 0 : rounded;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const money = (exact: number) => formatNumber(displayMoney(exact));
const anyNonZero = (xs: number[]) => xs.some(x => Math.abs(x) > NEAR_ZERO);

function dateLabel(date: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function monthLabel(month: string): string {
  return `${month.slice(5, 7)}/${month.slice(0, 4)}`;
}

function toCellSource(s: PnlSource): PnlCellSource {
  return { kind: s.kind, id: s.id, date: dateLabel(s.date), label: s.label, ref: s.ref, amount: displayMoney(s.amountExact) };
}

export function buildPnlTable(figures: PnlFigures, today: string): PnlTable {
  const months = figures.months;
  const currentMonth = today.slice(0, 7);

  // Exact per-month figures. Profit comes from these, never from rounded cells.
  const exact = months.map(m => {
    const revenue = m.posRevenue + m.manualRevenue;
    const gross = revenue - m.cogsExact - m.nonInventoryExact - m.shrinkageExact;
    const expenses = sum(Object.values(m.expenseByCategory));
    const net = gross - expenses - m.depreciationExact + m.otherIncome;
    return { revenue, gross, expenses, net };
  });
  let running = 0;
  const cumulative = exact.map(e => (running += e.net));
  const yearRevenue = sum(exact.map(e => e.revenue));
  const yearNet = sum(exact.map(e => e.net));
  const hasRevenue = (x: number) => Math.abs(x) > NEAR_ZERO;

  function moneyRow(
    key: string,
    label: string,
    kind: PnlRowKind,
    exactValues: number[],
    sourcesOf: (i: number) => PnlCellSource[],
    formulaOf: (i: number) => string | null = () => null,
  ): PnlRow {
    const exactTotal = sum(exactValues);
    return {
      key, label, kind, unit: "money",
      cells: months.map((m, i) => ({ month: m.month, value: displayMoney(exactValues[i]), sources: sourcesOf(i), formula: formulaOf(i) })),
      total: displayMoney(exactTotal),
      shareOfRevenue: hasRevenue(yearRevenue) ? roundPercent((exactTotal / yearRevenue) * 100) : null,
    };
  }
  const noSources = () => [];

  const manual = months.map(m => m.manualRevenue);
  const shrinkage = months.map(m => m.shrinkageExact);
  const otherIncome = months.map(m => m.otherIncome);
  const showShrinkage = anyNonZero(shrinkage);
  const showOtherIncome = anyNonZero(otherIncome);

  const rows: PnlRow[] = [];
  rows.push(moneyRow("revenue", "Doanh thu", "revenue", exact.map(e => e.revenue), i => {
    const m = months[i];
    const pos: PnlCellSource[] = m.posOrderCount > 0
      ? [{ kind: "POS", id: null, date: null, label: `${formatNumber(m.posOrderCount)} đơn máy bán hàng`, ref: null, amount: displayMoney(m.posRevenue) }]
      : [];
    return [...pos, ...m.sources.manualRevenue.map(toCellSource)];
  }));
  if (anyNonZero(manual)) {
    rows.push(moneyRow("revenueManual", "· trong đó ghi tay", "detail", manual, i => months[i].sources.manualRevenue.map(toCellSource)));
  }
  rows.push(moneyRow("cogs", "Giá vốn", "cost", months.map(m => m.cogsExact), i => months[i].sources.cogs.map(toCellSource)));
  rows.push(moneyRow("nonInventory", "Nguyên liệu mua dùng ngay", "cost", months.map(m => m.nonInventoryExact), i => months[i].sources.nonInventory.map(toCellSource)));
  if (showShrinkage) {
    rows.push(moneyRow("shrinkage", "Hao hụt", "cost", shrinkage, i => months[i].sources.shrinkage.map(toCellSource)));
  }
  rows.push(moneyRow("grossProfit", "Lợi nhuận gộp", "subtotal", exact.map(e => e.gross), noSources, i => {
    const m = months[i];
    const parts = [`Doanh thu ${money(exact[i].revenue)}`, `giá vốn ${money(m.cogsExact)}`, `nguyên liệu mua dùng ngay ${money(m.nonInventoryExact)}`];
    if (showShrinkage) parts.push(`hao hụt ${money(m.shrinkageExact)}`);
    return `${parts.join(` ${MINUS} `)} = ${money(exact[i].gross)}`;
  }));
  for (const category of figures.expenseCategories) {
    rows.push(moneyRow(
      `expense:${category.id}`, category.name, "expense",
      months.map(m => m.expenseByCategory[category.id] ?? 0),
      i => (months[i].sources.expense[category.id] ?? []).map(toCellSource),
    ));
  }
  rows.push(moneyRow("depreciation", "Khấu hao", "expense", months.map(m => m.depreciationExact), i => months[i].sources.depreciation.map(toCellSource)));
  if (showOtherIncome) {
    rows.push(moneyRow("otherIncome", "Thu khác", "income", otherIncome, i => months[i].sources.otherIncome.map(toCellSource)));
  }
  rows.push(moneyRow("netProfit", "Lợi nhuận ròng", "net", exact.map(e => e.net), noSources, i => {
    let text = `Lợi nhuận gộp ${money(exact[i].gross)} ${MINUS} chi phí ${money(exact[i].expenses)} ${MINUS} khấu hao ${money(months[i].depreciationExact)}`;
    if (showOtherIncome) text += ` + thu khác ${money(months[i].otherIncome)}`;
    return `${text} = ${money(exact[i].net)}`;
  }));
  rows.push({
    key: "margin", label: "Biên lợi nhuận", kind: "margin", unit: "percent",
    cells: months.map((m, i) => hasRevenue(exact[i].revenue)
      ? {
          month: m.month,
          value: roundPercent((exact[i].net / exact[i].revenue) * 100),
          sources: [],
          formula: `Lợi nhuận ròng ${money(exact[i].net)} ÷ doanh thu ${money(exact[i].revenue)}`,
        }
      : { month: m.month, value: null, sources: [], formula: "Tháng này chưa có doanh thu, nên không tính được biên lợi nhuận." }),
    total: hasRevenue(yearRevenue) ? roundPercent((yearNet / yearRevenue) * 100) : null,
    shareOfRevenue: null,
  });
  rows.push({
    key: "cumulative", label: "Cộng dồn từ đầu năm", kind: "cumulative", unit: "money",
    cells: months.map((m, i) => ({
      month: m.month,
      value: displayMoney(cumulative[i]),
      sources: [],
      formula: i === 0
        ? `Tháng đầu tiên có số của năm: bằng lợi nhuận ròng tháng này ${money(exact[0].net)}`
        : `Cộng dồn tháng trước ${money(cumulative[i - 1])} + lợi nhuận ròng tháng này ${money(exact[i].net)} = ${money(cumulative[i])}`,
    })),
    total: null,
    shareOfRevenue: null,
  });

  // Does adding shown numbers by hand ever miss a shown result? Then say why.
  const shown = (key: string) => rows.find(r => r.key === key)?.cells.map(c => c.value ?? 0) ?? months.map(() => 0);
  let roundingGap = rows.some(r => r.unit === "money" && r.total !== null && sum(r.cells.map(c => c.value ?? 0)) !== r.total);
  const [rev, cogs, nonInv, shr, gross, dep, oth, net, cum] =
    ["revenue", "cogs", "nonInventory", "shrinkage", "grossProfit", "depreciation", "otherIncome", "netProfit", "cumulative"].map(shown);
  months.forEach((_, i) => {
    if (rev[i] - cogs[i] - nonInv[i] - shr[i] !== gross[i]) roundingGap = true;
    if (gross[i] - displayMoney(exact[i].expenses) - dep[i] + oth[i] !== net[i]) roundingGap = true;
    if (i > 0 && cum[i - 1] + net[i] !== cum[i]) roundingGap = true;
  });

  const footnotes: Array<{ key: string; text: string }> = [];
  for (const m of months) {
    if (Math.abs(m.manualRevenue) > NEAR_ZERO) {
      footnotes.push({
        key: `manual-${m.month}`,
        text: `Doanh thu tháng ${monthLabel(m.month)} có ${money(m.manualRevenue)}đ ghi tay trong sổ thu chi, không qua máy bán hàng.`,
      });
    }
  }
  for (const m of months) {
    for (const s of m.sources.cogs) {
      if (s.kind !== "STOCKTAKE") continue;
      footnotes.push({
        key: `stocktake-${s.id}-${m.month}`,
        text: `Giá vốn tháng ${monthLabel(m.month)} có ${money(s.amountExact)}đ từ lần kiểm kho ngày ${dateLabel(s.date)}: hàng đã dùng mà chưa ghi phiếu xuất, không tính là hao hụt.`,
      });
    }
  }
  // BR-SALE-005: before the first payment record, revenue can only be checked against itself.
  const unchecked = months.filter(m => Math.abs(m.posRevenueBeforePayments) > NEAR_ZERO).map(m => monthLabel(m.month));
  if (unchecked.length > 0) {
    footnotes.push({
      key: "before-payments",
      text: figures.firstPaymentDate
        ? `Doanh thu tháng ${unchecked.join(", ")} có phần bán trước ngày ${dateLabel(figures.firstPaymentDate)}, ngày bắt đầu có sổ tiền nhận, nên phần đó không có sổ tiền để đối chiếu.`
        : `Chưa có sổ tiền nhận nào, nên doanh thu tháng ${unchecked.join(", ")} chưa đối chiếu được với tiền đã nhận.`,
    });
  }
  if (roundingGap) footnotes.push({ key: "rounding", text: ROUNDING_NOTE });

  const netByMonth = months.map((m, i) => ({ month: m.month, label: monthLabel(m.month), exact: exact[i].net }));
  const best = netByMonth.filter(x => x.exact > NEAR_ZERO).sort((a, b) => b.exact - a.exact)[0];
  const worst = netByMonth.filter(x => x.exact < -NEAR_ZERO).sort((a, b) => a.exact - b.exact)[0];
  const summaryMonth = (x: typeof best | undefined): PnlSummaryMonth | null =>
    x ? { month: x.month, label: x.label, netProfit: displayMoney(x.exact) } : null;

  return {
    year: figures.year,
    months: months.map(m => ({
      month: m.month,
      label: m.month === currentMonth
        ? `${monthLabel(m.month)} (đến ${today.slice(8, 10)}/${today.slice(5, 7)})`
        : monthLabel(m.month),
      shortLabel: m.month.slice(5, 7),
    })),
    periodLabel: figures.year < Number(today.slice(0, 4)) ? "cả năm" : "từ đầu năm",
    rows,
    summary: {
      revenue: displayMoney(yearRevenue),
      netProfit: displayMoney(yearNet),
      margin: hasRevenue(yearRevenue) ? roundPercent((yearNet / yearRevenue) * 100) : null,
      bestMonth: summaryMonth(best),
      worstMonth: summaryMonth(worst),
    },
    chart: months.map((m, i) => ({
      month: m.month,
      shortLabel: m.month.slice(5, 7),
      netProfit: displayMoney(exact[i].net),
      cumulative: displayMoney(cumulative[i]),
    })),
    footnotes,
  };
}
```

- [ ] **Bước 4: Chạy, thấy xanh**

Chạy: `npx vitest run lib/reports/profit-and-loss-table.test.ts`
Mong đợi: xanh. Test đỏ vì chuỗi phép tính lệch một ký tự thì so ký tự trừ (`−`
U+2212 trong phép tính, `-` trong số âm) trước khi nghĩ tới chuyện khác.

- [ ] **Bước 5: Server action trả thêm bảng, test đỏ**

Trong `app/admin/reports/pnl/actions.test.ts`, test "loads only the chosen year's
completed orders, bounded in Saigon time", thêm sau các `expect` đang có:

```ts
    expect(report.table.year).toBe(2025);
    expect(report.table.periodLabel).toBe("cả năm");
    expect(report.table.months.map(m => m.month)).toEqual(["2025-11", "2025-12"]);
```

Chạy `npx vitest run app/admin/reports/pnl/actions.test.ts`, thấy đỏ vì **giá trị
sai** (`report.table` chưa có).

- [ ] **Bước 6: Sửa server action**

Trong `app/admin/reports/pnl/actions.ts`:
- thêm import `import { buildPnlTable, type PnlTable } from "@/lib/reports/profit-and-loss-table";`
- `ProfitAndLossReport` thêm trường `table: PnlTable;`
- dòng cuối đổi thành `return { availableYears, figures, table: buildPnlTable(figures, today) };`

Chạy lại, thấy xanh.

- [ ] **Bước 7: Một đoạn về làm tròn trong luật lãi lỗ**

`docs/02-rules/business-rules/profit-and-loss.md`, thêm ngay sau đoạn mở đầu (trước
`### BR-PNL-001`):

```markdown
**Rounding.** Every figure is computed exactly and rounded only where it is
shown (`BR-DATA-005`), in `lib/reports/profit-and-loss-table.ts`: each month's
cell, each total and each profit from its own exact value. Adding a row by hand
can therefore miss its total by a đồng or two; when it does, the page says so
under the table. Percentages show two decimals (`PERCENT_DECIMALS`, owner
decision 2026-09-11).
```

- [ ] **Bước 8: Kiểm toàn bộ và lưu**

```bash
npx tsc --noEmit
npx vitest run
npx vite-node scripts/verify-pnl-monthly.ts
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
git checkout -- docs/generated/system-map.md
git add lib/reports/profit-and-loss-table.ts lib/reports/profit-and-loss-table.test.ts \
  app/admin/reports/pnl/actions.ts app/admin/reports/pnl/actions.test.ts \
  docs/02-rules/business-rules/profit-and-loss.md
git commit -m "feat(reports): P&L table rounds each cell from its exact value (BR-DATA-005)"
```

`verify-pnl-monthly` phải vẫn in "0 mismatches across 7 month(s)."

**Opus soát sau mục này:** chạy `buildPnlTable` trên số thật (script đọc trong
scratchpad) và so từng ô với bảng "Ví dụ bằng số thật".

## Mục 5 — Trang trên máy tính, menu, tài liệu luồng

Gọi skill `ui-ux-pro-max` và đọc `.claude/rules/ui-devices.md` trước khi dựng. Trang
là component máy chủ, chỉ vẽ `table` mà Mục 4 trả ra; không tính, không làm tròn gì
thêm. Chỉ bảng là component máy khách, vì nó giữ ô đang chọn.

Sau mục này, trên điện thoại trang mới có bốn ô số, biểu đồ và ghi chú; thẻ từng
tháng là Mục 6. Không đẩy code giữa hai mục nên chủ quán không thấy trạng thái dở này.

**File:**
- Tạo: `app/admin/reports/pnl/page.tsx`
- Tạo: `app/admin/reports/pnl/__fixtures__/pnl-2026.ts`
- Tạo trong `app/admin/reports/pnl/components/`: `YearPicker.tsx`, `PnlSummary.tsx` +
  `PnlSummary.test.tsx`, `PnlChart.tsx`, `PnlTableView.tsx` + `PnlTableView.test.tsx`,
  `PnlSourceList.tsx`, `PnlFootnotes.tsx`
- Sửa: `app/admin/layout.tsx` (menu), `docs/03-workflows/reports.md`,
  `docs/02-rules/business-rules/profit-and-loss.md` (câu mở đầu)

**Giao diện:**
- Cần từ mục trước: `getProfitAndLossReport(year?)` trả `{ availableYears, figures, table }`;
  `PnlTable`, `PnlRow`, `PnlCellSource`, `formatPercent`, `buildPnlTable` (Mục 4).
- Đưa ra cho Mục 6: `PnlSourceList({ sources })`, fixture `pnlFigures2026()` và
  `monthFigures()`.

- [ ] **Bước 1: Fixture số thật cho test màn hình**

Tạo `app/admin/reports/pnl/__fixtures__/pnl-2026.ts`. Thư mục bắt đầu bằng `_` nên
Next.js không coi là đường dẫn; `app/admin/reports/issued/__fixtures__` là tiền lệ.

```ts
import type { PnlFigures, PnlMonthFigures } from "@/lib/reports/profit-and-loss";

// March, August and September 2026, exact, as measured on the real server on
// 2026-09-11 (plan "Ví dụ bằng số thật"). April to July are left out to keep
// the fixture short; the screen does not care which months it gets. Sources
// are trimmed to what the screen tests read -- August's Vận hành carries all
// four of its real cash-book rows.
export function monthFigures(month: string, overrides: Partial<PnlMonthFigures> = {}): PnlMonthFigures {
  return {
    month,
    posRevenue: 0, posOrderCount: 0, posRevenueBeforePayments: 0, manualRevenue: 0,
    cogsExact: 0, shrinkageExact: 0, nonInventoryExact: 0,
    expenseByCategory: {}, otherIncome: 0, depreciationExact: 0,
    ...overrides,
    sources: {
      manualRevenue: [], cogs: [], shrinkage: [], nonInventory: [], expense: {}, otherIncome: [], depreciation: [],
      ...overrides.sources,
    },
  };
}

export function pnlFigures2026(): PnlFigures {
  return {
    year: 2026,
    expenseCategories: [
      { id: "CFC-001", name: "Vận hành" },
      { id: "CFC-002", name: "Điện, nước, gas" },
    ],
    firstPaymentDate: "2026-07-20",
    months: [
      monthFigures("2026-03", { depreciationExact: 49_225.708333333336 }),
      monthFigures("2026-08", {
        posRevenue: 17_682_000, posOrderCount: 644,
        cogsExact: 46_418_989.77485121,
        nonInventoryExact: 1_760_000,
        expenseByCategory: { "CFC-001": 615_000, "CFC-002": 470_000 },
        depreciationExact: 790_974.0694444443,
        sources: {
          manualRevenue: [], shrinkage: [], otherIncome: [], depreciation: [],
          cogs: [
            { kind: "STOCKTAKE", id: "STK-001", date: "2026-08-09", label: "Kiểm kê định kỳ", ref: null, amountExact: 34_864_626.83216999 },
          ],
          nonInventory: [
            { kind: "PO_LINE", id: "POL-d0228874-66d6-4e78-bef1-059b39ca423d", date: "2026-08-30", label: "Đá viên", ref: "PO-175", amountExact: 980_000 },
          ],
          expense: {
            "CFC-001": [
              { kind: "CASH_ENTRY", id: "CE-023", date: "2026-08-02", label: "Dán lại xe Phin Đi", ref: null, amountExact: 300_000 },
              { kind: "CASH_ENTRY", id: "CE-025", date: "2026-08-26", label: "Photo giấy bán khoai trứng", ref: null, amountExact: 35_000 },
              { kind: "CASH_ENTRY", id: "CE-029", date: "2026-08-31", label: "Phin Đi - Gửi xe", ref: null, amountExact: 130_000 },
              { kind: "CASH_ENTRY", id: "CE-030", date: "2026-08-31", label: "Uchako - Gửi xe", ref: null, amountExact: 150_000 },
            ],
            "CFC-002": [
              { kind: "CASH_ENTRY", id: "CE-026", date: "2026-08-31", label: "Tiền gas", ref: null, amountExact: 250_000 },
              { kind: "CASH_ENTRY", id: "CE-027", date: "2026-08-31", label: "Tiền điện", ref: null, amountExact: 150_000 },
              { kind: "CASH_ENTRY", id: "CE-028", date: "2026-08-31", label: "Tiền nước sinh hoạt", ref: null, amountExact: 70_000 },
            ],
          },
        },
      }),
      monthFigures("2026-09", {
        posRevenue: 5_054_000, posOrderCount: 213,
        cogsExact: 1_678_673.4011654996,
        nonInventoryExact: 360_000,
        expenseByCategory: { "CFC-001": 1_057_000, "CFC-002": 470_000 },
        depreciationExact: 790_974.0694444443,
      }),
    ],
  };
}
```

Số tính sẵn từ fixture này, với hôm nay là 2026-09-11 (test dưới dựa vào):

| | 03/2026 | 08/2026 | 09/2026 (đến 11/09) | Tổng |
|---|---:|---:|---:|---:|
| Doanh thu | 0 | 17.682.000 | 5.054.000 | 22.736.000 |
| Giá vốn | 0 | 46.418.990 | 1.678.673 | 48.097.663 |
| Lợi nhuận gộp | 0 | -30.496.990 | 3.015.327 | -27.481.663 |
| Khấu hao | 49.226 | 790.974 | 790.974 | 1.631.174 |
| Lợi nhuận ròng | -49.226 | -32.372.964 | 697.353 | -31.724.837 |
| Cộng dồn | -49.226 | -32.422.190 | -31.724.837 | |

Biên lợi nhuận cả ba tháng: -139,54%. Tháng lời nhất 09/2026 (697.353), tháng lỗ nhất
08/2026 (-32.372.964). Không có ô nào lệch khi cộng tay, nên không có ghi chú làm tròn.

- [ ] **Bước 2: Test đỏ cho bảng và bốn ô số**

Tạo `app/admin/reports/pnl/components/PnlTableView.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlTableView } from "./PnlTableView";

afterEach(() => cleanup());
const table = () => buildPnlTable(pnlFigures2026(), "2026-09-11");

describe("PnlTableView", () => {
  it("clicking Vận hành in 08/2026 lists its four cash-book rows under the table; clicking again closes them", () => {
    render(<PnlTableView table={table()} />);
    fireEvent.click(screen.getByRole("button", { name: "Vận hành 08/2026" }));
    const detail = screen.getByRole("region", { name: "Chi tiết: Vận hành 08/2026" });
    const items = within(detail).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toContain("Dán lại xe Phin Đi");
    expect(items[0].textContent).toContain("02/08/2026");
    expect(items[0].textContent).toContain("300.000");
    fireEvent.click(screen.getByRole("button", { name: "Vận hành 08/2026" }));
    expect(screen.queryByRole("region", { name: "Chi tiết: Vận hành 08/2026" })).toBeNull();
  });

  it("a profit cell opens the sum behind it", () => {
    render(<PnlTableView table={table()} />);
    fireEvent.click(screen.getByRole("button", { name: "Lợi nhuận ròng 08/2026" }));
    const detail = screen.getByRole("region", { name: "Chi tiết: Lợi nhuận ròng 08/2026" });
    expect(detail.textContent).toContain("Lợi nhuận gộp -30.496.990 − chi phí 1.085.000 − khấu hao 790.974 = -32.372.964");
  });

  it("shows a loss in red, with a minus sign", () => {
    render(<PnlTableView table={table()} />);
    const cell = screen.getByRole("button", { name: "Lợi nhuận ròng 08/2026" });
    expect(cell.textContent).toBe("-32.372.964");
    expect(cell.closest("td")!.className).toContain("text-danger");
  });

  it("the month still running says how far its figures reach", () => {
    render(<PnlTableView table={table()} />);
    expect(screen.getByRole("columnheader", { name: "09/2026 (đến 11/09)" })).toBeTruthy();
  });

  it("an empty cell and the Tổng column do not open anything; the unit is said once", () => {
    render(<PnlTableView table={table()} />);
    expect(screen.queryByRole("button", { name: "Nguyên liệu mua dùng ngay 03/2026" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Tổng/ })).toBeNull();
    expect(screen.getByText(/Đơn vị: đồng/)).toBeTruthy();
  });
});
```

Tạo `app/admin/reports/pnl/components/PnlSummary.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlSummary } from "./PnlSummary";

afterEach(() => cleanup());

describe("PnlSummary", () => {
  it("shows revenue and net profit so far this year, the margin, the best and the worst month", () => {
    render(<PnlSummary table={buildPnlTable(pnlFigures2026(), "2026-09-11")} />);
    const text = screen.getByRole("region", { name: "Tóm tắt" }).textContent;
    expect(text).toContain("Doanh thu từ đầu năm");
    expect(text).toContain("22.736.000");
    expect(text).toContain("Lợi nhuận ròng từ đầu năm");
    expect(text).toContain("-31.724.837");
    expect(text).toContain("Biên lợi nhuận -139,54%");
    expect(text).toContain("Tháng lời nhất");
    expect(text).toContain("697.353");
    expect(text).toContain("Tháng lỗ nhất");
    expect(text).toContain("-32.372.964");
  });

  it("leaves out the worst-month tile when no month lost money", () => {
    const figures = pnlFigures2026();
    const september = { ...figures, months: figures.months.filter(m => m.month === "2026-09") };
    render(<PnlSummary table={buildPnlTable(september, "2026-09-11")} />);
    expect(screen.queryByText("Tháng lỗ nhất")).toBeNull();
  });
});
```

- [ ] **Bước 3: Chạy, thấy đỏ**

Chạy: `npx vitest run app/admin/reports/pnl/components`
Mong đợi: đỏ vì **thiếu module** (`./PnlTableView`, `./PnlSummary`).

- [ ] **Bước 4: Viết các component**

Tạo `app/admin/reports/pnl/components/PnlSourceList.tsx`:

```tsx
import { formatNumber } from "@/lib/shared/format";
import type { PnlCellSource } from "@/lib/reports/profit-and-loss-table";

// What makes up one cell. Shared by the computer table and the phone cards.
export function PnlSourceList({ sources }: { sources: PnlCellSource[] }) {
  return (
    <ul className="divide-y divide-border">
      {sources.map((s, i) => {
        const meta = [s.date, s.ref ? `Đơn nhập ${s.ref}` : null].filter(Boolean).join(" · ");
        return (
          <li key={`${s.kind}-${s.id ?? "pos"}-${i}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="break-words text-text-primary">{s.label}</p>
              {meta && <p className="text-xs text-text-secondary">{meta}</p>}
            </div>
            <span className={`shrink-0 tabular-nums ${s.amount < 0 ? "text-danger" : "text-text-primary"}`}>
              {formatNumber(s.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

Tạo `app/admin/reports/pnl/components/PnlTableView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/shared/format";
import { formatPercent, type PnlRow, type PnlTable } from "@/lib/reports/profit-and-loss-table";
import { PnlSourceList } from "./PnlSourceList";

// Computer layout (.claude/rules/ui-devices.md): a real table, months as
// columns (BR-PNL-002). Clicking a month cell opens what makes it up, under
// the table. The Tổng column never opens: a year of depreciation alone is
// 84 assets times the months. Row labels are <th>, which browsers bold by
// default and Tailwind's preflight does not reset, hence [font-weight:inherit].

const ROW_STYLE: Record<PnlRow["kind"], string> = {
  revenue: "font-semibold",
  detail: "text-xs text-text-secondary",
  cost: "",
  subtotal: "font-bold bg-surface-secondary",
  expense: "",
  income: "",
  net: "font-bold bg-surface-secondary",
  margin: "text-text-secondary",
  cumulative: "text-text-secondary",
};

function show(row: PnlRow, value: number | null): string {
  return row.unit === "percent" ? formatPercent(value) : formatNumber(value);
}
const tone = (value: number | null) => (value !== null && value < 0 ? "text-danger" : "");

export function PnlTableView({ table }: { table: PnlTable }) {
  const [selected, setSelected] = useState<{ rowKey: string; month: string } | null>(null);
  const selectedRow = selected ? table.rows.find(r => r.key === selected.rowKey) : undefined;
  const selectedCell = selected ? selectedRow?.cells.find(c => c.month === selected.month) : undefined;
  const selectedColumn = selected ? table.months.find(m => m.month === selected.month) : undefined;

  return (
    <section className="hidden md:block space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-text-primary">Từng tháng</h2>
        <p className="text-xs text-text-secondary">Đơn vị: đồng. Bấm vào một ô để xem các khoản làm nên ô đó.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface-card">
        <table className="min-w-full text-sm tabular-nums">
          <thead className="bg-surface-secondary text-xs text-text-secondary">
            <tr>
              <th scope="col" className="sticky left-0 bg-surface-secondary px-3 py-2 text-left font-medium">Khoản</th>
              {table.months.map(m => (
                <th key={m.month} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">{m.label}</th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-medium">Tổng</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">% doanh thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {table.rows.map(row => {
              const shaded = row.kind === "subtotal" || row.kind === "net";
              return (
                <tr key={row.key} className={ROW_STYLE[row.kind]}>
                  <th
                    scope="row"
                    className={`sticky left-0 whitespace-nowrap px-3 py-2 text-left [font-weight:inherit] ${shaded ? "bg-surface-secondary" : "bg-surface-card"} ${row.kind === "detail" ? "pl-6" : ""}`}
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell, i) => {
                    const clickable = cell.sources.length > 0 || cell.formula !== null;
                    const isSelected = selected?.rowKey === row.key && selected.month === cell.month;
                    const text = show(row, cell.value);
                    return (
                      <td key={cell.month} className={`px-1 py-1 text-right ${tone(cell.value)}`}>
                        {clickable ? (
                          <button
                            type="button"
                            aria-label={`${row.label} ${table.months[i].label}`}
                            aria-expanded={isSelected}
                            onClick={() => setSelected(isSelected ? null : { rowKey: row.key, month: cell.month })}
                            className={`w-full rounded px-2 py-1 text-right tabular-nums hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isSelected ? "bg-primary-soft ring-1 ring-primary" : ""}`}
                          >
                            {text}
                          </button>
                        ) : (
                          <span className="block px-2 py-1">{text}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`px-3 py-2 text-right font-semibold ${tone(row.total)}`}>
                    {row.total === null ? "" : show(row, row.total)}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {row.shareOfRevenue === null ? "" : formatPercent(row.shareOfRevenue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedRow && selectedCell && selectedColumn && (
        <section
          aria-label={`Chi tiết: ${selectedRow.label} ${selectedColumn.label}`}
          className="space-y-2 rounded-xl border border-border bg-surface-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-text-primary">
              {selectedRow.label} · {selectedColumn.label}:{" "}
              <span className={tone(selectedCell.value)}>{show(selectedRow, selectedCell.value)}</span>
            </h3>
            <button type="button" onClick={() => setSelected(null)} className="text-sm font-bold text-primary hover:underline">
              Đóng
            </button>
          </div>
          {selectedCell.formula && <p className="text-sm text-text-secondary">{selectedCell.formula}</p>}
          {selectedCell.sources.length > 0 && <PnlSourceList sources={selectedCell.sources} />}
        </section>
      )}
    </section>
  );
}
```

Tạo `app/admin/reports/pnl/components/PnlSummary.tsx`:

```tsx
import { formatNumber } from "@/lib/shared/format";
import { formatPercent, type PnlTable } from "@/lib/reports/profit-and-loss-table";

function Tile({ label, value, note, negative }: { label: string; value: string; note: string; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums md:text-2xl ${negative ? "text-danger" : "text-text-primary"}`}>{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{note}</p>
    </div>
  );
}

// The four figures of the spec. The worst month shows only when a month lost money.
export function PnlSummary({ table }: { table: PnlTable }) {
  const { summary, periodLabel } = table;
  return (
    <section
      aria-label="Tóm tắt"
      className={`grid grid-cols-2 gap-3 ${summary.worstMonth ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      <Tile label={`Doanh thu ${periodLabel}`} value={formatNumber(summary.revenue)} note="Đơn vị: đồng" />
      <Tile
        label={`Lợi nhuận ròng ${periodLabel}`}
        value={formatNumber(summary.netProfit)}
        negative={summary.netProfit < 0}
        note={`Biên lợi nhuận ${formatPercent(summary.margin)}`}
      />
      <Tile
        label="Tháng lời nhất"
        value={summary.bestMonth ? formatNumber(summary.bestMonth.netProfit) : "---"}
        note={summary.bestMonth ? `Tháng ${summary.bestMonth.label}` : "Chưa có tháng nào lời"}
      />
      {summary.worstMonth && (
        <Tile
          label="Tháng lỗ nhất"
          value={formatNumber(summary.worstMonth.netProfit)}
          negative
          note={`Tháng ${summary.worstMonth.label}`}
        />
      )}
    </section>
  );
}
```

Tạo `app/admin/reports/pnl/components/PnlChart.tsx` (SVG tay, không thêm thư viện):

```tsx
import { formatNumber } from "@/lib/shared/format";
import type { PnlTable } from "@/lib/reports/profit-and-loss-table";

// One bar per month, green for profit and red for loss, and a line for the
// running total since January (spec, "Biểu đồ"). One scale places bars,
// line and the zero line.
const SLOT = 64;
const BAR = 32;
const HEIGHT = 220;
const TOP = 16;
const BOTTOM = 28;

export function PnlChart({ table }: { table: PnlTable }) {
  const points = table.chart;
  if (points.length === 0) return null;
  const all = points.flatMap(p => [p.netProfit, p.cumulative]);
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const y = (v: number) => TOP + ((max - v) / span) * (HEIGHT - TOP - BOTTOM);
  const width = Math.max(points.length, 6) * SLOT;
  const offset = (width - points.length * SLOT) / 2;
  const cx = (i: number) => offset + i * SLOT + SLOT / 2;
  const zero = y(0);

  return (
    <section aria-label="Biểu đồ lãi lỗ" className="rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-success" />Tháng lời</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-danger" />Tháng lỗ</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-primary" />Cộng dồn từ đầu năm</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="mt-2 h-auto max-h-72 w-full"
        role="img"
        aria-label={`Lợi nhuận ròng từng tháng năm ${table.year} và cộng dồn từ đầu năm`}
      >
        <line x1={0} x2={width} y1={zero} y2={zero} className="stroke-border" strokeWidth={1} />
        <text x={4} y={zero - 4} fontSize={11} className="fill-text-muted">0</text>
        {points.map((p, i) => {
          const barTop = Math.min(y(p.netProfit), zero);
          const barHeight = p.netProfit === 0 ? 0 : Math.max(Math.abs(y(p.netProfit) - zero), 1);
          return (
            <g key={p.month}>
              <title>{`Tháng ${p.shortLabel}: lợi nhuận ròng ${formatNumber(p.netProfit)}, cộng dồn ${formatNumber(p.cumulative)}`}</title>
              <rect
                x={cx(i) - BAR / 2}
                y={barTop}
                width={BAR}
                height={barHeight}
                rx={3}
                className={p.netProfit < 0 ? "fill-danger" : "fill-success"}
              />
              <text x={cx(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={12} className="fill-text-secondary">
                {p.shortLabel}
              </text>
            </g>
          );
        })}
        <polyline
          points={points.map((p, i) => `${cx(i)},${y(p.cumulative)}`).join(" ")}
          fill="none"
          strokeWidth={2}
          className="stroke-primary"
        />
        {points.map((p, i) => (
          <circle key={p.month} cx={cx(i)} cy={y(p.cumulative)} r={3.5} className="fill-primary" />
        ))}
      </svg>
    </section>
  );
}
```

Tạo `app/admin/reports/pnl/components/YearPicker.tsx`:

```tsx
import Link from "next/link";

// Only years with data are offered (spec, "Trên cùng"). One year: nothing to pick.
export function YearPicker({ years, selected }: { years: number[]; selected: number }) {
  if (years.length <= 1) return null;
  return (
    <nav aria-label="Chọn năm" className="flex flex-wrap gap-2">
      {years.map(year => (
        <Link
          key={year}
          href={`/admin/reports/pnl?year=${year}`}
          aria-current={year === selected ? "page" : undefined}
          className={`flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-bold ${
            year === selected ? "border-primary bg-primary text-white" : "border-border bg-surface-card text-text-secondary hover:text-text-primary"
          }`}
        >
          {year}
        </Link>
      ))}
    </nav>
  );
}
```

Tạo `app/admin/reports/pnl/components/PnlFootnotes.tsx`:

```tsx
import type { PnlTable } from "@/lib/reports/profit-and-loss-table";

// Only notes the data calls for (spec, "Ghi chú dưới bảng"); none, nothing shown.
export function PnlFootnotes({ footnotes }: { footnotes: PnlTable["footnotes"] }) {
  if (footnotes.length === 0) return null;
  return (
    <section aria-label="Ghi chú" className="space-y-1">
      <h2 className="text-sm font-bold text-text-primary">Ghi chú</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-text-secondary">
        {footnotes.map(f => (
          <li key={f.key}>{f.text}</li>
        ))}
      </ul>
    </section>
  );
}
```

Chạy lại `npx vitest run app/admin/reports/pnl/components`, thấy xanh.

Các lớp `fill-success`, `fill-danger`, `fill-primary`, `stroke-primary`,
`stroke-border`, `fill-text-secondary`, `fill-text-muted` đều sinh ra từ màu có sẵn
trong `tailwind.config.ts` (Tailwind 3.4 dựng `fill-*`/`stroke-*` từ bảng màu). Nếu
xem trang mà biểu đồ không có màu, báo lại; đừng đổi sang mã màu viết cứng.

- [ ] **Bước 5: Trang, rồi thấy phép kiểm menu đỏ**

Tạo `app/admin/reports/pnl/page.tsx`:

```tsx
import { getProfitAndLossReport } from "./actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { YearPicker } from "./components/YearPicker";
import { PnlSummary } from "./components/PnlSummary";
import { PnlChart } from "./components/PnlChart";
import { PnlTableView } from "./components/PnlTableView";
import { PnlFootnotes } from "./components/PnlFootnotes";

export const dynamic = "force-dynamic";

// docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md. A malformed or
// data-less ?year= falls back to the newest year with data, without an error
// (plan, question 4): getProfitAndLossReport does the fallback.
export default async function ProfitAndLossPage({ searchParams }: { searchParams: { year?: string } }) {
  const raw = searchParams?.year;
  const requestedYear = raw && /^\d{4}$/.test(raw) ? Number(raw) : undefined;
  const { availableYears, table } = await getProfitAndLossReport(requestedYear);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">Lãi lỗ năm {table.year}</h1>
        <YearPicker years={availableYears} selected={table.year} />
      </div>
      {table.months.length === 0 ? (
        <EmptyState title={`Năm ${table.year} chưa có số liệu nào.`} />
      ) : (
        <>
          <PnlSummary table={table} />
          <PnlChart table={table} />
          <PnlTableView table={table} />
          <PnlFootnotes footnotes={table.footnotes} />
        </>
      )}
    </div>
  );
}
```

Chạy: `npx vitest run app/admin/nav-guard.test.ts`
Mong đợi: đỏ, nêu `/admin/reports/pnl` là trang không có lối vào menu (**giá trị
sai**, không phải thiếu hàm).

- [ ] **Bước 6: Menu**

`app/admin/layout.tsx`, nhóm "Báo cáo": thêm một dòng ngay sau
`{ name: "Giá trị hàng đã xuất", href: "/admin/reports/issued" },`:

```tsx
        { name: "Lãi lỗ", href: "/admin/reports/pnl" },
```

Chạy lại `npx vitest run app/admin/nav-guard.test.ts`, thấy xanh.

- [ ] **Bước 7: Tài liệu luồng và luật**

`docs/03-workflows/reports.md`:
- Tiêu đề: `# Reports flow (dashboard and three reports)` → `# Reports flow (dashboard and four reports)`.
- Khối `flow-decl`: `routes:` thêm `, /admin/reports/pnl` ở cuối; `brCodes:` thành
  `BR-COGS-005, BR-COGS-007, BR-PNL-001, BR-PNL-002, BR-PNL-003, BR-PNL-004`.
- Đoạn ngay dưới: "the dashboard and the three reports display" → "the dashboard and
  the four reports display"; "verified only by its four routes existing" → "verified
  only by its five routes existing".
- Câu liệt kê màn hình: "and the issued-goods (cost) report at `/admin/reports/issued`."
  → ", the issued-goods (cost) report at `/admin/reports/issued`, and the monthly
  profit and loss at `/admin/reports/pnl`." (bỏ chữ "and" đứng trước issued-goods).
- Thêm cuối file:

```markdown
## The profit and loss page

`/admin/reports/pnl` shows one year of monthly profit and loss for the whole
shop (`BR-PNL-001`), months as columns (`BR-PNL-002`), for `ADMIN` and
`MANAGER` (`BR-PNL-004`). Design:
`docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md`.

- **Reads, never writes.** `getProfitAndLossReport`
  (`app/admin/reports/pnl/actions.ts`) loads source rows and recomputes every
  figure on every open (`lib/reports/profit-and-loss.ts`);
  `lib/reports/profit-and-loss-table.ts` rounds for display (`BR-DATA-005`).
  Nothing is stored and no month is locked.
- **One control: the year**, as `?year=YYYY`. A malformed year, or a year with
  no data, falls back to the newest year with data, without an error.
- **Cells open their sources.** On a computer, clicking a month cell lists the
  rows behind it under the table: POS order count and hand-recorded revenue
  (`BR-PNL-003`), cash-book rows, purchase lines, stocktakes and issue slips,
  assets; a profit cell shows its sum. The Tổng column does not open. On a
  phone there is no wide table: a year card, then one card per month, newest
  first.
- **Checked against the older report.** `scripts/verify-pnl-monthly.ts`
  confirms that every month's POS revenue, and Giá vốn plus Hao hụt, equal
  `getPnLDataV2` for the same month, and that every line's sources add up to
  the line.
```

`docs/02-rules/business-rules/profit-and-loss.md`, câu đầu: "The monthly
profit-and-loss page is designed, not built. Design:" → "The monthly profit-and-loss
page is `/admin/reports/pnl` (menu Báo cáo → Lãi lỗ). Design:".

- [ ] **Bước 8: Kiểm toàn bộ và lưu**

```bash
npx tsc --noEmit
npx vitest run
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
git checkout -- docs/generated/system-map.md
npm run build
git add app/admin/reports/pnl/page.tsx app/admin/reports/pnl/__fixtures__/pnl-2026.ts \
  app/admin/reports/pnl/components/YearPicker.tsx \
  app/admin/reports/pnl/components/PnlSummary.tsx app/admin/reports/pnl/components/PnlSummary.test.tsx \
  app/admin/reports/pnl/components/PnlChart.tsx \
  app/admin/reports/pnl/components/PnlTableView.tsx app/admin/reports/pnl/components/PnlTableView.test.tsx \
  app/admin/reports/pnl/components/PnlSourceList.tsx app/admin/reports/pnl/components/PnlFootnotes.tsx \
  app/admin/layout.tsx docs/03-workflows/reports.md docs/02-rules/business-rules/profit-and-loss.md
git commit -m "feat(reports): profit-and-loss page on a computer, with a menu entry (BR-PNL-002)"
```

`npm run build` phải liệt kê `/admin/reports/pnl` là trang động (`ƒ`).

**Opus soát sau mục này:** đọc diff; xem ảnh chụp trang nếu agent chụp được, không
thì để dành cho lúc chủ quán mở thử.

## Mục 6 — Thẻ từng tháng trên điện thoại

Trên điện thoại không có bảng ngang (`.claude/rules/ui-devices.md`). Thay vào đó: một
thẻ cả năm ở đầu, rồi mỗi tháng một thẻ, tháng mới nhất trên cùng. Bấm thẻ thì mở ra
các dòng của tháng đó; dòng nào có nguồn hoặc phép tính thì bấm tiếp để xem. Dùng
`<details>` của trình duyệt nên không cần component máy khách.

**File:**
- Tạo: `app/admin/reports/pnl/components/PnlMonthCards.tsx` + `PnlMonthCards.test.tsx`
- Sửa: `app/admin/reports/pnl/page.tsx` (thêm một dòng)

**Giao diện:**
- Cần từ mục trước: `PnlTable`, `PnlRow`, `formatPercent` (Mục 4); `PnlSourceList`,
  fixture `pnlFigures2026()` (Mục 5).
- Đưa ra: `PnlMonthCards({ table })`.

- [ ] **Bước 1: Test đỏ**

Tạo `app/admin/reports/pnl/components/PnlMonthCards.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlMonthCards } from "./PnlMonthCards";

afterEach(() => cleanup());
const table = () => buildPnlTable(pnlFigures2026(), "2026-09-11");

describe("PnlMonthCards", () => {
  it("puts the year first, then the months newest first", () => {
    render(<PnlMonthCards table={table()} />);
    const section = screen.getByRole("region", { name: "Từng tháng" });
    const titles = Array.from(section.children)
      .filter(c => c.tagName === "DETAILS")
      .map(c => c.querySelector("summary")!.textContent);
    expect(titles).toHaveLength(4);
    expect(titles[0]).toContain("Từ đầu năm");
    expect(titles[1]).toContain("09/2026 (đến 11/09)");
    expect(titles[2]).toContain("08/2026");
    expect(titles[3]).toContain("03/2026");
  });

  it("a month card shows its net profit on the outside, in red for a loss", () => {
    render(<PnlMonthCards table={table()} />);
    const august = screen.getByTestId("pnl-month-2026-08");
    const net = within(august.querySelector("summary")!).getByText("-32.372.964");
    expect(net.className).toContain("text-danger");
  });

  it("inside August, Vận hành opens its four cash-book rows", () => {
    render(<PnlMonthCards table={table()} />);
    const august = screen.getByTestId("pnl-month-2026-08");
    const line = within(august).getByTestId("pnl-line-expense:CFC-001");
    expect(line.tagName).toBe("DETAILS");
    const items = within(line).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toContain("Dán lại xe Phin Đi");
  });

  it("a line with nothing to open is a plain line, and the year card has nothing to open", () => {
    render(<PnlMonthCards table={table()} />);
    const march = screen.getByTestId("pnl-month-2026-03");
    expect(within(march).getByTestId("pnl-line-nonInventory").tagName).toBe("DIV");
    const year = screen.getByTestId("pnl-year");
    expect(year.querySelectorAll("details")).toHaveLength(0);
    expect(year.textContent).toContain("-31.724.837");
  });
});
```

Test đầu chỉ lấy `<details>` là con trực tiếp của khung "Từng tháng", để không đếm các
`<details>` lồng bên trong từng thẻ.

- [ ] **Bước 2: Chạy, thấy đỏ**

Chạy: `npx vitest run app/admin/reports/pnl/components/PnlMonthCards.test.tsx`
Mong đợi: đỏ vì **thiếu module** `./PnlMonthCards`.

- [ ] **Bước 3: Viết component**

Tạo `app/admin/reports/pnl/components/PnlMonthCards.tsx`:

```tsx
import { formatNumber } from "@/lib/shared/format";
import { formatPercent, type PnlRow, type PnlTable } from "@/lib/reports/profit-and-loss-table";
import { PnlSourceList } from "./PnlSourceList";

// Phone layout (.claude/rules/ui-devices.md): no wide table. A card for the
// year, then one card per month, newest first. Native <details>, so no
// client component. A line opens only if it has sources or a formula (the
// same rule as the computer table).

const show = (row: PnlRow, value: number | null) => (row.unit === "percent" ? formatPercent(value) : formatNumber(value));
const tone = (value: number | null) => (value !== null && value < 0 ? "text-danger" : "text-text-primary");
const strong = (row: PnlRow) => row.kind === "revenue" || row.kind === "subtotal" || row.kind === "net";

function LineText({ row, value }: { row: PnlRow; value: number | null }) {
  return (
    <>
      <span className={`min-w-0 ${row.kind === "detail" ? "pl-3 text-xs text-text-secondary" : "text-text-primary"} ${strong(row) ? "font-bold" : ""}`}>
        {row.label}
      </span>
      <span className={`shrink-0 tabular-nums ${tone(value)} ${strong(row) ? "font-bold" : ""}`}>{show(row, value)}</span>
    </>
  );
}

function YearCard({ table }: { table: PnlTable }) {
  const net = table.rows.find(r => r.key === "netProfit")!;
  const lines = table.rows.filter(r => r.total !== null);
  const title = table.periodLabel === "cả năm" ? `Cả năm ${table.year}` : "Từ đầu năm";
  return (
    <details data-testid="pnl-year" open className="rounded-xl border border-border bg-surface-card">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-4 py-3">
        <span className="font-bold text-text-primary">{title}</span>
        <span className={`font-bold tabular-nums ${tone(net.total)}`}>{formatNumber(net.total)}</span>
      </summary>
      <div className="divide-y divide-border border-t border-border px-4">
        {lines.map(row => (
          <div key={row.key} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <LineText row={row} value={row.total} />
          </div>
        ))}
      </div>
    </details>
  );
}

function MonthCard({ table, index }: { table: PnlTable; index: number }) {
  const column = table.months[index];
  const net = table.rows.find(r => r.key === "netProfit")!.cells[index];
  const revenue = table.rows.find(r => r.key === "revenue")!.cells[index];
  return (
    <details data-testid={`pnl-month-${column.month}`} className="rounded-xl border border-border bg-surface-card">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="block font-bold text-text-primary">{column.label}</span>
          <span className="block text-xs text-text-secondary">Doanh thu {formatNumber(revenue.value)}</span>
        </span>
        <span className={`font-bold tabular-nums ${tone(net.value)}`}>{formatNumber(net.value)}</span>
      </summary>
      <div className="divide-y divide-border border-t border-border px-4">
        {table.rows.map(row => {
          const cell = row.cells[index];
          const opens = cell.sources.length > 0 || cell.formula !== null;
          if (!opens) {
            return (
              <div key={row.key} data-testid={`pnl-line-${row.key}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <LineText row={row} value={cell.value} />
              </div>
            );
          }
          return (
            <details key={row.key} data-testid={`pnl-line-${row.key}`} className="py-1 text-sm">
              <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
                <LineText row={row} value={cell.value} />
              </summary>
              <div className="space-y-2 pb-2 pl-3">
                {cell.formula && <p className="text-xs text-text-secondary">{cell.formula}</p>}
                {cell.sources.length > 0 && <PnlSourceList sources={cell.sources} />}
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}

export function PnlMonthCards({ table }: { table: PnlTable }) {
  const newestFirst = table.months.map((_, i) => i).reverse();
  return (
    <section aria-label="Từng tháng" className="space-y-3 md:hidden">
      <p className="text-xs text-text-secondary">Đơn vị: đồng. Bấm vào một tháng để xem từng khoản.</p>
      <YearCard table={table} />
      {newestFirst.map(i => (
        <MonthCard key={table.months[i].month} table={table} index={i} />
      ))}
    </section>
  );
}
```

Thẻ cả năm là con trực tiếp của `section`, cùng các thẻ tháng; đoạn "Đơn vị: đồng"
là `<p>` nên test đầu không đếm nó.

- [ ] **Bước 4: Gắn vào trang**

`app/admin/reports/pnl/page.tsx`: thêm import
`import { PnlMonthCards } from "./components/PnlMonthCards";` và một dòng ngay sau
`<PnlTableView table={table} />`:

```tsx
          <PnlMonthCards table={table} />
```

- [ ] **Bước 5: Chạy, thấy xanh; kiểm toàn bộ và lưu**

```bash
npx vitest run app/admin/reports/pnl/components
npx tsc --noEmit
npx vitest run
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
git checkout -- docs/generated/system-map.md
npm run build
git add app/admin/reports/pnl/components/PnlMonthCards.tsx app/admin/reports/pnl/components/PnlMonthCards.test.tsx \
  app/admin/reports/pnl/page.tsx
git commit -m "feat(reports): profit-and-loss month cards on a phone (BR-PNL-002)"
```

**Opus soát sau mục này:** đọc diff, rồi sang Mục 7.

## Mục 7 — Opus kiểm lần cuối (không giao agent)

Không viết code. Opus tự chạy, báo kết quả kèm mẫu số.

- [ ] `npx tsc --noEmit`, `npx vitest run`, `npm run build` xanh; số test xanh ghi rõ.
- [ ] `npx vite-node scripts/verify-cogs.ts` và `npx vite-node scripts/verify-pnl-monthly.ts`:
  0 lệch, ghi mẫu số (số tháng, số dòng).
- [ ] `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`
  xanh; `git checkout -- docs/generated/system-map.md`.
- [ ] Script đọc trong scratchpad gọi `computeProfitAndLoss` rồi `buildPnlTable` trên
  số thật năm 2026, in từng ô, so với bảng "Ví dụ bằng số thật" dưới đây. Ô nào khác
  thì tìm vì sao trước khi báo: số liệu mới phát sinh sau 11/09 là lý do hợp lệ, phải
  kể ra được là dòng nào.
- [ ] `git status` sạch ngoài các file đã lưu; không có gì chưa lưu dính vào lần đẩy.

## Ví dụ bằng số thật

Đo trên máy chủ thật ngày 11/09/2026, sau Mục 1, bằng một script chỉ đọc. Giả định
nhóm "Doanh thu ghi tay" (CFC-006) đã được đánh dấu "Tính là doanh thu bán hàng";
chưa đánh dấu thì dòng "· trong đó ghi tay" và 8.411.868 của tháng 4 không có, doanh
thu tháng 4 còn 2.190.000.

| Khoản | 03 | 04 | 05 | 06 | 07 | 08 | 09 (đến 11/09) | Tổng |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Doanh thu | 0 | 10.601.868 | 7.675.000 | 22.157.000 | 18.661.000 | 17.682.000 | 5.054.000 | 81.830.868 |
| · trong đó ghi tay | 0 | 8.411.868 | 0 | 0 | 0 | 0 | 0 | 8.411.868 |
| Giá vốn | 0 | 0 | 0 | 0 | 48.600 | 46.418.990 | 1.678.673 | 48.146.263 |
| Nguyên liệu mua dùng ngay | 0 | 506.597 | 216.060 | 3.418.727 | 2.891.814 | 1.760.000 | 360.000 | 9.153.198 |
| **Lợi nhuận gộp** | 0 | 10.095.271 | 7.458.940 | 18.738.273 | 15.720.586 | -30.496.990 | 3.015.327 | 24.531.407 |
| Vận hành | 0 | 540.000 | 0 | 470.000 | 275.000 | 615.000 | 1.057.000 | 2.957.000 |
| Điện, nước, gas | 0 | 0 | 0 | 470.000 | 470.000 | 470.000 | 470.000 | 1.880.000 |
| Marketing | 0 | 0 | 420.000 | 0 | 330.000 | 0 | 0 | 750.000 |
| Khấu hao | 49.226 | 319.593 | 573.470 | 598.475 | 982.045 | 790.974 | 790.974 | 4.104.757 |
| **Lợi nhuận ròng** | -49.226 | 9.235.678 | 6.465.470 | 17.199.798 | 13.663.541 | -32.372.964 | 697.353 | 14.839.650 |
| Biên lợi nhuận | --- | 87,11% | 84,24% | 77,63% | 73,22% | -183,08% | 13,80% | 18,13% |
| Cộng dồn từ đầu năm | -49.226 | 9.186.452 | 15.651.922 | 32.851.720 | 46.515.261 | 14.142.297 | 14.839.650 | |

- Không có dòng Hao hụt và Thu khác: cả năm đều 0.
- Cộng tay mọi dòng và mọi phép tính lợi nhuận đều khớp, nên trang không có ghi chú
  làm tròn. Ghi chú đó chỉ hiện khi có ô lệch (test 100,4 × 3 ở Mục 4).
- Giá vốn tháng 8 chính xác là 46.418.989,77; hiện 46.418.990. Trong đó 34.864.626,83
  (hiện 34.864.627) từ lần kiểm kho ngày 09/08/2026 (STK-001).
- Giá vốn tháng 9 chính xác là 1.678.673,40; hiện 1.678.673.

**Bốn ô tóm tắt:** Doanh thu từ đầu năm 81.830.868 · Lợi nhuận ròng từ đầu năm
14.839.650, biên 18,13% · Tháng lời nhất 06/2026, 17.199.798 · Tháng lỗ nhất 08/2026,
-32.372.964.

**Bấm ô Vận hành, tháng 08/2026 (615.000):** bốn dòng sổ thu chi.

| Ngày | Ghi chú | Số tiền |
|---|---|---:|
| 02/08/2026 | Dán lại xe Phin Đi | 300.000 |
| 26/08/2026 | Photo giấy bán khoai trứng | 35.000 |
| 31/08/2026 | Phin Đi - Gửi xe | 130.000 |
| 31/08/2026 | Uchako - Gửi xe | 150.000 |

**Bấm ô Lợi nhuận ròng, tháng 08/2026:** "Lợi nhuận gộp -30.496.990 − chi phí
1.085.000 − khấu hao 790.974 = -32.372.964".

**Ghi chú dưới bảng**, theo thứ tự:
1. Doanh thu tháng 04/2026 có 8.411.868đ ghi tay trong sổ thu chi, không qua máy bán hàng.
2. Giá vốn tháng 08/2026 có 34.864.627đ từ lần kiểm kho ngày 09/08/2026: hàng đã dùng
   mà chưa ghi phiếu xuất, không tính là hao hụt.
3. Doanh thu tháng 04/2026, 05/2026, 06/2026, 07/2026 có phần bán trước ngày
   20/07/2026, ngày bắt đầu có sổ tiền nhận, nên phần đó không có sổ tiền để đối chiếu.

**Khác bảng mẫu trong đặc tả, và vì sao:**
- Khấu hao từng tháng thấp hơn bảng mẫu vài đồng (tháng 4: 319.593 thay vì 319.595):
  bảng mẫu làm tròn lên từng dụng cụ theo luật cũ; nay cộng số chính xác rồi mới làm
  tròn (`BR-DATA-005`, 11/09/2026).
- Giá vốn tháng 9 là 1.678.673 thay vì 1.678.674: cùng lý do, số chính xác là
  1.678.673,40, luật cũ làm tròn lên.
- Lợi nhuận gộp tháng 6 thấp hơn 980.000 (18.738.273 thay vì 19.718.273): đơn đá viên
  PO-176 ngày 30/06 vào "Nguyên liệu mua dùng ngay"; bảng mẫu đo trước khi có đơn này.

## Thứ tự đưa lên, mỗi bước chủ quán duyệt riêng

1. **Chạy migration `0102` lên máy chủ thật** (thêm cột "tính là doanh thu bán hàng"
   cho nhóm thu chi). Phải trước khi đẩy code: code mới đọc cột này, thiếu cột thì
   màn nhóm thu chi và trang lãi lỗ báo lỗi. Cột thêm vào mặc định "không", nên máy
   bán hàng và code cũ đang chạy không bị ảnh hưởng.
2. **Đẩy code.**
3. **Chủ quán tự làm và mở xem:**
   - Vào Thu chi → Nhóm thu chi, sửa "Doanh thu ghi tay", tích "Tính là doanh thu bán
     hàng", lưu.
   - Mở Báo cáo → Lãi lỗ trên máy tính: doanh thu tháng 4 phải là 10.601.868; bấm ô
     Vận hành tháng 08/2026 thấy bốn dòng như bảng trên.
   - Mở cùng trang trên điện thoại: thẻ tháng 09/2026 trên cùng; mở thẻ 08/2026, bấm
     Vận hành thấy cùng bốn dòng.
