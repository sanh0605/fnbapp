# Gate 7 Backup Recap and Input Validation Spot-check

> Tóm tắt tiếng Việt: Backup ngày 19/07 vẫn chạy đúng lịch và hợp đồng 32 bảng. Kiểm tra đầu vào phát hiện rồi chặn ba lỗi server-side: nhà cung cấp chỉ có khoảng trắng hoặc quá dài, tỷ lệ quy đổi không dương/không hữu hạn, và dữ liệu khuyến mãi sai khi gọi thẳng server action.

## Backup and restore recap

### Drive evidence

- Folder: `fnbapp-backups/daily/` under the approved owner Drive folder.
- Latest observed file: `fnbapp-backup-2026-07-19.json`.
- Modified: 02:24 Asia/Ho_Chi_Minh on 2026-07-19, consistent with the approximately 02:30 installable trigger.
- Drive-reported size: 7.8 MB.
- File preview header: `capturedAt=2026-07-18T19:23:23.750Z`, `schemaVersion=2`.
- Daily continuity visible in Drive: July 16, 17, 18, and 19 files.

The Apps Script writes a file only after `validateBundle_` confirms exactly the 32 allowlisted table keys and verifies every table's `count === rows.length`. The observed July 19 file therefore passed that gate before creation.

### Independent live snapshot verification

Command: `vite-node scripts/verify-drive-backup.ts`

| Check | Result |
|---|---:|
| Schema version | 2 |
| Required tables | 32/32 |
| Total rows | 14,901 |
| Serialized size | 8,320,416 bytes |
| Invalid per-table counts | 0 |
| External writes | 0 |

Selected live counts were `orders_v2=1,593`, `order_lines_v2=2,279`, `order_events=1,606`, `stock_ledger=8,253`, and `audit_baseline_locks=436`. Empty workflow tables remained present, which is expected under the policy.

The live snapshot is slightly newer than the 02:24 Drive file, so small row-count growth is normal business activity rather than a backup mismatch. The bundle remains below the 20 MB warning threshold and the 25 MB migration threshold.

Restore remains a reviewed, explicit operation. This recap validated the restore input contract but did not write to Drive, restore database rows, or change backup policy.

## Input validation spot-check

Three forms outside the Gate 4/5 transaction scope were checked at both browser and authoritative server-action boundaries.

| Surface | Existing browser guard | Server finding | Gate 7 result |
|---|---|---|---|
| Supplier management | Required name | Whitespace-only names and unbounded report-facing text could be stored | Trim all fields; reject blank/overlong name and bound phone, tax ID, address, and links |
| Unit conversion | Required numeric field | `0`, negative, `Infinity`, and non-numeric rates could be stored by direct action calls | Require a finite conversion rate greater than zero on create and update |
| Promotion management | Name, value, date, and selection checks | Direct server calls bypassed all client invariants | Enforce enums, bounded name/code, positive discount, percent ceiling, non-negative minimum order, valid dates, and valid per-product values |

The changes preserve valid form behavior and add no database migration. Invalid requests fail before ID generation or any insert/update call. The focused action tests explicitly verify the no-write boundary.

## Verification status

- Drive backup core/handler/contract tests: 10 passed.
- Input validation action tests: 5 passed.
- Production database writes during recap: none.
- Backup/restore writes during recap: none.
- Stop-and-ping trigger: not reached; no real backup mismatch was found.
