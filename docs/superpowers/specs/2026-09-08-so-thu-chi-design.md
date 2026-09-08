# Sổ thu chi — đặc tả

Ngày: 2026-09-08. Chốt với chủ quán trong phiên cùng ngày, bản này đã sửa
theo góp ý vòng hai của chủ quán.

## Vì sao làm

Chủ quán đang ghi tay các khoản thu chi trong Google Sheet
"Beverages CCDC - Phin Đi & Uchako". App không có chỗ nào chứa chúng, nên
không thể ra báo cáo lãi lỗ thật.

## Hiện trạng đo được (2026-09-08)

- 41 bảng đang sống. Không bảng nào chứa chi vận hành, điện nước gas,
  marketing, thu ngoài bán hàng, hay vốn góp.
- App đã có: tiền bán hàng vào (đơn hàng), tiền mua hàng ra (phiếu nhập),
  giá vốn (phiếu xuất kho), khấu hao (`lib/assets/`). Bốn thứ này **không**
  làm lại.
- App đã có người dùng và phân quyền: `lib/auth/auth.ts` có bốn vai
  `ADMIN`, `MANAGER`, `STAFF`, `SYSTEM`, và hàm chặn riêng cho `ADMIN`.
  Hiện chỉ có đúng một tài khoản `ADMIN`.
- Màn hình báo cáo hiện có: `app/admin/reports/daily`,
  `app/admin/reports/issued`, `app/admin/reports/sales`. Chưa có lãi lỗ.
- Google Sheet của chủ quán: 120 dòng thu chi từ 27/03/2026. 66 dòng nối
  sang một phiếu nhập — app đã có. Còn **54 dòng** app chưa có: 33 Vận
  hành, 12 Điện nước gas, 5 Marketing, 2 Thu, 2 Vốn góp.

Đã xem: `types/db.ts`, `supabase/migrations/0001_init_schema.sql`,
`lib/auth/auth.ts`, `lib/shared/nav-completeness.ts`, ba màn hình báo cáo,
file Google Sheet. Chưa xem: `app/admin/reports/*/actions.ts`.

## Phạm vi

Trong đợt này:

- Bảng nhóm thu chi, chủ quán tự thêm sửa.
- Bảng tài khoản ngân hàng.
- Bảng sổ thu chi.
- Màn hình nhập sổ, màn hình nhóm thu chi, màn hình tài khoản.
- Bộ lọc thời gian dùng chung, dựng một lần, dùng ngay ở màn hình mới.
- Nạp 54 dòng cũ từ Google Sheet.

Cố ý để ngoài:

- Báo cáo lãi lỗ và báo cáo dòng tiền.
- Sổ kế toán, khoá sổ, bút toán điều chỉnh. Chủ quán đã bác ngày
  2026-09-08: "khoan làm tới kế toán".
- Nối dòng sổ với đơn bán hàng và phiếu nhập.
- Gắn bộ lọc thời gian mới vào ba màn hình báo cáo đang chạy. Việc đó là
  một kế hoạch riêng — xem mục bộ lọc.

## Tiếng Việt và tiếng Anh

Mọi chữ chủ quán nhìn thấy đều tiếng Việt: Chi, Thu, Vốn góp, Tiền mặt,
Chuyển khoản, Đang dùng, Đã huỷ. Tên bảng và tên cột trong máy giữ tiếng
Anh, theo luật chủ quán đã đặt trong `CLAUDE.md` mục "Viết code". Chỗ nào
máy dùng chữ khác chữ trên màn hình thì có bảng dịch ngay dưới bảng đó.

## Bảng 1 — `cash_categories` (nhóm thu chi)

Không chỉ nhóm chi. Chủ quán đã nói rõ bên Thu sau này cũng có nhóm, nên
bảng này giữ cả hai bên.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | text, khoá chính | `CFC-` + 3 số |
| `name` | text, không rỗng | duy nhất trong các dòng đang dùng |
| `kind` | text | `EXPENSE` = Chi, `INCOME` = Thu |
| `affects_pnl` | boolean | có tính vào lãi lỗ hay không |
| `status` | text | `ACTIVE` = Đang dùng, `INACTIVE` = Ngừng dùng |
| `created_at` | timestamptz | |

`affects_pnl` có mặt vì chủ quán nói rõ: bên Thu sẽ có nhiều khoản không
phải doanh thu, giờ chưa liệt kê hết được. Vốn góp là khoản đầu tiên như
vậy — tiền vào nhưng không phải quán kiếm được. Có sẵn cờ này thì sau
này thêm một nhóm thu không phải doanh thu chỉ là thêm một dòng, không
phải sửa code.

Nạp sẵn năm nhóm:

| Tên | Bên | Vào lãi lỗ |
|---|---|---|
| Vận hành | Chi | có |
| Điện, nước, gas | Chi | có |
| Marketing | Chi | có |
| Thu khác | Thu | có |
| Vốn góp | Thu | không |

Nhóm đã có dòng sổ thì không xoá được: khoá ngoại đặt `RESTRICT`. Muốn bỏ
thì chuyển sang Ngừng dùng — dòng cũ giữ nguyên nhóm của nó, ô chọn lúc
nhập mới không còn thấy nó.

## Bảng 2 — `bank_accounts` (tài khoản ngân hàng)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | text, khoá chính | `BA-` + 3 số |
| `name` | text, không rỗng | tên gợi nhớ, ví dụ "Vietcombank Sanh" |
| `bank_name` | text | tên ngân hàng |
| `account_number` | text | số tài khoản |
| `status` | text | `ACTIVE` / `INACTIVE` |
| `created_at` | timestamptz | |

Là bảng chứ không phải ô gõ tay, vì lý do y hệt nhóm thu chi: gõ tay thì
"Vietcombank" và "VCB" thành hai tài khoản khác nhau trong báo cáo mà
không ai thấy.

## Bảng 3 — `cash_entries` (sổ thu chi)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | text, khoá chính | `CE-` + 3 số |
| `entry_date` | date | ngày tiền thật sự ra vào |
| `category_id` | text, bắt buộc | khoá ngoại `cash_categories`, `RESTRICT` |
| `amount` | bigint | đồng, luôn dương |
| `payment_method` | text | `CASH` = Tiền mặt, `BANK_TRANSFER` = Chuyển khoản |
| `bank_account_id` | text, cho rỗng | khoá ngoại `bank_accounts`, `RESTRICT` |
| `payer` | text, cho rỗng | người chi; đợt này để trống, chưa dùng tới |
| `note` | text, cho rỗng | |
| `status` | text | `ACTIVE` = Đang dùng, `CANCELLED` = Đã huỷ |
| `created_by` | text | khoá ngoại `users`, người tạo dòng |
| `created_at` | timestamptz | ngày tạo |
| `updated_at` | timestamptz | ngày điều chỉnh gần nhất |

Không có cột "thu hay chi". Nhóm đã biết nó thuộc bên nào, thêm một cột
nữa là mở đường cho hai chỗ nói ngược nhau.

Hai ràng buộc máy tự canh:

- `payment_method = 'BANK_TRANSFER'` thì bắt buộc có `bank_account_id`.
- `payment_method = 'CASH'` thì `bank_account_id` bắt buộc rỗng.

## Huỷ và xoá

Chủ quán chốt ngày 2026-09-08: sổ này không dùng trạng thái "đã xoá".

- **Huỷ**: dòng vẫn nằm đó, hiện chữ "Đã huỷ", không cộng vào tổng nào.
  Ai cũng huỷ được. Đây là cách sửa sai thông thường.
- **Xoá**: mất hẳn khỏi máy, không lấy lại được. Chỉ vai `ADMIN` thấy nút
  này, và máy chặn ở phía máy chủ chứ không chỉ giấu nút trên màn hình.

Đây là ngoại lệ so với `CLAUDE.md` mục "Luật dữ liệu" — luật đó cấm xoá
hẳn nguyên liệu, món, đơn, nhà cung cấp. Sổ thu chi không nằm trong bốn
thứ đó, và chủ quán quyết định như vậy. Phải ghi vào
`docs/02-rules/business-rules/` kèm ngày trong cùng đợt code.

## Màn hình

`app/admin/finance` — sổ thu chi:

- Bộ lọc thời gian ở đầu trang.
- Bảng: ngày, nhóm, bên thu hay chi, số tiền, cách trả, tài khoản, ghi
  chú, người tạo, trạng thái.
- Hai số tổng tách riêng: tổng thu, tổng chi. Không cộng hai số lại.
  Trong tổng thu, phần không tính vào lãi lỗ hiện thành một dòng riêng.
- Dòng đã huỷ hiện mờ, không vào tổng.
- Nút thêm, sửa, huỷ. Nút xoá chỉ hiện với `ADMIN`.
- Ô tài khoản chỉ hiện khi chọn Chuyển khoản. Chọn Tiền mặt thì ô đó biến
  mất hẳn, không hiện rồi khoá.

`app/admin/finance/categories` — nhóm thu chi: danh sách, thêm, đổi tên,
chọn bên thu hay chi, bật tắt "tính vào lãi lỗ", ngừng dùng.

`app/admin/finance/bank-accounts` — tài khoản: danh sách, thêm, sửa,
ngừng dùng.

Cả ba màn hình dựng hai bố cục: máy tính bảng ngang, điện thoại thẻ dọc.
Theo `.claude/rules/ui-devices.md`. Phải gắn lối vào menu, nếu không
`lib/shared/nav-completeness.ts` báo đỏ.

## Bộ lọc thời gian dùng chung

Chủ quán yêu cầu bộ lọc kiểu Looker Studio và muốn dùng lại cho mọi trang
khác. Dựng thành một component dùng chung, không nhét riêng vào màn hình
sổ.

Ô chọn xổ xuống, các lựa chọn sẵn:

- Hôm nay · Hôm qua
- 7 ngày qua · 28 ngày qua · 30 ngày qua
- Tuần này · Tuần trước
- Tháng này · Tháng trước
- Quý này · Quý trước
- Năm nay · Năm trước
- Từ đầu tháng đến nay · Từ đầu năm đến nay
- Tuỳ chọn: tự chọn ngày đầu và ngày cuối trên lịch

Mặc định của màn hình sổ: Tháng này. Mọi mốc tính theo giờ Sài Gòn.
Khoảng đang chọn hiện thành chữ ngay cạnh ô, ví dụ
"01/09/2026 – 08/09/2026", để không phải đoán.

Đợt này chỉ dựng component và dùng ở màn hình sổ. Gắn nó vào ba màn hình
báo cáo đang chạy là một kế hoạch riêng, làm sau khi component đã chạy
thật ít nhất một màn hình. Đổi bộ lọc của báo cáo đang dùng hằng ngày mà
gộp chung vào đợt này thì hỏng một cái là hỏng cả hai.

## Ví dụ bằng số thật

Nạp xong 54 dòng, mở màn hình chọn tháng 07/2026 phải ra:

| Nhóm | Số tiền |
|---|---|
| Điện, nước, gas | 470.000đ |
| Vận hành | 1.371.000đ |
| Marketing | 330.000đ |
| **Tổng chi tháng 7** | **2.171.000đ** |

Tháng 07/2026 không có dòng bên Thu, nên tổng thu bằng 0.

Con số này lấy từ chính các dòng sổ trong Sheet, không lấy từ bảng tổng
của Sheet. Không đem so với khấu hao: bảng của chủ quán rải khấu hao đều
12 tháng, app tính theo thời hạn từng tài sản, hai cách khác nhau nên hai
số phải khác nhau.

## Nạp 54 dòng cũ

Dùng skill `fnbapp-bulk-data-change`. Mặc định chạy thử, in ra đủ 54 dòng
kèm tổng từng tháng để chủ quán soi; có `--apply` mới ghi thật. Ghi thật
là việc phải chủ quán duyệt riêng.

Người tạo của 54 dòng cũ đặt là tài khoản `ADMIN`; ngày ghi sổ lấy đúng
ngày trong Sheet.

## Câu chưa trả lời, để lại cho đợt sau

- Bảng lãi lỗ của chủ quán dồn hết giá vốn vào tháng 8 (46.418.990đ) vì
  lần kiểm kho đầu tiên rơi vào tháng đó, làm tháng 8 lỗ gộp 28,7 triệu
  còn các tháng trước lãi gộp 100%. Không phải lỗi nhập liệu. Xử lý khi
  làm báo cáo lãi lỗ.
- Ngưỡng doanh thu không phải nộp thuế của hộ kinh doanh: một nguồn ghi
  500 triệu/năm, một nguồn ghi 1 tỷ/năm. Chưa tra ra bên nào đúng. Phải
  chốt trước khi làm báo cáo phục vụ khai thuế.
- Có cần lưu tên người điều chỉnh không. Đợt này lưu ngày điều chỉnh,
  chưa lưu tên người sửa.
