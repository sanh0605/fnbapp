# Completed Work Archive

Compact 1-line-per-task archive of finished work. Detailed entries remain in `DEVELOPMENT-TRACKING.md` (chronicle log, newest first).

## 2026-07-12

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
