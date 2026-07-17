# Completed Work Archive

Compact 1-line-per-task archive of finished work. Detailed entries remain in `DEVELOPMENT-TRACKING.md` (chronicle log, newest first).

## 2026-07-17

- **POS-REDESIGN-1 Session 1. Leaf components (Antigravity, Claude reviewed)** — Redesigned three leaf components (ProductCard, CartItemRow, DiscountBadge) according to Option A (Modern minimal soft) with rounded-2xl corners, soft shadows, and micro-transitions. Fully mobile-first design: cart rows stack into 2-lines on 375px screens, touch targets increased to >=44px. Verification: build clean, TS clean, tests 403/403 pass. Commit: pending.
- **UI-REMED-6 — Remove StickyFilterBar, use PageHeader (Antigravity, Claude reviewed)** — Removed StickyFilterBar pattern from 18 client files, replaced it with standard PageHeader + inline filter row (`flex flex-wrap items-end gap-3 mb-6`) layout. Deleted file `components/StickyFilterBar.tsx`. Verification: build clean, TS clean, tests 403/403 pass. Commit: `7eecf7e`.
- **UI-REMED-1 TOKEN-SWAP migration (Antigravity, Claude reviewed)** — Bulk migrated 1039 raw Tailwind color occurrences (94% coverage) to Fresh Blue design system tokens across all components and pages in 5 sequential phases. Automated check, TS compilation, and production build verify zero syntax or visual regression errors. Commits: `c33033f`, `8f93742`, `d239cbb`, `55ef69d`, `ee33450`.
- **UI-REMED-5 — Button warning variant + Dialog icons (Antigravity, Claude reviewed)** — Added `warning` variant to `components/ui/Button.tsx` (using opacity hover/active with warning token) and updated DialogHost variant mapping (`warning -> warning` not `-> danger`). Added variant-specific icons (info -> CheckCircle2/success, warning -> AlertTriangle/warning, danger -> XCircle/danger) in a centered circular layout inside Dialog. Created `components/DialogHost.test.tsx` containing comprehensive unit tests verifying all three variants. Verification: build clean, TS clean, tests 403/403 pass. Commit `11c566b`.
- **UI-REMED-3 Verification Pass — 20-question checklist (Antigravity, Claude reviewed)** — Verification after Session 2 close. Results: 19 PASS + 0 FAIL + 1 N/A (POS success uses inline indicator, not dialog — design choice). All dialog interactions work (ESC, click-outside, focus trap, queue semantics, mobile 375px bottom-sheet). 2 design gaps surfaced (non-blocking, deferred to UI-REMED-5 P2): (A) Button component lacks `warning` variant — DialogHost maps warning → danger (red); (B) DialogHost doesn't render icons by variant. Functional + accessibility verified. Commit `1ee270a`.
- **UI-REMED-4 — Root error/loading boundaries (Antigravity, Claude reviewed)** — Created `app/error.tsx` (global error boundary with `role="alert" aria-live="assertive"`, Fresh Blue tokens, AlertTriangle icon, "Thử lại" button min-h-44px mobile-first, error.digest mono display). Created `app/loading.tsx` (Skeleton-based with `aria-busy="true" aria-live="polite"`). Filled 5 missing `loading.tsx` in route segments: `inventory/purchase-orders/[id]`, `inventory/purchase-orders/new`, `users/edit/[id]`, `audit/backdated-ledger/[eventId]`, `products/toppings`. Form/detail routes use custom loading mimicking actual layout. Tested by temporary `throw new Error()` in brands page (reverted). Tests 399/399, TS clean, build clean. Commit `c923086`.
- **UI-REMED-3 Session 2 — Bulk migrate alert/confirm to Dialog API (Antigravity, Claude reviewed)** — Migrated ~52 native `alert()` / `confirm()` call sites across 18 source files to `lib/dialog` imperative API. Pattern: `alert("X")` → `await alert({ message: "X", variant: "warning|danger|info" })`. Made containing functions async, preserved all message text + control flow 100%. Contextual title/variant assignment based on semantic (validation→warning, critical→danger, success→info). Independent grep `\balert\(['"]|\bconfirm\(['"]` in `.ts`/`.tsx` returns 0 matches. Visual verify critical flows (POS checkout, PO submit, stock adjustment delete, form validation) at 375px + 1280px. Tests 399/399 pass. Commit `2f91b3f`. **UI-REMED-3 saga complete.**
- **UI-REMED-3 Session 1 — Imperative Dialog API + components (Antigravity, Claude reviewed)** — Created `components/ui/Dialog.tsx` (ARIA + focus trap + smart click-outside detection via `mouseDownTarget` pattern, mobile-first bottom-sheet at 375px, centered at md+), `lib/dialog.ts` (queue semantics via `useSyncExternalStore`, Promise-based `alert()` + `confirm()` with variant defaults), `components/DialogHost.tsx` (global mount in `app/layout.tsx`). Added `jsdom` devDep + `vitest.config.ts` tsx support. Proof-of-concept migration: 2 `alert()` calls in `app/admin/inventory/sync/page.tsx` replaced with `await alert({...})`. Tests: Dialog (ESC, click-outside, focus trap) + dialog lib (queue, Promise resolve). Commit `dd51dae`. Session 2 (53 remaining call sites) next.

## 2026-07-16

- **UI-REMED-2 — Redesign StickyFilterBar with design system tokens (Antigravity, Claude reviewed)** — Single-file redesign of `components/StickyFilterBar.tsx`. Hardcoded Tailwind colors → design tokens (`bg-surface-card`, `text-text-primary`, `text-text-secondary`, `border-border`, `bg-surface-secondary`, `rounded-button`). Mobile expand button aligned to Button secondary variant style. API preserved 100% (props unchanged) — 16 client components inherit new style automatically. Sticky positioning + mobile expand logic preserved. Title typography aligned to PageHeader (`text-2xl`, dropped responsive `md:text-3xl`). Tests: TS 0 errors, build success. Commit `6b65aba`.
- **Task 3.10 — Audit operational clean definition + display (Codex, Claude reviewed)** — Improved `scripts/audit-mac-drift-baseline.ts` stdout + exit code semantics. "Operationally clean" = STORED=0 + NEW=0 + KNOWN_NOT_LOCKED=0 (REPLAY informational, does not affect). Exit 0 if clean, exit 1 if REVIEW REQUIRED. 3 new test scenarios (clean / STORED violation / NEW investigation). Policy doc `docs/audits/2026-07-16-btp-recipe-replay-drift-policy.md` updated with operational clean section. First live run: OPERATIONALLY CLEAN, exit 0. Tests 391/391 (+3). Commit `6a5bdec`. **MAC drift audit saga complete.**
- **Task 3.5 — Cohort-aware MAC drift baseline audit (Codex, Claude reviewed)** — Refactored `scripts/audit-mac-drift-baseline.ts` + `lib/mac-drift-baseline.ts` to classify mismatches into 4 top-level buckets: LOCKED_MATCHED, LOCKED_VIOLATION, KNOWN_NOT_LOCKED, NEW_INVESTIGATION_NEEDED. LOCKED_VIOLATION sub-classified into STORED (critical, security incident) + REPLAY (informational, known BTP drift pattern). Frozen artifact protection: refuses to overwrite `2026-07-09-mac-drift-baseline-lines.json` (SHA-256 assertion). Date-stamped output: `<YYYY-MM-DD>-mac-drift-baseline-audit.json`. First live run: 396 mismatches classified (380 LOCKED_MATCHED + 16 LOCKED_VIOLATION_REPLAY + 0 critical + 0 new). 16 REPLAY_DRIFT lines = E3 baseline cohort lines also affected by BTP-002 recipe drift (Task 3.10 follow-up). Tests 388/388 (+3 classification). TS clean. Commit `c28319d`.
- **Stabilization Phase 3 — Push to origin/main (Claude)** — 2 docs commits close-out stabilization phase. Pre-push: `npm run build` clean (all routes generated, no errors). Commit A `86f2b89`: docs sync (DEVELOPMENT-TRACKING, COLLABORATION, COMPLETED, ROADMAP) + `.gitignore` update (exclude debug scripts, `.agents/`, `skills-lock.json`, `supabase/.temp/`) + untrack `supabase/.temp/cli-latest`. Commit B `3a55939`: 5 handoff briefs (Tasks 3.4/3.6/3.7/3.8/3.9) + stabilization phase plan. Fast-forward push to `origin/main` successful — HEAD now at `3a55939`. Total commits pushed: 50+ (E3 recovery, MAC drift saga Task 3.4-3.9, U4 design system, modifiers page redesign, cursor pagination, Phase 1 UI audit, Phase 2 Drive backup). Vercel auto-deploys on push.
- **Stabilization Phase 2 — Daily Google Drive backup via Apps Script pull-model (Codex, Claude reviewed)** — Production verified. Architecture: Apps Script trigger ~02:30 UTC+7 → POST Edge Function với `X-Backup-Token` → 32-table JSON snapshot → write to Drive. Folder layout: `daily/fnbapp-backup-YYYY-MM-DD.json` (180 retention) + `monthly/fnbapp-monthly-YYYY-MM.json` (indefinite). schemaVersion 2 (32 tables, thêm `sync_state`, `data_migration_runs`, `data_recovery_changes`, `audit_baseline_locks`, `backdated_ledger_events`). Migration threshold: 20MB warning, 25MB migrate to R2/B2. Backup ownership added to `docs/COLLABORATION.md` Section C (Codex owns). Commits `98557ed`, `0fb8f9d`, `9dddc4a`. Production deployed + manual run verified + file xuất hiện trong Drive. No pg_cron/pg_net migration.
- **Task 3.9 — Backdated historical gap cohort lock (Codex, Claude reviewed)** — Production write. Atomic bulk INSERT of 41 lines into `audit_baseline_locks` with reason `BACKDATED_LEDGER_HISTORICAL_GAP` and source hash `2ac54a604fc03c438dbf8f99039e57d068b8b270aadb092bf74a2e5a0538ae24`. Total locks 395 → 436. Cohort delta -43,809 VND. No recompute, no migration. Source: Task 3.8 gap report (`docs/audits/2026-07-16-task-3.8-backdated-events-surface.json`). Planner pattern cloned from Task 3.7. Post-apply: 41/41 cost unchanged, idempotent rerun `ALREADY_APPLIED`, trigger blocks sample UPDATE. Tests 375/375 (+10), TS clean. Commit `09bf26a`. **MAC drift audit fully clean** — 436 total locks, 0 unexplained mismatches.
- **Stabilization Phase 1 — UI consistency audit (Antigravity, Claude reviewed)** — REPORT ONLY. `scripts/audit-ui-consistency.ts` + `docs/audits/ui-consistency-2026-07-16.md`. 1279 issues across 5 categories: TOKEN-SWAP (1105 raw Tailwind colors), REMOVE-STICKYBAR (73), REPLACE-ALERT (54 native alert/confirm), ADD-ERROR-BOUNDARY (37 routes missing error.tsx), ADD-LOADING (10 routes missing loading.tsx). Zero source edits. Drives 4 post-push remediation backlog items. Commit `cdc8d56`.
- **Task 3.7 — BTP recipe replay drift cohort lock (Codex, Claude reviewed)** — Production write. Atomic bulk INSERT of 225 lines into `audit_baseline_locks` with reason `BTP_RECIPE_REPLAY_DRIFT` and source hash `a24f0d1fba13f1c73e853055ada598b3227b94ed7e788720a6e3948fc8c48c2e`. Total locks 170 → 395. Cohort: 90 PRE_BASELINE_WINDOW (-107,225 VND) + 22 BASELINE_SELECTION_GAP (-25,662 VND) + 71 POST_CUTOFF_NEW_DRIFT (-67,221 VND) + 42 LATE_PO_RECEIPT (+6,809 VND) = -193,299 VND. No recompute, no migration. Policy: `docs/audits/2026-07-16-btp-recipe-replay-drift-policy.md`. Pure planner + tests pattern (matches E3 design). Post-apply: 225/225 cost unchanged, idempotent rerun `ALREADY_APPLIED`, trigger blocks sample UPDATE. Tests 363/363 (+10), TS clean. Commit `d2177ca`. **MAC drift audit now clean except 41 BACKDATED_LEDGER_LIKE (Task 3.2 path).**

## 2026-07-15

- **Task 3.6 — Forward-drift investigation: active BTP shortfall (Codex, Claude reviewed)** — Read-only. 113/113 lines classified (71 frozen post-cutoff + 42 newer). Root cause: temporal asymmetry — order line pins top-level recipe but BTP shortfall decomposition uses CURRENT nested BTP recipe at replay. 64/71 lines reproduced exactly with sale-time recipe; 7 lines reproduced with previous recipe (schema lacks `Recipes.recorded_at`, ambiguous). 42 newer lines = durable late PO receipts (migration 0014 captured). MAC write-formula bug rejected (POS vs audit 0/113 difference). tuyen2612 concentration dismissed (97.18% drift vs 97.93% all July orders base rate). No recompute candidate. **Key insight**: stored COGS correct at sale time; drift is replay-only artifact; financial reports unaffected. Commit `d32d4d4`.
- **Task 3.4 — Investigate 224 outside-cohort MAC mismatches (Codex, Claude reviewed)** — Read-only investigation. Population stable: 354 = 130 locked + 224 outside, 0 overlap. Final disjoint classification: 41 BACKDATED_LEDGER_LIKE (-43,809 VND, Task 3.2 review path), 90 PRE_BASELINE_WINDOW (-107,225 VND), 22 BASELINE_SELECTION_GAP (-25,662 VND), 71 POST_CUTOFF_NEW_DRIFT (-67,221 VND). 0 PURCHASE_COST_RECOVERY_LIKE → no E4 selective recovery. Sign clarified: all 224 negative = stored > replay (over-stored). Concentration: PROD-006 = 126/224 lines (56%), BTP-002 = 183/224 (81%). Locked replay shift +120,716 → +102,621 VND documented. 42 new outside lines appeared during investigation → forward-drift evidence (separate task). Commit `fea097d`.
- **E3. Task 3 selective recovery (Codex, Claude reviewed)** — Atomic 40-line `PURCHASE_COST_RECOVERY` cohort recomputed via RPC `task-3-recovery-2026-07-13-081930193Z`. -933 VND stored COGS correction (415,160 → 414,227). Migration `0012_mac_drift_baseline_locks.sql` deployed with RLS, advisory locks, expected-old-value checks. Six cohort gates passed (recovered 0/40 mismatch, untouched 0/130 changed, 40 audit rows, trigger blocked, cohort drift -933→0, isolation confirmed). 130 locked lines intentionally retained (BACKDATED_LEDGER + UNRESOLVED_WRITE_TIME_PROVENANCE). Rollback procedure documented. Commits `996b09d`, `da525d3`, `02bfc3c`, `f4722a6`.

## 2026-07-13

- **E2. Task 3.3 — Investigate remaining 97.6% drift (Codex)** — Read-only replay classified the fixed 170-line baseline into 40 purchase-cost-recovery lines, 34 known backdated-ledger lines, and 96 lines whose exact write-time inputs are no longer reconstructable. Added a reproducible audit script, structured JSON artifact, and investigation report. Verification: 336/336 tests, TypeScript 0 errors.

## 2026-07-12

- **U5. Modifiers page design system migration (Antigravity)** — Final U4 cleanup. 36 hardcoded colors → 0 in `/admin/products/modifiers/`. Did NOT touch `actions.ts` (Codex logic). Commit `31c2a95`. **Design System 100% complete**.
- **U4. Fresh Blue Admin Design System (Antigravity)** — Full design system migration across all admin pages. 17 commits: Phase 0 audit → Phase 1 tokens → Phase 2 dark sidebar + Lucide → Phase 3 component library (Button/Alert/Badge/Card) → Phase 4 high-impact pages (Products/Orders/Dashboard/Reports/Inventory) → Phase 5 remaining pages by sidebar group → Phase 5 cleanup → Phase 6 final report. ~143 files changed, 0 hardcoded Tailwind colors (except Codex `modifiers/` scope). Final report at `docs/audits/2026-07-12-fresh-blue-admin-final-report.md`. Subsumes U2 (UI consistency sweep batches 1-5 + mobile retrofit + Batch 4 re-commit).

## 2026-07-11

- **U2. UI consistency sweep — partial (Antigravity)** — Batches 1, 1R (mobile-first retrofit), 2, 3, 4 (re-committed surgical), 5. Subsumed by U4 design system which standardized all patterns comprehensively.

## 2026-07-10

- **E1. Task 1 — Modifier recipe save hardening (Codex)** — `planRecipeSave` for MODIFIER, only close latest active recipe when changed, same recipe is no-op. Commit `b6ffd73` (done 2026-07-09, marked complete 2026-07-10). Tests: 15/15 targeted + 335/335 full.
- **U1. Sidebar reorg + accordion UX (Antigravity)** — Workflow-based 8-group nav structure with clear Vietnamese labels + single-open accordion + thin scrollbar safety net. Commit `6a3980c`. Subsumes U3 (backdate label/group fix).
- **U3. Backdate page label/group fix (Antigravity)** — Resolved by U1. Page moved to "Nhập hàng & Tồn kho" group, relabeled "Nhập hàng chờ duyệt".
- **Task 3.2 Phase E (Codex)** — Integration smoke test for backdated detection pipeline. Commit `852537c`. Verified 17 PASS / 0 FAIL against production.
- **Task 3.2 Phase F (Claude)** — Added sidebar nav link for backdate review page. (Subsumed by U1 reorg.)

## 2026-07-09

### Engine (Codex)

- **Task 4 — Timezone display** — Migration 0013 `ALTER ROLE postgres SET timezone`. Commit `4121813`. Verified Dashboard shows `Asia/Ho_Chi_Minh`.
- **Task 3.2 — Backdated receipt detection + manual review pipeline** — 4 phases (A/B/C/D), migrations 0014 + 0015. Commits `c561e43`, `2d86c45`, `03c54a0`. Deployed + verified via Phase E.
- **Task 3.1 — PROD-028 BTP_SHORTFALL investigation** — Confirmed backdated PO-051 root cause. Commit `8f8bcf7`.
- **Task 3 — MAC drift baseline audit** — 170 lines / +119,782 VND baseline. Commit `be2370e`. Recovery deferred (Path 3, low materiality).
- **Task 2.1 — Idempotency precision fix** — Migration 0011 `round(..., 6)` in EXCEPT ALL. Commit `4f9a647`. Deployed + verified `already_applied: TRUE`.
- **Task 2 — Idempotency fix** — Migration 0010. Superseded by 0011.
- **DB viewer timezone evaluation** — Phase A audit doc recommending narrowed Option A. Commit `f01c151`.

### UI (Antigravity)

- **Task 3.2 Phase C — Backdated ledger review UI** — `/admin/audit/backdated-ledger` list + detail + server actions + 6 components. Commits `d686b37`, `b6f2895`.
- **UI consistency audit & fixes (Phases A & B)** — PageHeader, EmptyState, Skeleton components + applied to orders/reports pages.
- **Modifier recipe save hardening audit** — Phase 1.5 audit doc, prompt written (engine work still pending as E1).

### Coordinator (Claude)

- **Hồng→Lục migration apply** — 4 orders migrated, COGS -9,553 VND. Snapshot `recovery-20260706T053239562Z`.
- **Task 3.2 prompts (A/B/C/D/E)** — 5 handoff prompts coordinating Codex + Antigravity.
- **Deploy migrations 0011-0015** — 5 migrations applied via `supabase db push`.

## 2026-07-06

### UI (Antigravity)

- **URL state sync scale** — Extracted `useUrlState` helper, applied to Items/Stock Adj/Promotions pages.
- **Snapshot-first lookup audit** — Order pages use product/variant snapshots.
- **Intl.NumberFormat centralization** — `lib/format.ts` centralizes VND formatting.
- **URL state sync pilot** — `/admin/orders` filter URL params work for bookmarking.
- **Vietnamese diacritics sweep** — BrandForm labels/buttons.
- **Order list/detail snapshot-first** — Product name fallback to snapshot.

### Engine (Codex + Claude)

- **Hồng trà chanh → Lục trà chanh migration** — Migration script + RPC atomic apply.

## 2026-07-04

### UI (Antigravity)

- **UI accessibility & transitions** — `aria-live` regions, `touch-action`, form `htmlFor`.
- **Bán thành phẩm Desktop Layout (3A)** — Products list responsive.
- **Stock Adjustments / Activity Log / Backup pages** — New admin pages.

### Engine (Codex)

- **Recipe selection hardening + history audit** — `lib/recipe-selection.ts` improvements.

### Coordinator (Claude)

- **UI Audit + Phase A Shared Components** — EmptyState, PageHeader, Skeleton built.

## 2026-07-03

- **PO-2 request-scoped MAC index for P&L** (Codex) — Performance optimization.

## Earlier (pre-2026-07)

- Supabase migration complete (initial schema setup).
- Many earlier entries in `DEVELOPMENT-TRACKING.md`.

## Change log

- 2026-07-10 Claude: created as compact archive. Source: `DEVELOPMENT-TRACKING.md` (still maintained as detailed chronicle).
