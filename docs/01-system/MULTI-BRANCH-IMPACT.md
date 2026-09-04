# Thêm một chi nhánh thì đụng tới đâu

Đây **không phải** bản thiết kế đa chi nhánh — đó vẫn là quyết định chưa chốt
`BR-U-002` trong `docs/02-rules/business-rules/unresolved.md`. Tài liệu này chỉ
chụp lại **hiện trạng mã nguồn**: khi ai đó nói "thêm một chi nhánh", câu đó có
thể mang hai nghĩa rất khác nhau, và mỗi nghĩa đụng vào một tập file khác nhau.
Đọc nền chung ở `docs/01-system/SYSTEM-OVERVIEW.md` (mục "Kho dùng chung").

## Hai nghĩa của "thêm một chi nhánh"

- **(a) Thêm một điểm bán mới, dùng chung kho hiện có** — giống việc quán đã
  làm khi mở điểm bán thứ hai: vẫn một kho nguyên liệu duy nhất, chỉ thêm nơi
  bán hàng và một thương hiệu gắn với nó.
- **(b) Thêm một chi nhánh có kho tồn riêng** — chi nhánh đó tự mua hàng, tự
  giữ tồn, giá vốn tính riêng, không gộp chung với kho hiện tại.

Hai việc này khác nhau hoàn toàn về độ lớn: (a) phần lớn là **thêm dữ liệu**,
hệ thống đã có sẵn chỗ chứa; (b) là **một dự án đổi cấu trúc bảng**, vì lớp tồn
kho/giá vốn hiện không có khái niệm "thuộc chi nhánh nào".

## Case (a) — thêm điểm bán dùng chung kho: phần lớn đã có sẵn

Lớp bán hàng/đơn hàng/báo cáo hiện đã mang theo điểm bán (`BR-SALE-006`). Không
tìm thấy số điểm bán nào bị gắn cứng trong `app/` hay `lib/` — số lượng điểm bán
là dữ liệu, không phải hằng số trong code.

| Việc cần làm | Vì sao đã sẵn sàng |
|---|---|
| Thêm một dòng vào bảng `outlets` | Bảng đã tồn tại (`supabase/migrations/0071_outlets.sql`), không giới hạn số dòng |
| Thêm một dòng vào bảng `brands` nếu chi nhánh mới dùng thương hiệu riêng | Bảng đã tồn tại (`supabase/migrations/0001_init_schema.sql`); mỗi điểm bán đã có sẵn cột `brand_id` |
| Máy bán hàng (POS) chọn đúng điểm bán | `app/pos/page.tsx` đọc `outletId` từ đường dẫn, tự suy ra `brand_id` từ chính điểm bán đó — không hỏi lại người bán |
| Mã đơn hàng không trùng giữa các điểm bán | Mã đơn ghép từ điểm bán + ngày + số thứ tự riêng theo từng điểm bán (`BR-SALE-006`), nên thêm điểm bán không phá cách đánh số cũ |
| Báo cáo doanh thu tách theo điểm bán | `app/admin/reports/sales/OutletBreakdownSection.tsx` đã đọc dữ liệu theo từng `outlet_id`, tự thêm dòng khi có điểm bán mới, không cần sửa code |

Cột nền cho việc này: `orders_v2.outlet_id` (bắt buộc phải có, thêm ở
`supabase/migrations/0071_outlets.sql`, khoá chặt thành bắt buộc ở
`supabase/migrations/0072_outlet_order_no_minting.sql`) và `orders_v2.brand_id`
(có từ `supabase/migrations/0001_init_schema.sql`, còn sớm hơn khái niệm điểm
bán rất nhiều).

## Case (b) — chi nhánh có kho riêng: một dự án đổi cấu trúc bảng

Toàn bộ lớp tồn kho và giá vốn hiện là **một kho duy nhất cho cả quán**, không
có cột nào phân theo điểm bán hay chi nhánh. Đây là phần `BR-U-002` chưa chốt —
tài liệu này chỉ liệt kê nơi phải sửa nếu sau này chốt làm, **không đề xuất
cách sửa**.

Sáu bảng sau được kiểm lại từng câu lệnh tạo bảng và mọi câu lệnh sửa bảng
trong `supabase/migrations/`: không bảng nào có cột `outlet_id`.

| Bảng | Tạo ở | Vai trò |
|---|---|---|
| `stock_issues` | `supabase/migrations/0052_stock_issues.sql` | Phiếu xuất kho |
| `purchased_items` | `supabase/migrations/0001_init_schema.sql` | Dòng hàng đã mua |
| `stocktake_sessions` | `supabase/migrations/0036_stocktake_sessions.sql` | Kỳ kiểm kê |
| `stocktake_lines` | `supabase/migrations/0036_stocktake_sessions.sql` | Dòng kiểm kê từng nguyên liệu |
| `stock_adjustments` | `supabase/migrations/0001_init_schema.sql` | Điều chỉnh tồn kho |
| `issue_slips` | `supabase/migrations/0060_issue_slip_multiline.sql` | Phiếu xuất nhiều dòng |

Hai file tính giá vốn cũng không biết tới khái niệm điểm bán/chi nhánh —
`lib/issue-costing.ts` và `lib/issue-costing-inputs.ts` tính bình quân gia
quyền trên toàn bộ kho, không lọc theo nơi bán.

Muốn tách kho theo chi nhánh, sáu bảng trên và hai file tính giá vốn này đều
cần thêm một chiều "thuộc chi nhánh nào" — cộng với việc xem lại chính câu
chính sách "kho dùng chung" đang nêu ở `docs/01-system/SYSTEM-OVERVIEW.md` (mục
"Kho dùng chung"). Đây đúng là quy mô của `BR-U-002`, không phải một việc sửa
nhỏ.

## Chưa phân theo điểm bán, cũng chưa thuộc phạm vi tài liệu này

- **Tài khoản/nhân sự** — chưa có cơ chế gán một nhân viên vào một điểm bán cụ
  thể (`BR-SALE-006` ghi nhận việc này chưa làm).
- **Phân quyền theo vai trò** — bảng quyền cuối cùng còn chưa chốt, thuộc
  `BR-U-003` trong `docs/02-rules/business-rules/unresolved.md`.

## Tóm lại

Mở thêm một điểm bán bán hàng, dùng chung kho — hệ thống đã làm được, chỉ cần
thêm dữ liệu như bảng ở case (a). Mở một chi nhánh có kho và giá vốn riêng là
việc khác hẳn: cần đổi cấu trúc sáu bảng và hai file tính giá vốn ở case (b),
và quyết định làm hay không, làm theo cách nào, vẫn đang chờ ở `BR-U-002`.
