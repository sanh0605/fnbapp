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
- **Sổ tiền nhận** (`order_payments`) bắt đầu 2026-07-19.
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
- Số tiền hiển thị: dấu chấm ngăn nghìn (`formatNumber` ở `lib/shared/format.ts`),
  kèm "đ". Số âm có dấu trừ và màu `text-danger`.

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
| `app/admin/reports/pnl/components/*.tsx` | 5, 6 | chọn năm, ô tóm tắt, biểu đồ, bảng, thẻ điện thoại |

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

<!-- PLAN-CONTINUES -->
