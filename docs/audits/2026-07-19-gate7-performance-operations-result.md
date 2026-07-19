# Gate 7 Performance and Operations Result

> Tóm tắt tiếng Việt: Gate 7 đã giảm tải dữ liệu cho trang chi tiết đơn hàng và hai báo cáo lớn mà không đổi kết quả hiển thị; bổ sung log lỗi trình duyệt có thể xem lại; xác nhận backup daily 32 bảng vẫn hoạt động; và chặn ba nhóm dữ liệu đầu vào sai ở tầng server. Không có database write, migration, merge hoặc push trong Gate 7.

## Scope and outcome

| Workstream | Outcome | Evidence |
|---|---|---|
| Large-table reads | Scoped the highest-impact order detail, P&L, and sales reads; retained full history where semantics require it | Production read-only row-set parity audit passed |
| Client error visibility | Authenticated same-origin endpoint writes bounded structured `[ClientError]` records to Vercel server logs | Helper, route, and boundary contract tests passed |
| Backup/restore recap | Latest Drive daily file present; schema version and 32-table contract current; live snapshot valid | Drive observation plus independent live snapshot verifier |
| Input validation | Supplier, conversion, and promotion server actions reject concrete invalid inputs before writes | Red/green action tests passed |

No stop-and-ping trigger was reached. No performance rewrite changed visible data semantics, client logging introduced no secret or service account, and the backup recap found no mismatch.

## 1. Performance

### Changes

- Added `findAllWhereInBatches` for deterministic, bounded `IN` queries (100 IDs per request, concurrent batches, sorted result).
- `getOrderDetailV2` now fetches one order, its line IDs, and its event IDs rather than loading all three transaction tables.
- `getPnLDataV2` and `getSalesDataV2` now fetch report-window orders and only the lines belonging to those orders.
- `getPromotionPerformanceV2` reuses the existing scoped completed-order query.

Full-table reads were intentionally retained for:

- order list all-time display, because adding a date range or pagination would change visible UX;
- stock report, because current stock sums the complete ledger;
- P&L MAC ledger replay, because MAC requires full prior history;
- void/edit mutation paths, because transaction remediation belongs to a separate scope.

### Production read-only measurement

Window: 2026-07-01 through 2026-07-19, Asia/Ho_Chi_Minh.

| Read | Before | Scoped | Measured latency |
|---|---:|---:|---:|
| Report orders | 1,593 rows | 424 rows | 2,029.6 ms full / 152.1 ms scoped |
| Report order lines | 2,279 rows | 617 rows | 2,096.6 ms full / 280.1 ms scoped |
| Order detail orders | 1,593 rows | 1 row | Included in 837.8 ms scoped detail sample |
| Order detail lines | 2,279 rows | 1 row | Included in 837.8 ms scoped detail sample |
| Order detail events | 1,606 rows | 1 row | Included in 837.8 ms scoped detail sample |
| Stock ledger | 8,253 rows | 8,253 rows | 2,935.2 ms; intentionally retained |

Row-set parity was `PASS`; no rows were dropped or duplicated and no data was written. Network latency varies per request, so the durable improvement is the bounded row volume rather than a single timing sample.

## 2. Client error visibility

Both Next.js client error boundaries now submit message, stack, digest, page URL, source, and timestamp to `POST /api/client-errors`. The route:

- requires the existing authenticated session;
- rejects malformed input;
- bounds all diagnostic strings and discards unknown fields;
- adds only the resolved actor and server receipt time;
- writes a structured `[ClientError]` record to server logs;
- creates no database row, external-service dependency, or new secret.

Duplicate browser reports are suppressed within the same page session, and reporting failure cannot recursively throw into the error boundary. Operators can search Vercel Runtime Logs for `[ClientError]` after the affected tab closes. Vercel's log retention remains the explicit durability limit.

Detailed runbook: `docs/audits/2026-07-19-gate7-client-error-logging.md`.

## 3. Backup and restore recap

Drive contained `fnbapp-backup-2026-07-19.json`, modified at 02:24 Asia/Ho_Chi_Minh and reported as 7.8 MB, following continuous July 16-19 daily files. Its preview header showed `schemaVersion=2`. Apps Script validates exactly 32 keys and every `count === rows.length` before creating the file.

The independent current-production dry run produced:

- 32/32 tables;
- 14,901 total rows;
- 8,320,416 serialized bytes;
- zero invalid per-table counts;
- zero external or database writes.

Restore input remains valid, but no restore was attempted or authorized. The bundle remains below the 20 MB capacity warning threshold.

Detailed evidence: `docs/audits/2026-07-19-gate7-backup-input-validation.md`.

## 4. Input validation spot-check

Three server-authoritative gaps were reproduced before remediation:

1. Supplier fields accepted whitespace-only names and had no report-facing length boundaries.
2. Conversion create/update accepted zero, negative, infinite, and non-numeric rates.
3. Promotion save trusted browser-only rules when called directly.

The server actions now trim and bound supplier fields, require a finite positive conversion rate, and enforce promotion enums, amounts, percent ceiling, dates, product-specific values, and text limits. Invalid inputs return before ID generation or insert/update. Valid promotion normalization and supplier storage are also covered by tests.

## 5. Financial and audit safety

The production P&L consistency audit remained clean:

- 1,572 qualifying orders;
- total COGS: 22,146,149 VND;
- product/topping delta: 0 VND;
- ingredient delta: 0 VND.

The frozen MAC baseline artifact remains byte-identical:

`cd0a2b13d6e52cf7cd53dd8223b805686c7fa579ef76a245a588d484fe630dc3`

The cohort-aware MAC audit also surfaced 12 new production lines dated July 17-18 as `NEW_INVESTIGATION_NEEDED` (net delta +10 VND; individual range -152 to +198 VND). Security integrity remains clean (`LOCKED_VIOLATION_STORED=0`), with the known 16 replay-only lines still informational. This live-state finding is not caused by Gate 7 and was not investigated or mutated here; Claude should triage it as a separate follow-up.

## 6. Final verification

| Gate | Result |
|---|---|
| Full Vitest suite | 103 files, 540 tests passed |
| TypeScript | `tsc --noEmit`, 0 errors |
| Production build | Next.js build passed, 40 pages generated |
| Large-table parity | PASS, read-only |
| P&L MAC consistency | 0 VND deltas |
| Backup live snapshot | 32/32 tables, no writes |
| Frozen baseline SHA-256 | Approved hash unchanged |
| `git diff --check` | Clean |

## Commits for review

- `86f39ec` — `Codex perf: scope Gate 7 large-table admin reads`
- `0e00e44` — `Codex ops: capture authenticated client errors in server logs`
- `acaea54` — `Codex harden: validate Gate 7 admin inputs`
- `24c578a` — `Codex audit: verify Gate 7 backup and input safeguards`

Branch: `codex/gate7-performance-operations`

Worktree: `C:\tmp\fnbapp-gate7`

The branch is intentionally preserved for Claude review. It has not been merged or pushed.
