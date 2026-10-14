# Soát toàn bộ dự án 2026-10-14 — kế hoạch xử lý

Chủ quán yêu cầu 2026-10-14: *"chia ra nhiều subagent để audit lại toàn bộ dự án… cho anh kế hoạch và
giải pháp xử lý… dùng skill ponytail để làm gọn file hoặc dọn bớt những gì đã cũ"*.
Sáu trợ lý Opus soát sáu mảng theo `ponytail-audit`, chỉ đọc: kho và giá vốn; bán hàng và máy bán
hàng; sổ thu chi, báo cáo, Tổng quan; bảo mật; món và khung màn hình chung; tài liệu, script, phép
thử. Opus kiểm lại các mục "phải sửa" trước khi đưa vào đây. Kế hoạch con này xoá khi xong các đợt.

## Hiện trạng

1. Trạng thái: không áp dụng, vì đây là danh sách việc sửa, không thêm thứ gì có trạng thái mới.
2. Nút: chỉ đổi nút có sẵn — ba nút thanh toán ở máy bán hàng (C1, chờ quyết), nút "Sửa phiếu nhập"
   với quản lý (A8), nút "Xoá vĩnh viễn" món topping (F3), nút thêm/xoá size món topping (F6).
3. Danh sách: "Chọn điểm bán" bỏ điểm đã ngừng (F1); danh sách người trong Nhật ký lấy từ Nhân sự (B5).
4. Ô nhập: số lượng món phải là số nguyên dương ở máy chủ (C13); vai chỉ nhận STAFF/MANAGER/ADMIN
   (E3); mật khẩu ít nhất 6 ký tự ở máy chủ (E6).
5. Dữ liệu: phục vụ dữ liệu thật hiện có; cố ý không đổi cách tính tiền nào khi chủ quán chưa chốt.

Đo trên máy chủ 2026-10-14, chỉ đọc: 3.414 đơn hoàn tất, 0 đơn không có cách trả, 0 đơn hoàn tất bị
thay, 2 đơn trả hai cách; 2 khuyến mãi đang chạy (PRM-003 đồng giá 15.000, PRM-004 giảm 10.000), cả
hai giảm theo món, không mã, giá từng size bằng giá chung; 48 món, 0 món có ảnh; 2 điểm bán đều đang
hoạt động. Nên C3, C4, F2, F1, B8 chưa làm sai đơn nào — sửa để chặn trước.

## Đã sửa ngay trong phiên (2026-10-14)

| Mã | Việc | Lưu |
|---|---|---|
| E1 | Doanh số gửi mã băm mật khẩu của mọi tài khoản xuống trình duyệt | `4965976d` |
| E5 | Hàm thay đơn hàng là cổng công khai không hỏi đăng nhập; thêm phép canh `lib/` | `4965976d` |
| A9 | Thẻ kiểm kê và trang phiếu kiểm kê không có đơn vị | `3f99d821` |
| E3, E4, E7, E8, E10–E12, C13 | Nhóm bảo mật đợt 1 (xem bảng dưới) | `d1565186` |
| A1, A3a, A3b, A6 (một phần), A7, A8, E2, F1–F3, F6–F8, B1, B2, B4, B5, C2, C6, C7 | Đợt 1 phần còn lại; migration 0111, 0112, 0114 đã chạy trên máy chủ 14/10 (chủ quán duyệt "Chạy cả 3"); A6 chưa gộp một hàm Postgres | `6041c021` |
| A2, A3b (đơn mới), A4, A5, E9, B10–B12 | Kiểm kê tính lại sổ theo giờ đếm; chặn phiếu nhập mới trước kiểm kê; khung khấu hao lưu cả bảng; bỏ ô "cập nhật lịch sử"; gỡ quyền thừa; Doanh số đọc Loại món, chữ Việt. Migration 0115–0118 đã chạy trên máy chủ 14/10 (chủ quán duyệt "Chạy cả 4") | `e730c9be`, `3b9a68ca` |
| B3, B9 (câu 7) | Lọc Nhóm SP ở Doanh số tạm ẩn khối tiền cả đơn (chủ quán "Tạm ẩn khi lọc"); Luỹ kế cộng từ tháng đầu khoảng đang xem (chủ quán, máy vốn đã làm vậy, chỉ sửa luật) | `7eb7c030` |

## Đợt 1 — lỗi kỹ thuật, không cần chủ quán quyết (làm ngay, theo thứ tự)

Mỗi mục: viết phép thử đỏ trước, rồi sửa. Backend → Sonnet; giao diện → Gemini.

| Mã | Lỗi (ví dụ cụ thể ở báo cáo gốc) | Sửa gọn nhất | Ai |
|---|---|---|---|
| A1 | Hoàn tác kiểm kê có hàng dư có thể đẩy tồn âm → Lãi lỗ, Hàng đã xuất, Phiếu xuất không mở được | Kiểm `issue_stock_headroom` từng dòng hoàn tác dương (migration mới) | Sonnet |
| A3a | Sửa phiếu nhập đã hoàn tất (giảm số, đổi ngày) có thể đẩy tồn âm → ba trang trên sập | Chạy cùng phép kiểm của Huỷ phiếu nhập trong `save_purchase_order_atomic` | Sonnet |
| A8 | Quản lý gọi thẳng được lệnh sửa phiếu nhập đã hoàn tất | Sửa phiếu hoàn tất chỉ ADMIN ở máy chủ | Sonnet |
| A6 | Lưu hàng hoá lưu một nửa rồi mới báo lỗi | Đưa mọi phép từ chối lên trước lần ghi đầu | Sonnet |
| A7 | Tài sản ghi ngoài hàm lưu phiếu nhập | Đưa vào cùng hàm Postgres | Sonnet |
| A5 | Ô "cập nhật lịch sử" ở Quy đổi đổi nhầm tên đơn vị của dòng nhập cũ | Bỏ ô và nhánh đó | Sonnet + Gemini |
| A4 | Khung khấu hao không thêm/xoá/dời mốc được (BR-COGS-008 hứa được) | Một lệnh lưu cả bảng + một trang sửa | Sonnet + Gemini |
| E3 | Máy chủ nhận vai bất kỳ (kể cả SYSTEM); có thể hạ vai chủ quán cuối cùng | Chỉ nhận 3 vai; chặn hạ ADMIN cuối | Sonnet |
| E4 | Tài khoản đã xoá/hạ vai vẫn dùng tiếp tới 30 ngày | Mỗi lần gọi đọc lại vai từ bảng Users | Sonnet |
| E7 | Một biến môi trường `CLI_MODE` tắt đăng nhập toàn ứng dụng | Chỉ nhận khi không chạy trong máy chủ web | Sonnet |
| E8 | Không có phép canh "mọi lệnh máy chủ phải hỏi quyền" | Một phép thử quét mọi file `"use server"` | Sonnet |
| E10–E12 | Nhật ký đăng nhập ghi chữ gõ vào ô tên; bản tập phục hồi in mã băm; Sửa đơn đọc trước khi hỏi quyền | Mỗi chỗ một dòng | Sonnet |
| C13 | Máy chủ nhận số lượng âm → đơn âm, doanh thu tụt | Số lượng nguyên dương, giảm giá món ≥ 0 | Sonnet |
| C7 | Nạp đơn nháp khi giỏ đang có món có thể xoá nhầm nháp → thu tiền hai lần | Chờ lưu nháp xong rồi mới nạp | Gemini |
| C6 | Nút nhập mã khuyến mãi theo món bị lỗi, mã không áp | Đọc đúng dạng bảng size → giá | Gemini |
| C2 | Đơn chờ trên máy bán chỉ gửi lại khi trình duyệt báo "có mạng" hoặc tải lại | Gửi lại mỗi 60 giây + sau mỗi đơn + hiện số đơn chờ | Gemini |
| F1 | Điểm bán đã ngừng vẫn mở máy bán hàng | Lọc ACTIVE ở ô chọn; trang POS từ chối | Sonnet |
| F2 | Sửa món làm mất ảnh (hôm nay 0 món có ảnh) | Giữ ảnh cũ khi sửa | Sonnet |
| F3, F6, F7 | Nút Xoá vĩnh viễn hiện sai ở topping; topping thêm được size thứ hai; Ngừng/Mở bán ghi hai bảng rời | `canErase`; máy chủ từ chối + ẩn nút; một hàm Postgres | Sonnet + Gemini |
| B1 | Cùng một đơn đọc cách trả ba kiểu (sổ thu chi, danh sách đơn, Doanh số) | Một luật: trống là tiền mặt; đơn trả hai cách lọc theo `order_payments` | Sonnet |
| B2 | Nút "Nhập" ở nhắc khoản chi tháng trước ghi vào tháng này; lưu xong không về Tổng quan | Gửi kèm tháng; điền ngày trong tháng đó; cho phép về `/admin` | Gemini |
| B4, B5 | Bản đồ giờ bỏ qua lọc nhân viên/nhóm món; ô chọn người ở Nhật ký thiếu người mới | Dùng chung bộ lọc; lấy danh sách từ Nhân sự | Sonnet |
| B10, B11, B12 | Doanh số tách đồ ăn bằng mã nhóm viết cứng `CAT-006`; chữ tiếng Anh Gross/Net/UNKNOWN; luật Lãi lỗ ghi sai tên trang | Đọc Loại món; chữ Việt; sửa tài liệu | Gemini, Opus |
| F8 | Ngày ở Món, Khuyến mãi, Thương hiệu, Điểm bán thiếu giây (BR-DATA-006) | Dùng `formatDateTimeFull` | Gemini |
| E9 | Có thể còn quyền cũ thời tháng 4 trên cơ sở dữ liệu | Đo 2026-10-14 (chỉ đọc): mọi bảng `public` bật RLS, 0 policy; nhưng 6 bảng (`assets`, `asset_disposals`, `asset_depreciation_bands`, `order_payments`, `outlets`, `purchase_order_edits`) còn cấp đủ quyền, kể cả TRUNCATE, cho `anon`/`authenticated`; 2 hàm (`rls_auto_enable`, `touch_updated_at`) `anon` gọi được; quyền mặc định cấp cho bảng mới. Migration `0117` gỡ | Opus đo, Sonnet sửa |

## Đợt 2 — chậm dần theo thời gian

Lãi lỗ và Hàng đã xuất tính lại giá vốn theo kiểu bình phương: 1.095 phiếu (khoảng 2 năm) mất 2,6 giây
trên máy này (B6, A12). Gộp hai vòng tính giá vốn gần giống nhau làm một (A11, −85 dòng), Doanh số lọc
theo nhóm món quét lặp (B7), bộ định dạng giờ tạo lại mỗi lần (B13), trang một món đọc mọi dòng đơn
(F12), trang Đơn đồng bộ trễ đọc toàn bộ đơn (C16). Sonnet. Mỗi việc chứng minh bằng script `verify-*`:
0 lệch trên số dòng thật.

## Đợt 3 — dọn dẹp (ponytail), khoảng −8.000 dòng, −1 thư viện

Không đổi gì chủ quán nhìn thấy. Mỗi file xoá đã grep: không chỗ nào đang dùng.

- **Code chết:** `ToppingsManager.tsx`, `DeleteConfirmModal.tsx` + `FormModal.tsx`, `LoadingButton.tsx`,
  `InventoryForms.tsx`, `getCashEntries`, `summariseEntries`, `getPromotionPerformanceV2`,
  `displayStock`, `toMoneyDigits*`, sáu lệnh hàng hoá/quy đổi cũ ở `app/admin/inventory/actions.ts`
  (vẫn là cổng công khai), phần chết của `lib/costing/purchase-ledger-rebuild.ts` (một luật chia chi
  phí sai, BR-COGS-006), `app/api/revalidate`, hàm phụ chết ở `lib/db`, kiểu dữ liệu chết ở `types/db.ts`
  và `lib/sales/order-types.ts`, CSS chết ở `globals.css`. Sửa kèm các danh sách canh nhắc tới chúng.
- **Script đã chạy xong:** `clear-issue-slip-notes`, `relink-orphan-assets`, `retire-misfiled-assets`,
  `import-cash-entries` (+ dữ liệu mẫu), `check-purchase-order-cancel` — 14 file, 1.637 dòng.
- **Phép thử canh bảng đã gỡ:** 16 file `tests/migrations/` (sản xuất, điều chỉnh tồn, khoá kiểm toán…).
  Lý do xoá: mỗi file canh một thứ không còn tồn tại.
- **Thư viện:** gỡ `googleapis` (111 MB, không file nào dùng).
- **Tài liệu:** đánh dấu RETIRED bốn luật mô tả bộ máy đã gỡ (BR-BACKDATE-001/002/003, BR-DATA-003);
  xoá tám kế hoạch con đã xong (K1–K6, bộ lọc thời gian, đợt 9); sửa kế hoạch chung tự mâu thuẫn; gộp
  phần "thay đổi" vào thân tài liệu luồng việc và bỏ phép kiểm bắt ghi dấu; cắt phần chép tay của
  `SYSTEM-MAP.md` và phép kiểm đi kèm; bỏ phép kiểm cảnh báo không ai đọc; sửa README, SYSTEM-OVERVIEW,
  TABLE-DICTIONARY, GLOSSARY, `cash-book.md`; rút luật đã RETIRED còn một dòng trạng thái.
- **Ổ đĩa:** sáu thư mục làm việc cũ của Codex ở `C:/tmp` vẫn đăng ký với git → `git worktree prune`.

## Đợt 4 — gộp chỗ lặp

Một hàm tính giá giỏ hàng dùng chung cho máy bán, giỏ, trang sửa đơn và máy chủ, kèm phép thử "số máy
bán hiện = số máy chủ lưu" (C10; làm sau khi chủ quán chốt C3, C4, C5, C9). Một `safeReturnTo` thay 16
bản chép (F9). 19 trang danh sách dùng chung `useFilterForm` (F10, theo đợt). Một hàm "hàng không theo
dõi tồn" (A13); dòng đơn ở danh sách và chi tiết dùng chung (C14).

## Cần chủ quán quyết (hỏi từng câu một, theo thứ tự)

| # | Mã | Câu hỏi | Ảnh hưởng hôm nay |
|---|---|---|---|
| 1 | C5 | Máy bán mở cả ngày, chủ quán đổi giá lúc trưa: thu giá cũ mà sổ ghi giá mới. Lấy giá máy bán hiện, hay từ chối đơn và bắt tải lại? | **Đã chốt 14/10: từ chối, bắt tải lại** (`BR-SALE-008`) |
| 2 | A2 | Phiếu xuất nhập trễ (ngày trước lúc đếm) bị tính hai lần khi xác nhận kiểm kê. Từ chối và đếm lại, hay tự tính lại? | **Đã chốt 14/10: tự tính lại lúc xác nhận** (`BR-INV-017`) |
| 3 | E2 | Quản lý tự nâng mình thành chủ quán hoặc đổi mật khẩu chủ quán được. Chỉ chủ quán đụng tài khoản ADMIN? | **Đã chốt 14/10: chỉ chủ quán đụng vai Chủ quán** (`BR-ACCESS-004`) |
| 4 | A3b | Sửa phiếu nhập của tháng đã kiểm kê: có cho không? | **Đã chốt 14/10: chặn sửa như Huỷ** (`BR-INV-018`) |
| 5 | C9 | Giảm % cả đơn tính trên tổng trước hay sau giảm từng món? | **Đã chốt 14/10: sau giảm từng món** (`BR-SALE-009`) |
| 6 | C3, C4 | Khuyến mãi giảm cả hoá đơn cộng dồn với giảm tay không; máy chủ có tự áp khuyến mãi khi máy bán không áp? | **C3 đã chốt 14/10: cộng dồn** (`BR-SALE-010`); C4 đã chốt: tự áp loại không mã, ô "Dùng chung" (`BR-SALE-011`) |
| 7 | B3, B9 | Doanh số lọc nhóm món: ẩn khối cả đơn hay ghi chú; "Luỹ kế" Lãi lỗ tính lại từ tháng 1 hay từ đầu khoảng | **Đã chốt 14/10: tạm ẩn khi lọc** (`BR-SALE-012`); **Luỹ kế từ tháng đầu khoảng đang xem** |
| 8 | C1 | Bán khi mất mạng (`BR-U-001`): bật lại ba nút thanh toán khi máy biết đang mất mạng — gộp với phần 7 máy bán hàng | Mỗi lần mất mạng |
| 9 | F4b, F5, F13, C12 | Nhóm của topping bán riêng; bảng "Nhóm tuỳ chọn" tự sửa; hộp báo lỗi có biểu tượng; hiện từng phần của đơn trả hai cách | Thấp |
| 10 | E6, D12, D16 | Việc chủ quán tự làm (E9 đã xong bằng migration 0117): luật giới hạn đăng nhập trên Vercel; tắt đăng ký Supabase Auth; gỡ hàm `user-admin` trên máy chủ; sửa `.claude/settings.json` và `.claude/rules/ui-devices.md` | — |

## Chưa xem

Đã xem: toàn bộ `app/`, `lib/`, `components/`, `supabase/`, `scripts/`, `tests/`, `docs/`, `.claude/`
theo sáu mảng; các mục phải sửa của bảo mật và kiểm kê Opus kiểm lại tận code. Chưa xem: bố cục điện
thoại từng màn hình bằng mắt; cài đặt trên Vercel và Supabase (biến môi trường, `user-admin` còn chạy
không, đăng ký Supabase Auth); quyền cũ thời tháng 4 trên cơ sở dữ liệu (E9 cần một truy vấn); thư
mục `recovery-snapshots/` trên ổ đĩa (bị chặn đọc, có thể chứa bản sao dữ liệu thật); bộ kỹ năng
`ui-ux-pro-max` nhập từ ngoài.
