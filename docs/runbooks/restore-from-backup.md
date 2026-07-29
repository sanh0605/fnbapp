# Runbook: Khôi phục dữ liệu từ bản backup

Viết cho chủ quán, giả định không nhớ gì về phiên làm việc đã tạo ra tài liệu này (2026-07-29). Đọc từ trên xuống, làm theo thứ tự.

## Khi nào dùng runbook này

- Nghi ngờ dữ liệu production bị mất/hỏng (xoá nhầm, migration lỗi, bug ghi sai).
- Trước khi làm bất kỳ thao tác "dựng lại dữ liệu từ đầu" nào (rebuild) — luôn phải có một bản backup **đã kiểm tra khôi phục được** trước khi động vào dữ liệu thật.
- Định kỳ diễn tập (khuyến nghị: vài tháng một lần) để chắc chắn quy trình này vẫn còn dùng được sau khi schema thay đổi.

**Nguyên tắc quan trọng nhất: không bao giờ khôi phục thẳng vào database production.** Luôn khôi phục vào một database rỗng, riêng biệt ("database thử") trước, kiểm tra xong xuôi rồi mới quyết định bước tiếp theo với chủ quán.

## Bản backup nằm ở đâu

- Backup chạy tự động mỗi ngày khoảng 02:30 giờ Việt Nam, qua Google Apps Script (tài khoản Google của chủ quán) kéo dữ liệu từ Supabase Edge Function `backup-to-drive` rồi lưu vào Google Drive.
- File JSON, đặt tên `fnbapp-backup-YYYY-MM-DD.json`, nằm trong thư mục Drive đã cấu hình, dưới hai thư mục con `daily/` và `monthly/`.
- Giữ 180 bản hàng ngày gần nhất; bản hàng tháng giữ vĩnh viễn.
- Chi tiết chính sách: `docs/audits/2026-07-16-drive-backup-policy.md`.
- Bản backup phủ đủ **40 bảng** (tính đến 2026-07-29) — bao gồm cả `order_payments` (dữ liệu thanh toán), `shifts`, `stocktake_sessions`, và các bảng audit mới. Danh sách đầy đủ: `BACKUP_TABLES` trong `supabase/functions/backup-to-drive/core.ts`.
- **`inventory_balances` không nằm trong backup** — đây là bảng tính lại được từ `stock_ledger` (qua hàm `rebuild_inventory_balances()`), không phải nguồn dữ liệu gốc.

## Bước 1: Tạo database thử (owner tự làm)

1. Vào https://supabase.com/dashboard, tạo project mới, đặt tên rõ ràng là tạm thời, ví dụ `fnbapp-restore-drill`.
2. Chờ project khởi tạo xong (vài phút).
3. Vào **Project Settings → Database → Connection string**, chọn tab **"Connection pooling"** (không phải "Direct connection" — nhiều project Supabase mới chỉ mở kết nối trực tiếp qua IPv6, máy thường dùng chỉ có IPv4 nên sẽ báo lỗi "no such host" nếu dùng Direct connection).
4. Copy chuỗi kết nối dạng: `postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-x-xx-xxxx-x.pooler.supabase.com:5432/postgres`
5. Thay `[YOUR-PASSWORD]` bằng mật khẩu database thật (lấy từ trang Database Settings) — **nhớ xoá luôn cặp dấu ngoặc vuông `[` `]`**, không chỉ thay nội dung bên trong. Nếu mật khẩu có ký tự đặc biệt (`%`, `.`, ...), Claude sẽ tự mã hoá lại khi chạy, không cần tự làm.
6. Vào **Project Settings → API**, lấy **Project URL** và **service_role key**.
7. Thêm 3 dòng vào `.env.local` (KHÔNG commit file này vào git):
   ```
   RESTORE_TARGET_SUPABASE_URL=<Project URL>
   RESTORE_TARGET_SERVICE_KEY=<service_role key>
   RESTORE_TARGET_DIRECT_URL=<chuỗi kết nối pooler đã thay mật khẩu, bước 4-5>
   ```
8. Báo cho Claude/Codex biết đã xong bước này.

## Bước 2: Áp schema lên database thử

Database thử ban đầu hoàn toàn rỗng, không có bảng nào. Cần chạy toàn bộ migration lên nó trước:

```bash
npx supabase db push --db-url "<RESTORE_TARGET_DIRECT_URL>" --dry-run   # xem trước
npx supabase db push --db-url "<RESTORE_TARGET_DIRECT_URL>" --yes       # áp thật
```

Lệnh này áp **tất cả** migration đang chờ (kể cả những migration production cũng đang chờ, nếu có) — không có cách chọn riêng từng migration. Nếu có migration khác đang chờ áp lên production mà chưa muốn áp, hỏi ý kiến trước khi chạy `--yes`.

## Bước 3: Chạy khôi phục

```bash
npx vite-node scripts/restore-backup-to-target.ts
```

Script này:
- Kiểm tra an toàn TRƯỚC KHI làm bất cứ điều gì: nếu `RESTORE_TARGET_SUPABASE_URL` trùng với production hoặc chưa khai báo, script tự chặn ngay, không kết nối đi đâu cả (`lib/backup-restore.ts`, hàm `assertSafeRestoreTarget`).
- Đọc dữ liệu production (chỉ đọc, không sửa gì), rồi ghi vào database thử.
- In ra số dòng đã ghi cho từng bảng, và nếu có dòng nào không ghi được sẽ in rõ lý do.

**Nếu database thử đã có dữ liệu từ lần chạy trước** (ví dụ lần trước bị dừng giữa chừng), phải xoá sạch dữ liệu cũ trước khi chạy lại, nếu không sẽ báo lỗi trùng khoá chính. Xem phần "Sự cố từng gặp" bên dưới.

**Thời gian chạy lần diễn tập 2026-07-29:** khoảng vài phút cho 52.232 dòng / 40 bảng, sau khi đã sửa một lỗi hiệu năng (xem bên dưới). Lần đầu (trước khi sửa) từng bị kẹt hàng giờ đồng hồ ở một bảng.

## Bước 4: Kiểm tra khôi phục có đúng không

```bash
npx vite-node scripts/verify-restore-drill.ts
```

Script này so sánh database thử với **production ngay tại thời điểm kiểm tra** (không so với bản backup cũ, vì production là hệ thống sống, có thể đã bán thêm hàng trong lúc chờ khôi phục) — kiểm tra hai lớp:

1. **Đếm số dòng** cho cả 40 bảng.
2. **Mở dữ liệu ra so sánh nội dung thật**, không chỉ đếm số dòng: phiếu nhập hàng PO-037 (đầu phiếu + toàn bộ dòng hàng), một đơn hàng thanh toán chia nhiều lần (payment rows), và số dòng sổ kho của Sữa đặc.

Kết quả in ra `VERDICT: PASS` hoặc `FAIL`. Nếu `FAIL`, đọc phần `FINDING` để biết chính xác cái gì sai — **không được tiếp tục làm bất cứ thao tác dựng lại dữ liệu nào trên production cho tới khi verdict là PASS**.

Hai bảng `backdated_ledger_events` và `backdated_recipe_events` gần như luôn lệch số dòng (nhiều hơn) sau khi khôi phục — đây là bình thường, không phải lỗi (xem phần dưới), verdict vẫn tính là PASS nếu chỉ hai bảng này lệch.

## Bước 5: Báo cáo và dọn dẹp

- Xem file `docs/audits/*-phase3-restore-drill-result.json` (ngày mới nhất) để có kết quả đầy đủ.
- Sau khi xác nhận verdict PASS và đã ghi lại kết quả, **chủ quán tự xoá project thử** trên Supabase dashboard (Settings → General → Delete project). Claude/Codex không tự xoá — đây là project trong tài khoản riêng của chủ quán.

## Sự cố từng gặp (2026-07-29), để lần sau đỡ mất thời gian

**1. "no such host" khi kết nối trực tiếp (`db.xxxxx.supabase.co`).** Project Supabase mới chỉ mở kết nối trực tiếp qua IPv6. Dùng chuỗi kết nối "Connection pooling" (tab riêng trong Database Settings) thay vì "Direct connection".

**2. Mật khẩu còn giữ nguyên dấu ngoặc vuông `[...]` khi dán vào `.env.local`.** Dashboard hiển thị `[YOUR-PASSWORD]` như một chỗ điền, nhưng dễ nhầm là phải giữ nguyên ngoặc. Phải xoá cả hai dấu `[` `]`, chỉ giữ mật khẩu thật bên trong.

**3. Bảng `data_recovery_changes` khiến khôi phục cực kỳ chậm (từng bị kẹt hàng giờ).** 94% số dòng của bảng này (29.349/31.132, số liệu 2026-07-29) có cột `old_value` hoặc `new_value` mang giá trị "rỗng" theo một cách đặc biệt (jsonb null) mà công cụ ghi dữ liệu qua API không xử lý được theo lô, phải thử từng dòng một — rất chậm ở quy mô này. Đã sửa: `lib/backup-restore.ts` giờ tự nhận diện và thay thế trước bằng một giá trị đánh dấu rõ ràng, nên bảng này khôi phục nhanh như các bảng khác. Nếu lần sau vẫn thấy chậm bất thường ở một bảng cụ thể, khả năng cao là một cột NOT NULL kiểu jsonb khác có cùng vấn đề — thêm tên bảng/cột vào `NOT_NULL_JSONB_NULL_LITERAL_COLUMNS` trong `lib/backup-restore.ts`.

**4. `backdated_ledger_events`/`backdated_recipe_events` luôn có nhiều dòng hơn sau khi khôi phục.** Hai bảng này được một trigger tự động tạo ra mỗi khi có dòng `stock_ledger`/`recipes` "đến muộn" so với các dòng đã có. Khi khôi phục hàng loạt, dữ liệu không đến theo đúng thứ tự thời gian gốc, nên trigger hiểu nhầm là "muộn" và tự tạo thêm dòng — không phải mất dữ liệu, chỉ là nhiễu do thứ tự khôi phục khác thứ tự ghi gốc. Không cần sửa, chỉ cần biết đây là bình thường.

**5. Nếu phải chạy lại khôi phục sau một lần chạy dở dang**, database thử sẽ còn dữ liệu cũ, gây lỗi trùng khoá chính khi chạy lại. Phải xoá sạch dữ liệu (không xoá bảng, chỉ xoá dữ liệu) trước khi chạy lại — hỏi Claude/Codex xử lý việc này, đừng tự xoá bằng tay vì thứ tự xoá phải ngược với thứ tự khôi phục để không vướng khoá ngoại.

## Việc KHÔNG được làm

- Không bao giờ đặt `RESTORE_TARGET_SUPABASE_URL`/`RESTORE_TARGET_SERVICE_KEY` trùng với giá trị production (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) — script sẽ tự chặn, nhưng đừng thử.
- Không chạy `scripts/restore-backup-to-target.ts` khi chưa có database thử riêng.
- Không tiếp tục các bước "dựng lại dữ liệu" trên production nếu `verify-restore-drill.ts` báo `FAIL`.
