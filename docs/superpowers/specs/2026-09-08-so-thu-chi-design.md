# Sổ thu chi — đặc tả

Ngày: 2026-09-08. Chốt với chủ quán trong phiên cùng ngày.

## Vì sao làm

Chủ quán đang ghi tay các khoản chi vận hành trong Google Sheet
"Beverages CCDC - Phin Đi & Uchako". App không có chỗ nào chứa chúng, nên
không thể ra báo cáo lãi lỗ thật.

## Hiện trạng đo được (2026-09-08)

- 41 bảng đang sống. Không bảng nào chứa chi vận hành, điện nước gas,
  marketing, thu khác, hay vốn góp.
- App đã có: tiền bán hàng vào (đơn hàng), tiền mua hàng ra (phiếu nhập),
  giá vốn (phiếu xuất kho), khấu hao (`lib/assets/`). Bốn thứ này **không**
  làm lại.
- Màn hình báo cáo hiện có: `app/admin/reports/daily`,
  `app/admin/reports/issued`, `app/admin/reports/sales`. Chưa có lãi lỗ.
- Google Sheet của chủ quán: 120 dòng EX/IN từ 27/03/2026 (116 dòng chi, 4 dòng thu và vốn).
  66 dòng là tiền mua hàng, dòng nào cũng nối sang một phiếu nhập —
  app đã có. Còn lại 54 dòng app chưa có: 33 Vận hành, 12 Điện, nước, gas,
  5 Marketing, 2 Thu khác, 2 Vốn góp.

Đã xem: `types/db.ts`, `supabase/migrations/0001_init_schema.sql`,
`lib/shared/nav-completeness.ts`, ba màn hình báo cáo, file Google Sheet.
Chưa xem: `app/admin/reports/*/actions.ts` (chưa cần, đợt này không đụng
báo cáo).

## Phạm vi

Trong đợt này:

- Bảng nhóm chi, chủ quán tự thêm sửa.
- Bảng sổ thu chi.
- Một màn hình nhập liệu, một màn hình quản lý nhóm chi.
- Nạp 54 dòng cũ từ Google Sheet.

Cố ý để ngoài, sẽ làm đợt sau:

- Báo cáo lãi lỗ và báo cáo dòng tiền.
- Sổ kế toán, khoá sổ, bút toán điều chỉnh. Chủ quán đã bác hướng này
  ngày 2026-09-08: "khoan làm tới kế toán". Nếu sau này làm, phải theo
  Luật Kế toán 88/2015/QH13 Điều 27 khoản 4 — sổ điện tử chỉ được sửa
  bằng cách ghi điều chỉnh.
- Nối dòng sổ với đơn bán hàng và phiếu nhập. Đợt này hai nguồn nằm riêng.

## Bảng 1 — `expense_categories`

Nhóm chi. Tồn tại để chủ quán tự thêm nhóm mà không cần sửa code.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | text, khoá chính | `EXC-` + 3 số, theo lối `PROD-001` sẵn có |
| `name` | text, không rỗng | duy nhất trong các dòng chưa xoá |
| `status` | text | `ACTIVE` / `INACTIVE` / `DELETED`, mặc định `ACTIVE` |
| `created_at` | timestamptz | mặc định `now()` |

Nạp sẵn ba nhóm, tên giữ y như trong Sheet: Vận hành; Điện, nước, gas; Marketing.

Không xoá hẳn một nhóm đã có dòng chi. Khoá ngoại đặt `RESTRICT`; muốn
bỏ thì đánh dấu `INACTIVE`, dòng cũ giữ nguyên nhóm của nó.

## Bảng 2 — `cash_entries`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | text, khoá chính | `CE-` + 3 số |
| `entry_date` | date | ngày tiền thật sự ra vào |
| `direction` | text | `EXPENSE` / `OTHER_INCOME` / `CAPITAL` |
| `category_id` | text, cho rỗng | khoá ngoại `expense_categories`, `RESTRICT` |
| `amount` | bigint | đồng, luôn dương; tiền âm không hợp lệ |
| `payment_method` | text | `CASH` / `BANK_TRANSFER` |
| `payer` | text | người chi; Sheet đang ghi `FNB` hoặc `Sanh` |
| `note` | text, cho rỗng | |
| `status` | text | `ACTIVE` / `DELETED`, mặc định `ACTIVE` |
| `created_at` | timestamptz | mặc định `now()` |

Ràng buộc: `direction = 'EXPENSE'` thì bắt buộc có `category_id`;
hai loại còn lại bắt buộc để rỗng. Nhóm chi chỉ có nghĩa với khoản chi.

Tiền để `bigint` theo lối `purchase_orders.total_amount` sẵn có — đồng
Việt Nam không có phần lẻ.

## Màn hình

`app/admin/finance` — sổ thu chi:

- Lọc theo tháng, mặc định tháng hiện tại.
- Bảng: ngày, loại, nhóm chi, số tiền, cách trả, người chi, ghi chú.
- Ba số tổng tách riêng ở đầu: tổng chi, tổng thu khác, tổng vốn góp.
  Không cộng ba số này lại — chúng là ba thứ khác nhau.
- Nút thêm, sửa, xoá. Xoá là đánh dấu `DELETED`, không mất dòng.

`app/admin/finance/categories` — nhóm chi: danh sách, thêm, đổi tên,
đánh dấu ngừng dùng.

Cả hai màn hình dựng hai bố cục: máy tính bảng ngang, điện thoại thẻ dọc.
Theo `.claude/rules/ui-devices.md`.

Phải gắn lối vào menu, nếu không `lib/shared/nav-completeness.ts` báo đỏ.

## Vốn góp không phải doanh thu

Dòng `CAPITAL` là tiền chủ quán bỏ vào, không phải tiền quán kiếm được.
Khi làm báo cáo lãi lỗ, loại nó ra. Đợt này app chưa có báo cáo nào, nên
32.066.807đ ngày 27/03/2026 và 1.472.000đ ngày 26/08/2026 chỉ nằm trong
danh sách và cộng riêng một ô.

## Ví dụ bằng số thật

Nạp xong 54 dòng, mở màn hình lọc tháng 07/2026 phải thấy đúng con số
trong bảng PNL chủ quán tự tính:

| Nhóm | Số tiền |
|---|---|
| Điện, nước, gas | 470.000đ |
| Vận hành | 1.371.000đ |
| Marketing | 330.000đ |
| **Tổng chi tháng 7** | **2.171.000đ** |

Tháng 07/2026 không có dòng Thu khác và không có dòng Vốn góp, nên hai ô
đó bằng 0.

Đối chiếu: bảng PNL của chủ quán ghi tổng chi phí tháng 7 là 3.391.959đ —
số đó đã cộng cả 1.220.959đ khấu hao. Khấu hao app tự tính, không nằm
trong sổ thu chi, nên hai con số lệch nhau đúng bằng phần khấu hao.

## Nạp 54 dòng cũ

Dùng skill `fnbapp-bulk-data-change`. Mặc định chạy thử, in ra đủ 54 dòng
kèm tổng từng tháng để chủ quán soi; có `--apply` mới ghi thật. Ghi thật
là việc phải chủ quán duyệt riêng.

## Câu chưa trả lời, để lại cho đợt sau

- Bảng PNL của chủ quán dồn hết giá vốn vào tháng 8 (46.418.990đ) vì lần
  kiểm kho đầu tiên rơi vào tháng đó, làm tháng 8 lỗ gộp 28,7 triệu còn
  các tháng trước lãi gộp 100%. Không phải lỗi nhập liệu. Xử lý khi làm
  báo cáo lãi lỗ.
- Ngưỡng doanh thu không phải nộp thuế của hộ kinh doanh: một nguồn ghi
  500 triệu/năm, một nguồn ghi 1 tỷ/năm. Chưa tra ra bên nào đúng. Phải
  chốt trước khi làm báo cáo phục vụ khai thuế.
- Hai bảng tổng trong Sheet của chủ quán không khớp nhau ở tháng 7: khối
  PNL ghi chi phí 3.391.959đ (đúng bằng 2.171.000đ ba nhóm cộng
  1.220.959đ khấu hao), còn khối Cashflow ghi "Chi khác" 2.911.000đ —
  dư 740.000đ không tìm thấy trong các dòng sổ tháng 7. Khối PNL khớp
  với sổ, khối Cashflow không. Nói trước để lúc nạp xong chủ quán không
  tưởng app tính sai.
