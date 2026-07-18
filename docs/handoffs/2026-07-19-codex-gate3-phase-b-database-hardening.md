# Task: Gate 3 Phase B — Database Grant/Function Hardening (G3-A4, A5, A6, A8)

## Tóm tắt cho chủ doanh nghiệp

Dọn 4 việc nhỏ còn sót lại từ đợt kiểm tra bảo mật database (Gate 3), mức độ
thấp/trung bình, chưa từng bị khai thác — không phải lỗ hổng đang mở, mà là
"để gọn hơn phòng khi sau này có sai sót khác". Cả 4 việc đều đã điều tra kỹ,
Claude vừa xác nhận lại trực tiếp trên database thật (không đổi gì so với lúc
kiểm tra ban đầu):

1. 28 bảng dữ liệu vẫn còn cấp quyền rộng cho 2 vai trò không dùng tới trong
   kiến trúc hiện tại (toàn bộ hệ thống chỉ chạy qua máy chủ, không có trình
   duyệt nào gọi thẳng database) — thu hẹp lại cho gọn.
2. Một hàm database mồ côi (`next_order_num`) nhắm vào một bảng không tồn
   tại — dọn hoặc khoá lại trước khi ai đó vô tình tạo lại bảng đó.
3. Một cơ chế tự động (bật khoá-truy-cập-hàng cho bảng mới) đang chạy thật
   nhưng chưa được ghi vào hồ sơ cấu trúc dữ liệu chính thức — ghi lại cho
   khỏi bất ngờ sau này.
4. 2 file kiểm tra cũ gọi vào hàm database không còn tồn tại — xoá.

## Context

Gate 3 Phase A (`docs/audits/2026-07-19-gate3-database-rls-audit.md`) closed
2026-07-19 with 4 Phase B inputs logged as `G3-A4` through `G3-A8` (P2
backlog, `docs/ROADMAP.md`). Claude re-verified all of them live today
(2026-07-19) using the same read-only audit script
(`scripts/audit-gate3-database-security.ts`) before scoping this handoff —
nothing has drifted since the original audit, and Gate 4 Phase B's 6 new
atomic RPCs (added the same day) correctly stayed `service_role`-only,
confirmed by the rerun (`anonExecutableFunctions`/`authenticatedExecutableFunctions`
both still exactly 4 — `get_my_role`, `next_order_num`, `rls_auto_enable`,
`touch_updated_at` — unchanged by Phase B).

G3-A7 (RPC bodies have no internal caller check, grant is the sole backstop)
is **not** in this task — Claude logged it as an accepted design tradeoff
directly in `docs/ACCESS-MODEL.md` requirement #5, no code change needed.

## Scope

### G3-A4 — Revoke unnecessary `anon`/`authenticated` table grants (Low)

28 of 32 public tables retain `SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, TRIGGER` for both `anon` and `authenticated`. 4 tables
(`audit_baseline_locks`, `backdated_ledger_events`, `data_migration_runs`,
`data_recovery_changes`) already have these revoked — use that as the
reference pattern.

Confirmed via Gate 3 Phase A and today's rerun: no browser Supabase client
exists in this codebase (`NEXT_PUBLIC_SUPABASE_*` absent, confirmed against
both source and a fresh production build's static output), so nothing
legitimate depends on `anon`/`authenticated` table-level grants today — RLS
already blocks row access regardless, this is pure unnecessary attack
surface.

Write a migration that revokes `SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, TRIGGER` on all 28 tables (list them explicitly, don't use a
dynamic/wildcard revoke — this is exactly the kind of change that should be
readable and reviewable line-by-line) from `anon` and `authenticated`,
matching however the 4 already-revoked tables got there (check if an
existing migration did that explicitly, follow the same style).

**Before writing the migration**, confirm with a fresh read-only query that
none of the 28 tables' current grants are relied on by anything outside
this repository (e.g., a Supabase-native feature, a webhook, a dashboard
integration) — if you find any such external dependency, stop and flag it
rather than assuming the repo is the only consumer.

### G3-A5 — Resolve orphaned `next_order_num` (Medium)

`SECURITY DEFINER`, `anon`/`authenticated` executable, no internal caller
check, upserts into `public.order_counters` — a table that has never
existed (`to_regclass('public.order_counters')` and
`to_regclass('order_counters')` both return null, confirmed today). Not
referenced by any repository code or tracked migration
(confirmed: `pg_depend` shows 0 dependents on the function today).

Since nothing references it and its target table doesn't exist, **drop the
function** rather than just revoking EXECUTE — there's no reason to keep
dead, unreferenced `SECURITY DEFINER` code around. If you find any reason
it should be kept (e.g., a Supabase-managed feature quietly depends on it),
stop and flag rather than dropping.

**Do not create `order_counters`** as part of this task — if a future
feature needs an order-counter table, that's separately designed work, not
a side effect of this cleanup.

### G3-A6 — Capture `rls_auto_enable` in a tracked migration (Medium)

A live event trigger function `rls_auto_enable()` auto-enables RLS on
newly created public tables — this explains why all 32 tables have RLS
enabled despite no tracked migration containing `ENABLE ROW LEVEL
SECURITY`. It's live configuration drift from the migration record, not an
active exposure (RLS being on is the safe direction).

Write a migration that captures the **existing** function and event
trigger definition exactly as they run live today (query the live
definition first via the read-only Management API, don't guess the SQL) —
using `create or replace function` and a guarded `create event trigger`
(check whether Postgres requires dropping an existing event trigger first
if it already exists under the same name; if so, make the migration
idempotent, e.g. `drop event trigger if exists ... ; create event
trigger ...`). This migration should be a no-op against the current live
database (the trigger already exists and behaves this way) — it exists
purely so a fresh environment or a future schema rebuild reproduces the
same behavior, and so this isn't a surprise the next time someone reads
the migration history top-to-bottom.

### G3-A8 — Remove 2 stale diagnostic scripts (Low)

`scripts/check-constraint-query.ts` calls `public.exec_sql(...)` and
`scripts/check-promotions-constraint.ts` calls
`public.get_table_constraints(...)` — both confirmed absent live (Gate 3
Phase A, reconfirmed today). Both scripts can only ever fail if run. Delete
both files.

## Explicitly out of scope

- Do not touch RLS policies themselves, the 4 already-revoked tables, or
  any of the 10 pre-existing / 6 new (Gate 4 Phase B) application RPCs.
- Do not touch `get_my_role` or `touch_updated_at` — both are intentionally
  `anon`/`authenticated`-executable and already reviewed as fine (Gate 3
  Phase A).
- Do not add an internal caller check to any RPC body — that's G3-A7,
  explicitly deferred (see `docs/ACCESS-MODEL.md` requirement #5).
- Do not create `order_counters`.

## Verification

1. Before any change: rerun `scripts/audit-gate3-database-security.ts`
   yourself and confirm your starting point matches this handoff's numbers
   (28 tables, `next_order_num` present, `rls_auto_enable` present, both
   dead-code scripts present) — don't assume this handoff is still accurate
   by the time you start.
2. After the migration: rerun the same script again. Expect: 0 (or 4, if
   you count the pre-existing revokes) tables with `anon`/`authenticated`
   grants beyond what's intentional, `next_order_num` absent from the
   functions list, `rls_auto_enable` present and matching the live
   definition byte-for-byte (the migration should change nothing
   observable, only the tracked-migration record).
3. `npx tsc --noEmit`: 0 errors.
4. `npx vitest run`: full suite passes (baseline: 494).
5. `npx next build`: succeeds — this changes only database grants/functions,
   not application code, but a clean build after a live schema change is
   still the cheapest availability check available.
6. Migration applies cleanly against the actual Supabase project and
   `npx supabase migration list` shows local/remote matched, same as every
   migration this session.
7. `git diff --check`: clean.

## Priority / model

P2, Low/Medium severity, no active exposure — not urgent, but real cleanup
now that Gate 4 Phase B is done. Live database grant/function changes still
warrant care even at low severity.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.5` Medium — multi-file
refactor with real logic (verifying dependencies before dropping/revoking),
not purely mechanical, but no new architecture design needed.
