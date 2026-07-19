# Gate 8 — Regression and Final Acceptance

> Tóm tắt tiếng Việt: Bước cuối cùng (8/8) trong chuỗi audit. Đã chạy lại toàn bộ
> các bài kiểm tra sẵn có bao trùm 7 bước trước (bảo mật, đơn hàng/kho/giá vốn,
> POS, backup) trong một đợt duy nhất. Không phát hiện hồi quy thật nào từ Gate
> 1-7. Phát hiện thêm 1 lỗi từ lâu trong chính công cụ audit `audit-po-save-ledger.ts`
> (tên cột sai từ thời Google Sheets) — đã xác minh độc lập bằng cột đúng và
> xác nhận dữ liệu PO/ledger thật hoàn toàn sạch (0 vấn đề), lỗi chỉ nằm ở công
> cụ kiểm tra. Báo cáo này không tự tuyên bố "audit đã chấp nhận xong" — quyết
> định đó vẫn thuộc về chủ dự án.

## Status: partially complete — handed over mid-task, Codex rate-limited until 2026-07-25

Codex began Gate 8 (undeployed `notify-order`, ran the audit matrix, found and
correctly stopped at a real classification stop-gate) then hit its usage limit
before writing the fix or running the full regression sweep. The owner
approved Claude completing the rest directly given the 5-day wait, with one
exception routed as a scripts/-ownership exception (see below) rather than a
silent departure from the standing rule.

## 1. Gates 1-7 final status

| Gate | Outcome | Reference |
|---|---|---|
| Gate 1 — P0 security exposures | Closed, merged | Commits `dd2f970`/`57d298a`/`9a8ee66` |
| Gate 2 — Architecture and access map | Closed, merged | Commits `3570da0`/`f14b092` |
| Gate 3 Phase A — Database/RPC/RLS audit | Closed, merged | Commit `a17b0e7` |
| Gate 3 Phase B — Database hardening | Closed, merged | Commit `58aa46a`, migration `0022` |
| Gate 4 Phase A — Order/inventory/COGS forced-failure audit | Closed, merged | Commits `c0be7ce`/`15e3889`/`26b2eb8`/`159b7c9` |
| Gate 4 Phase B — Atomic RPC remediation (5 paths) | Closed, merged | Commits `c6c61b7`/`31cee7f`/`576572b`/`22823ce`/`016bed6`, migrations `0017`-`0021` |
| FIX-1/FIX-2 — Password fix + Backup&Sync page removal | Closed, merged | Commit `fe04f4a` |
| REV-1 — Script fix cross-check | Closed, merged | Commit `39ea6c2` |
| Gate 5 — POS checkout idempotency | Closed, merged | Commits `c1f1b04`/`a76d324`/`3f61e47`/`3291d70`, migration `0023` |
| Gate 6 — UI/UX/accessibility audit | Closed, merged | Commits `642bea8`→`c92a1e7`, `6fbe56a`, `a14b8e1` |
| Gate 7 — Performance/backup/operations audit | Closed, merged | Commits `86f39ec`-`c7c219a` |
| Telegram order-report removal | Closed, merged | Commit `5df1724` (repo) + Codex's live Supabase undeploy (confirmed 404) |
| Gate 8 stop-gate fix — audit tool AUTHENTICATED-route classification | Closed, merged | Commit `28bd508` (Claude, scripts/-ownership exception, queued `REV-2` for Codex retroactive review) |

Full narratives for each: `docs/COMPLETED.md`.

## 2. Consolidated regression sweep (2026-07-20, read-only, no writes)

| Script | Result | Compared against | Verdict |
|---|---|---|---|
| `audit-gate3-database-security.ts` | Exit 0, no anon/authenticated grants, 10 RPCs still service-role-only | Gate 3 baseline | Clean, unchanged |
| `audit-admin-action-auth.ts` | Exit 0, 0 mutation/read/route findings; `/api/client-errors` now `GUARDED` | Gate 8's own stop-gate | Fixed, confirmed |
| `audit-current-stock.ts` | 44 tracked items, 3 negative: `ING-021` -757.5g, `ING-003` -696g, `ING-024` -170ml | Same 3 items as Gate 5 baseline (`-729.8g`/`-131g`/`-150ml`) | Known physical-count backlog, balances grew from ordinary sales; no new items |
| `audit-order-ledger.ts` | 1,593 orders, 2,279 lines, 8,253 ledger rows, 301 mismatches, 0 orphans | Same 301 mismatch count as Gate 5 baseline despite +13 orders/+23 lines/+125 ledger rows since | Known replay-drift category is stable (doesn't grow with new orders); clean |
| `audit-void-orders.ts` | 0 empty-reason events, 0 missing reversals | Prior baseline | Clean |
| `audit-production-stock.ts` | 5 yield mismatches, 0 negative semi-products | Same 5 mismatches confirmed in Gate 4 Phase B review | Known historical/semantic gap; no new signal |
| `audit-stock-adjustments.ts` | 0 adjustments total | Consistent with 0-row `stock_adjustments` table | Clean (feature unused in live data so far) |
| `audit-pnl-mac-consistency.ts` | 1,572 orders, 22,146,149 VND, 0 delta | Exact match to Gate 7 rerun | Clean |
| `audit-mac-drift-baseline.ts` | Same 12-line `BACKDATED_LEDGER_LIKE` finding, `LOCKED_VIOLATION_STORED=0` | Exact match to the 2026-07-19 classification (`docs/audits/2026-07-19-gate4-mac-drift-12-line-classification.md`) | Known, already resolved; no new signal |
| `audit-report-v2-consistency.ts` | 1 mismatch, order-vs-line revenue delta 15,000 VND | Same known `UCK000269` line-less order, same 15,000 VND amount, recorded in both Gate 4 and Gate 5 baselines | Known gap; no new signal |
| `audit-pos-checkout-idempotency.ts` | 1,593 orders, 0 with a `client_request_id` | Expected: production is still on pre-Gate-5 code (117+ commits behind local `main`), so no live order has ever gone through the idempotency-token path yet | Not a regression; confirms the feature simply isn't live yet |
| `audit-pos-inventory-state.ts` | 49 items checked, 0 mismatches | Prior baseline | Clean |
| `audit-purchase-ledger.ts` | Informational sample output, no violation counters raised | Prior baseline | Clean |
| `audit-po-save-ledger.ts` | Reports 55/55 completed POs "mismatched" | **New finding, root-caused below — not a real data problem** | See section 3 |

## 3. New finding: `audit-po-save-ledger.ts` uses a stale column name

The script groups `Purchase_Order_Lines` rows by `line.po_id` (`scripts/audit-po-save-ledger.ts:26`).
The actual schema column, per `supabase/migrations/0001_init_schema.sql:344`
(`create index ... on public.purchase_order_lines(purchase_order_id)`), has
always been `purchase_order_id`, not `po_id`. This means the script's
`linesByPo` grouping has never matched a single row correctly since the
Supabase migration — every completed PO looks like it has 0 lines to the
script, so any PO with real ledger rows is flagged as a "mismatch." The
June 25 baseline recorded "0 mismatch" only because, at that time, there
were apparently too few completed POs with ledger rows for this always-wrong
grouping to surface a difference; by now, all 55 completed POs trigger it.

Verified independently with a throwaway script (outside `scripts/`, deleted
after use) that re-ran the exact same logic with the correct column name
(`purchase_order_id`): **0 missing, 0 mismatch across all 55 completed POs.**
Real purchase-order and ledger data is fully consistent — this is purely a
stale audit-tool bug, not a production data-integrity issue.

Per the `scripts/` Codex-ownership rule, this fix was not made directly (it's
a separate, unrelated bug from Gate 8's own scope, discovered incidentally
during the regression sweep — not part of the pre-approved exception for the
`audit-admin-action-auth.ts` fix). Logged as a new P2 backlog item for Codex
in `docs/ROADMAP.md` (`SCRIPT-BUG-1`).

## 4. Cross-gate consistency spot-check

- POS checkout (Gate 5 idempotency) → order detail (Gate 7 scoping) → COGS
  (Gate 4 atomic RPCs): the P&L/MAC consistency audit (0 delta) and the
  order-ledger audit (stable 301 known mismatches, not growing) together
  confirm these three gates' outputs still agree; no separate live checkout
  was run since production isn't on this code yet.
- Admin backup page removal (FIX-2) vs. Drive backup path (Gate 7 recap):
  grepped the full `app/`/`components/` tree for `admin/backup` references —
  none remain. No stale UI/doc inconsistency.

## 5. Verification

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 551/551 (up from 540 — the 11 new `audit-admin-action-auth-core` tests).
- `npx next build`: succeeded.
- `git diff --check`: clean.
- No push, no merge beyond what's already recorded above, no production writes.

## 6. Functional baseline

- `main` HEAD: `a0a07e4d747b488eab3adb632bcf7b2c3fd7841b` (2026-07-20 00:37:28 +0700).
- This is the commit the owner should treat as "everything Gates 1-8 have
  verified so far" for any future regression comparison.

## 7. Acceptance

This report states facts; it does not declare the 8-gate audit program
"accepted" or "complete." Outstanding items before that determination:

- `REV-2` (Codex retroactive review of the `audit-admin-action-auth.ts` fix) — pending, Codex rate-limited until 2026-07-25.
- `SCRIPT-BUG-1` (`audit-po-save-ledger.ts` column-name fix) — pending, same constraint.
- `PROD-BUG-1` (live production client-side crash) — pending, ongoing, unrelated to Gate 8.
- `SEC-4` (Supabase Edge Function JWT deployment settings) — pending, needs Supabase dashboard access.
- The known, already-accepted backlog items (negative stock, 301 replay mismatches, 12 backdated-ledger MAC lines, `UCK000269` line-less order) remain open by design — they're tracked, not blocking.

The owner should make the final "accepted" call once satisfied with the above.
