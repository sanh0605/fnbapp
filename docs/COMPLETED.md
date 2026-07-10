# Completed Work Archive

Compact 1-line-per-task archive of finished work. Detailed entries remain in `DEVELOPMENT-TRACKING.md` (chronicle log, newest first).

## 2026-07-10

- **Task 3.2 Phase E (Codex)** — Integration smoke test for backdated detection pipeline. Commit `852537c`. Verified 17 PASS / 0 FAIL against production.
- **Task 3.2 Phase F (Claude)** — Added sidebar nav link for backdate review page. Commit pending this cleanup.

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
