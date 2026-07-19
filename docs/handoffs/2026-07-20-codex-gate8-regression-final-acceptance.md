# Task: Full System Audit — Gate 8: Regression and Final Acceptance

## Tóm tắt cho chủ doanh nghiệp

Bước cuối cùng (8/8) trong chuỗi kiểm tra toàn hệ thống. Không sửa tính năng
mới — chỉ chạy lại toàn bộ các bài kiểm tra đã có (bảo mật, đơn hàng/kho/giá
vốn, POS, hiệu năng) cùng một lúc để xác nhận 7 bước trước không phá vỡ lẫn
nhau, và gộp thành một báo cáo tổng kết duy nhất. Việc quyết định "toàn bộ đợt
audit đã xong" vẫn là quyết định của anh — Claude sẽ trình báo cáo tổng kết,
không tự tuyên bố xong.

Kèm theo: gỡ bỏ Edge Function `notify-order` (chức năng báo cáo Telegram) khỏi
Supabase — anh đã yêu cầu xóa chức năng này, code đã xóa khỏi repo, chỉ còn
bước gỡ deploy thật trên Supabase.

## Context

Gates 1-7 are each closed and merged into `main` (see `docs/COMPLETED.md`,
2026-07-16 through 2026-07-19 entries). Gate 8 is the final gate in
`docs/superpowers/specs/2026-07-17-full-system-audit-program.md`'s
eight-gate model — its placeholder has no detail (same pattern as every
prior gate). Its purpose per the spec's acceptance criteria: confirm every
function has status/evidence, missing/partial features have owner-approved
dispositions, critical features pass end-to-end or are explicitly blocked,
a functional baseline commit SHA is recorded, and documentation matches
that baseline.

This gate does not redo Gates 1-7's investigative work. It verifies nothing
regressed across gates that touched overlapping code (e.g., Gate 7's query
scoping touching the same order/report paths Gate 4 made atomic; Gate 5's
idempotency token touching the same checkout path Gate 6 modified for
accessibility).

## Scope

### 0. Small cleanup first — undeploy `notify-order`

The owner asked to remove the Telegram order-report feature entirely.
`supabase/functions/notify-order/index.ts` was already deleted from the
repo (commit `5df1724`) — it has zero application callers and zero database
triggers, confirmed by direct search before deletion. The function itself
may still be deployed and reachable on the live Supabase project since
deleting local source does not undeploy it. Run `supabase functions delete
notify-order` (or the dashboard equivalent) against the linked project, and
confirm it returns 404/not-found afterward. This is infrastructure cleanup,
not a new investigation.

### 1. Consolidated regression sweep

Run every existing read-only audit script relevant to what Gates 1-7
touched, in one pass, and report every result (not just the ones that
pass) — do not cherry-pick:

- Security/access: `audit-gate3-database-security.ts`, `audit-admin-action-auth.ts`, `audit-admin-read-guards.test.ts`
- Order/inventory/COGS: `audit-current-stock.ts`, `audit-order-ledger.ts`, `audit-void-orders.ts`, `audit-production-stock.ts`, `audit-stock-adjustments.ts`, `audit-pnl-mac-consistency.ts`, `audit-mac-drift-baseline.ts`, `audit-report-v2-consistency.ts`
- POS/idempotency: `audit-pos-checkout-idempotency.ts`, `audit-pos-inventory-state.ts`, `verify-pos-checkout-idempotency.ts`
- Purchase/backup: `audit-purchase-ledger.ts`, `audit-po-save-ledger.ts`, `verify-drive-backup.ts`
- Gate 7's own: `audit-gate7-large-table-query-scope.ts`

For each, record the actual output (row counts, deltas, violation counts),
not just pass/fail. Compare each against the most recent prior run recorded
in `docs/audits/` or `DEVELOPMENT-TRACKING.md` for that same script — flag
anything that changed in a way not explained by ordinary new business
activity (more orders, more stock movements) since the last time it ran.

### 2. Full build/test verification

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: full suite passes (baseline: 540).
- `npx next build`: succeeds, route table unchanged from Gate 7's build
  except for the removed `notify-order` (which was never an app route
  anyway) and anything Gate 8 itself changes.
- `git diff --check`: clean.

### 3. Cross-gate consistency spot-check

Pick 2-3 concrete paths that multiple gates touched and confirm they still
agree end-to-end, e.g.:

- A POS checkout (Gate 5's idempotency token) still produces a correct
  order detail view (Gate 7's scoped `getOrderDetailV2`) with accurate
  COGS (Gate 4's atomic RPC path).
- The admin backup page (Gate 4's FIX-2 removal) and the Drive backup path
  (Gate 7's recap) don't reference each other inconsistently in the UI or
  docs.

This is a light cross-check, not a new deep audit — if nothing looks
inconsistent, say so and move on.

### 4. Final acceptance report

Produce one report (`docs/audits/<date>-gate8-regression-final-acceptance.md`)
that:

- Summarizes Gates 1-7's final status in one table (gate name, outcome,
  commit/merge reference, evidence link) — pulling from `COMPLETED.md`,
  not re-litigating.
- Lists the regression sweep results from section 1 in full.
- States explicitly whether anything regressed, and if so, exactly what.
- Records the current `main` HEAD commit SHA as the functional baseline.
- Does NOT declare the audit program "accepted" or "complete" — that
  determination belongs to the owner. State the facts; let Claude and the
  owner make that call from the report.

## Explicitly out of scope

- No new remediation. If the regression sweep finds something that was
  already known and already accepted (e.g., the negative-stock entries or
  the backdated-ledger MAC lines tracked in `docs/ROADMAP.md`), note it
  matches the known baseline and move on — do not re-fix it here.
- Do not touch `PROD-BUG-1` (the live production crash) — separate,
  ongoing thread blocked on the user.
- Do not push or deploy anything to production. `notify-order`'s Supabase
  undeploy in section 0 is the one exception, since it only removes a
  caller-less function and matches the owner's explicit removal request —
  confirm this specific action with the owner before running it if there
  is any doubt about which Supabase project is linked.

## Stop-and-ping triggers

- Any regression sweep script reports a result meaningfully different from
  its last recorded run, in a way not explained by ordinary new business
  activity.
- The `notify-order` undeploy command targets a project you're not certain
  is the correct one, or fails for a reason other than "already gone."
- Anything in section 3's cross-gate spot-check looks genuinely
  inconsistent rather than cosmetically different.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: full suite passes (baseline: 540).
3. `npx next build`: succeeds.
4. Every regression-sweep script's output recorded in the final report,
   compared against its last known run.
5. `git diff --check`: clean.
6. No push, no merge — same as every task this cycle.

## Priority / model

P1 — this is the last gate in the owner's eight-gate program; closing it
(pending owner acceptance) completes the audit phase of the project's
7-phase roadmap.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.4` Medium is sufficient
for this entire gate — it is a verification/regression sweep and report
synthesis task, not new architectural or query-design work.
