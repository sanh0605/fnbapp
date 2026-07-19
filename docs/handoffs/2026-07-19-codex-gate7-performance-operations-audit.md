# Task: Full System Audit — Gate 7: Performance, Backup/Restore, and Operations Audit

## Tóm tắt cho chủ doanh nghiệp

Bước 7 trong chuỗi kiểm tra 8 bước, đúng với các tiêu chí chủ quán vừa nêu:
chức năng hoạt động tốt, không nghẽn mạng, tối ưu tốc độ, ghi nhận dữ liệu
chính xác, bảo toàn dữ liệu, dữ liệu đầu vào xử lý sạch.

Hai phát hiện cụ thể (đã điều tra trực tiếp trong code, không đoán mò):

1. **Nguy cơ chậm dần theo thời gian**: hàm tải dữ liệu dùng chung
   (`findAll`) luôn tải **toàn bộ bảng**, không lọc/phân trang ở tầng máy
   chủ. Các bảng giao dịch (đơn hàng, sổ kho) chỉ lưu cache 2 phút và bị
   xóa ngay mỗi khi có đơn hàng mới — nghĩa là giờ cao điểm (nhiều đơn
   liên tục) gần như lúc nào cũng phải tải lại toàn bộ bảng. Bảng đơn hàng
   hiện đã hơn 1.582 dòng, sổ kho hơn 8.137 dòng, tăng dần mỗi ngày — sẽ
   càng chậm nếu không xử lý.
2. **Lỗ hổng vận hành**: không có nơi nào ghi lại lỗi thật xảy ra trên
   trình duyệt của người dùng thật — chỉ có thể biết khi ai đó tình cờ mở
   được Console ngay lúc lỗi xảy ra (đúng tình huống đang gặp phải tối
   nay). Cần một cách để lỗi tự động được ghi lại ở đâu đó xem lại được.

## Context

`docs/superpowers/specs/2026-07-17-full-system-audit-program.md`'s Gate 7
placeholder has no real detail (same pattern as every prior gate). Scoped
from direct investigation of `lib/sheets_db.ts` and a live production
incident tonight (2026-07-19): a user-reported client-side crash with no
corresponding server-side error log, traced to a missing
`app/global-error.tsx` (added by Claude as an immediate UI safety net,
commit `866b0bd` — it makes the crash recoverable but does not explain
*why* it happens, and there is still no way to see the actual error text
after the fact).

## Scope

### 1. Performance — `findAll()` full-table-load pattern

Read `lib/sheets_db.ts:173-221` directly: `findAll()` paginates internally
in `PAGE_SIZE=1000` chunks but always loads the **entire table** into
memory, cached via `unstable_cache` with a TTL from `getRevalidation()`
(`lib/sheets_db.ts:49-53`) — 30 min for static tables, 10 min for catalog
tables, **2 min for transaction tables** (Orders, Lines, Events, Ledger),
and every write calls `revalidateTag` to invalidate immediately. During
busy hours (frequent order writes), this means the transaction-table cache
is invalidated far more often than its 2-minute TTL would suggest, so most
admin/report page loads during business hours likely hit a cold cache and
re-fetch the whole table.

Baseline (confirmed live tonight): `orders_v2` 1,582 rows, `order_lines_v2`
2,258 rows, `stock_ledger` 8,137 rows — all growing daily.

Tasks:

- Catalog every `findAll()` call site in `app/admin/**/actions.ts` against
  the 3 largest/fastest-growing tables (`Stock_Ledger`, `Order_Lines_V2`,
  `Orders_V2`) — `app/admin/orders/actions.ts` (11 `findAll` calls),
  `app/admin/reports/actions.ts` (9 calls), and `app/admin/inventory/actions.ts`
  (8 calls) are the highest-count files, start there.
- For each call site against a large table, determine whether the caller
  actually needs *every row* or could use a filtered/paginated query
  instead (`findAllWhere` already exists in `lib/sheets_db.ts:227+` with
  cursor-pagination support — check whether it's already fit for purpose
  before building something new).
- Pick the 2-3 highest-impact page loads (most likely: order list/detail,
  P&L report, sales report, stock report — confirm which pages actually
  call `findAll` on the largest tables before assuming) and convert them
  to filtered/paginated queries. Do not attempt to rewrite `findAll()`
  itself or migrate every call site — that's a much larger effort than
  this gate, scope it down to the highest-traffic pages only.
- Re-measure: row counts before/after are unaffected (read-only page loads),
  but confirm query counts/latency improve for the converted pages (e.g.,
  time a `next build` + manual page load, or add a quick timing log
  temporarily and remove it before commit).

### 2. Operations — no remote error visibility

Currently, a client-side production error is invisible unless someone has
browser DevTools open at the exact moment it happens (confirmed tonight —
Vercel function logs showed zero errors for a period when a user-reported
crash definitely occurred, because the crash never touched the server).

Add a lightweight way to capture what actually happened without adding a
new paid service or SDK:

- In `app/error.tsx` and the new `app/global-error.tsx`
  (`console.error("[GlobalError]", error)` / `console.error("[RootGlobalError]", error)`
  currently just log to the browser console, which is lost once the tab
  closes), send the error (message, stack, digest, URL, timestamp) to a
  simple logging endpoint — a new minimal API route that inserts into a
  new `client_error_log` table (read-only, admin-viewable). (Note: the
  `notify-order` Telegram Edge Function mentioned in an earlier draft of
  this handoff was deleted 2026-07-19 at the owner's request — do not
  reuse or resurrect that pattern.)
- Keep this deliberately minimal — no dashboards, no alerting thresholds,
  just "the next time this happens, there's a retrievable record of the
  actual error text and stack trace" instead of nothing.
- Do not add any third-party error-tracking SDK (Sentry, etc.) without
  flagging it first — that's a bigger integration decision than this gate.

### 3. Backup/restore — recap, not new work

Already verified in Stabilization Phase 2 (`docs/audits/2026-07-16-drive-backup-policy.md`,
`docs/operations/apps-script-drive-backup.md`) and reconciled against the
live schema in Gate 3 Phase A. For this gate: rerun the existing backup
verification steps from the runbook (confirm the daily Drive backup file
still matches the current 32-table schema, `schemaVersion === 2`,
row counts look sane) and note the result — this should be a quick
confirmation, not a new investigation, unless something looks wrong.

### 4. Input validation — light spot-check

Gate 4/5 already added real validation to the 5 atomic RPCs and POS
checkout. For this gate: spot-check 2-3 forms *not* touched by those
gates (e.g., supplier/purchase-source management, unit/conversion setup,
promotion creation) for obvious missing input guards (negative quantities
where they shouldn't be allowed, empty required fields, no length limits
on free-text fields that end up in reports). This is a light pass, not a
rewrite — if you find something concrete, fix it; if the spot-checked
forms already look reasonable, say so and move on.

## Explicitly out of scope

- Do not rewrite `findAll()`/`sheets_db.ts`'s caching architecture — only
  convert the specific highest-impact call sites identified above.
- Do not add a third-party error-tracking service without flagging it
  first as a separate decision.
- Do not touch backup architecture/policy — Codex already owns that per
  `docs/COLLABORATION.md` Section C, but this gate is a recap, not a
  redesign.
- Do not touch the still-open production crash investigation directly —
  that's a separate, ongoing thread (Claude is waiting on the user for the
  actual browser error text). If the operations logging you add in item 2
  happens to capture that error once deployed, that's a helpful side
  effect, not the goal of this task.

## Stop-and-ping triggers

Per the standing overnight agreement: keep working through this whole task
without a review checkpoint between steps. Only stop and flag clearly if:

- Converting a `findAll()` call site to a filtered/paginated query would
  change what data a page displays in a way a user would notice (e.g.,
  a report currently showing all-time data would need explicit date-range
  filtering) — that's a product/UX decision, not a performance change.
- The error-logging addition would require a new production secret/service
  account beyond what already exists.
- Any backup recap step finds a real mismatch (not just "haven't rerun
  in a while").

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: full suite passes (baseline: 523).
3. `npx next build`: succeeds.
4. For each converted page: confirm the displayed data is unchanged for a
   normal user (same rows, same totals) — a filtered/paginated rewrite
   must not silently drop or duplicate anything.
5. `git diff --check`: clean.
6. No push, no merge — same as every task tonight.

## Priority / model

P1 — directly addresses the owner's explicit priority order tonight
(functions work well → no network congestion → speed → accurate data →
data integrity → clean input). The performance item compounds daily as
order volume grows, so earlier is better than later.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.6-sol` High for the
performance conversion (query/architecture judgment on production data
paths); `gpt-5.4` Medium is sufficient for the operations logging and
input-validation spot-check.
