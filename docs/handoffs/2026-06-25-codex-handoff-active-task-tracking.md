# Codex Handoff — 2026-06-25

## 2026-07-09 - Postgres role timezone migration Task 4

- `[x]` Added `supabase/migrations/0013_set_postgres_role_timezone.sql`.
- `[x]` Migration uses `current_database()` in a DO block to avoid hardcoding
  the database name.
- `[x]` Only `postgres` receives default timezone
  `Asia/Ho_Chi_Minh`; `service_role` and `authenticated` are intentionally
  unchanged.
- `[!]` Not deployed. Claude should deploy and verify from a fresh Supabase SQL
  Editor session.

Commit: pending.

## 2026-07-09 - PROD-028 BTP_SHORTFALL active drift investigation Task 3.1

- `[x]` Added read-only debug trace script
  `scripts/debug-prod-028-btp-shortfall.ts`.
- `[x]` Added investigation doc
  `docs/audits/2026-07-09-prod-028-btp-shortfall-investigation.md`.
- `[x]` Confirmed root cause: PO-051 for `NNL-007` was created at
  `2026-07-06T04:38:14.956371Z` but effective in stock ledger at
  `2026-07-04T17:00:00Z`; the 8 affected `PROD-028` sales occurred between
  those timestamps.
- `[x]` Replaying without PO-051 exactly matches stored COGS for sample lines:
  PHD000883 4,512 VND and PHD000893 11,280 VND.
- `[x]` Rejected PROD-028 recipe gap and POS-vs-audit algorithm mismatch for
  this active source.
- `[!]` Recommended Task 3.2 backdated purchase receipt impact detection/policy
  before Option B recovery. Option A lock remains possible only as a snapshot.
- `[!]` No code fix, no migration deploy, no lock insert, and no recovery apply.

Commit: pending.

## 2026-07-09 - MAC drift baseline recovery plan Task 3

- `[x]` Revised live baseline: 170 `Order_Lines_V2` rows, audit total delta
  +119,782 VND.
- `[x]` Added read-only audit script
  `scripts/audit-mac-drift-baseline.ts`.
- `[x]` Added audit document
  `docs/audits/2026-07-09-mac-drift-baseline-audit.md`.
- `[x]` Added line artifact
  `docs/audits/2026-07-09-mac-drift-baseline-lines.json`.
- `[x]` Investigated the old 164-line baseline movement. Current data has 8
  post-2026-07-02 non-migrated live POS lines for `PROD-028` totaling +713 VND;
  only 2/170 drift lines have migrated markers.
- `[x]` Added migration `0012_mac_drift_baseline_locks.sql` targeting
  `order_line_id`, with an update/delete prevention trigger and atomic recovery
  RPC.
- `[x]` Added dry-run recovery script `scripts/recover-mac-drift.ts`; generated
  `docs/audits/2026-07-09-mac-drift-recovery-plan.json`.
- `[!]` Migration 0012 was not deployed; no lock rows inserted; recovery
  `--apply` was not executed.

Commit: pending.

## 2026-07-09 - Hong to Luc idempotency precision fix Task 2.1

- `[x]` Chose Option C: SQL-side rounding in the idempotent rerun check.
- `[x]` Added migration `0011_hong_to_luc_idempotency_precision_fix.sql`.
- `[x]` Existing-run semantic ledger multiset comparison now rounds expected
  `quantity_change` to 6 decimals before comparing with stored
  `stock_ledger.quantity_change`.
- `[x]` Rejected Option A because changing `stock_ledger.quantity_change`
  precision is a global schema change with unnecessary blast radius.
- `[x]` Rejected Option B as insufficient alone because existing
  `data_migration_runs.write_set` rows would still contain full JS precision.
- `[x]` Regression test added for the 0011 SQL shape.
- `[!]` Not deployed to Supabase and no production `--apply` rerun executed.
  Claude should deploy 0011 and rerun:
  `node_modules\.bin\vite-node.cmd scripts\migrate-hong-tra-to-luc-tra.ts --apply --snapshot-id recovery-20260706T053239562Z`.
- `[~]` Remaining priority recommendation: Task 3 MAC drift baseline recovery
  before Task 4 timezone implementation, because Task 3 affects financial
  correctness while Task 4 is UX-only.

Commit: pending.

## 2026-07-09 - Hong to Luc migration idempotency rerun fix

- `[x]` Added migration `0010_hong_to_luc_idempotency_fix.sql` with
  `CREATE OR REPLACE FUNCTION public.apply_hong_to_luc_migration`.
- `[x]` Existing-run ledger verification now compares semantic ledger content as
  a multiset: `transaction_type`, `reference_id`, `item_reference`,
  `quantity_change`, and `source`.
- `[x]` Existing-run ledger verification intentionally ignores transient
  generated fields such as `id` and `created_at`.
- `[x]` Write path remains unchanged from migration 0009.
- `[x]` Regression test added for the SQL shape.
- `[!]` Not deployed to Supabase and no production `--apply` rerun executed.

Commit: pending.

## 2026-07-09 - Modifier recipe save hardening Phase 1.5

- `[x]` Modifier save now uses `planRecipeSave` for `MODIFIER` targets.
- `[x]` Duplicate open modifier recipes are resolved deterministically by latest
  `created_at`, matching the product save hardening pattern.
- `[x]` Unchanged latest modifier recipe is a no-op; changed ingredients close
  only the latest active recipe before inserting one new version.
- `[x]` Regression tests added for action-level duplicate-open behavior and
  generic `MODIFIER` helper coverage.
- `[x]` Vitest: 314/314 pass; TypeScript: 0 errors.
- `[!]` Modifier delete path still uses first open recipe selection and remains
  out of scope for this phase, matching the user prompt.

Commit: pending.

## 2026-07-04 - Recipe selection hardening

- `[x]` Product save selects the latest ACTIVE, open recipe deterministically.
- `[x]` Pure save planner verifies same=0 and changed=1 recipe versions.
- `[x]` Read-only recipe audit distinguishes true drops, type replacements,
  quantity changes, multiple-active rows, ambiguity, and invalid JSON.
- `[x]` Live audit: 49 variants; 1 cleanup candidate.
- `[!]` Hồng trà chanh `REC-068` removed Trái chanh and awaits the user's
  cleanup option; no data correction was executed.
- `[x]` Cà phê đá BTP-004 to ING-022 is a same-name type replacement, not
  corruption.
- `[x]` Vitest: 278/278 pass; TypeScript: 0 errors.
- `[x]` Claude review approved before commit.

Spec:
`docs/superpowers/specs/2026-07-04-recipe-selection-hardening-design.md`.

Report:
`docs/audits/2026-07-04-recipe-audit.md`.

## 2026-07-03 - PO-2 P&L request-scoped MAC index

- `[x]` Replaced two per-request P&L MAC index builds with one shared index.
- `[x]` Rejected the module hash-cache design after measuring a CPU regression.
- `[x]` Two builds: 24.78ms; one request-scoped build: 9.76ms.
- `[x]` Live P&L parity: 71 orders, 1,052,701 VND COGS, 25 ingredient rows.
- `[x]` P&L product/topping and ingredient consistency deltas: 0 VND.
- `[x]` Vitest: 266/266 pass; TypeScript: 0 errors.
- `[x]` Claude review approved before commit.
- `[!]` The existing 164 historical MAC drift lines (+119,036 VND) remain a
  separate data-recovery task and were not changed.

Spec:
`docs/superpowers/specs/2026-07-03-pnl-mac-index-reuse-design.md`.

## 2026-07-02 - P&L MAC performance

- `[x]` Added a reusable stock-ledger index grouped by item.
- `[x]` Replaced repeated historical balance rebuilds with a running window.
- `[x]` P&L benchmark improved from 18.17s to 3.80-4.31s.
- `[x]` Full Vitest: 257/257 pass.
- `[x]` P&L total, product/topping, and ingredient COGS reconcile at 0 VND
  delta.
- `[!]` Full TypeScript remains blocked by preserved untracked debug scripts;
  changed tracked files introduce no TypeScript errors.

Commits: `9a08486`, `5a0ada2`.

## 2026-07-02 - POS checkout performance and pending data recovery

- `[x]` Migration `0008_pos_checkout_performance.sql` deployed.
- `[x]` POS checkout uses compact inventory state and one atomic write.
- `[x]` Forced rollback probe: 0 partial orders, 0 partial lines.
- `[x]` Inventory-state parity: 0 mismatches across 48 items.
- `[x]` Reviewed `batch_yield`, `FLAT_VND`, POS ACTIVE filtering, and
  standalone topping setup/report/toggle.
- `[x]` June import structural review: 77 orders, 110 lines, 77 events, and 61
  ledger rows. The historical import script must not be reused.
- `[ ]` Resolve 3 negative-stock ingredients under a separate recovery plan.
- `[ ]` Prepare recovery for 164 historical MAC COGS line mismatches
  (+119,036 VND).
- `[!]` Full TypeScript hook is blocked by preserved untracked debug scripts
  from another session; tracked POS files introduce no remaining TS errors.

Record: `docs/audits/2026-07-02-pos-checkout-performance-review.md`.

> **READ FIRST**: `docs/COLLABORATION.md` — communication protocol + file map.

Yêu cầu gốc: review code changes của Claude (Phần A) + fix system-wide audit findings (Phần B).

Trạng thái từng item sẽ được update tại chỗ bằng marker (xem `docs/COLLABORATION.md` section 2):
- `[ ]` pending
- `[x]` done
- `[~]` partial
- `[!]` skip — có lý do
- `[-]` obsolete — direction change

---

## 2026-07-02 - Supabase recovery Phase B deployed

### Prepared and verified

- `[x]` Decimal PO receipt costs are preserved (`fdde00f`).
- `[x]` Atomic PO RPC and migration are prepared but not deployed (`207b067`).
- `[x]` PO line and receipt-ledger IDs no longer use read-max allocation
  (`81aca92`).
- `[x]` Migration validation rejects null/malformed payloads before ID
  allocation (`29a9e3c`).
- `[x]` Full test gate: 232/232 pass after snapshot tooling.
- `[x]` Read-only readiness source audit: 8/8.
- `[x]` Read-only remote probe: `NOT_DEPLOYED`.
- `[x]` Initial immutable dual-source snapshot captured and verified:
  `recovery-20260701T151428127Z` (108/108 files valid).
- `[x]` Fresh pre-deployment snapshot captured and verified:
  `recovery-20260701T152243267Z` (108/108 files valid).
- `[x]` Migration `0006_atomic_purchase_order_write.sql` deployed.
- `[x]` Remote guard probe reports `READY`.
- `[x]` `savePurchaseOrder` uses the atomic RPC.
- `[x]` Forced failure on PO-048 rolled back with identical before/after hash.

### Must not be skipped

- `[x]` Purchase-order safety deployment completed without historical data
  correction.
- `[!]` Create another fresh immutable snapshot immediately before historical
  data repair; operational data continues to change.
- `[x]` Historical material PO rounding drift repaired through reviewed plan
  `PURCHASE-COST-ROUNDING-2026-07-02`; 3 audit-log rows, idempotent re-run 0.
- `[x]` Material purchase-cost mismatches remaining: 0.
- `[ ]` Diagnose and resolve the 3 remaining negative-stock ingredients.
- `[ ]` Prepare a separate recovery plan for 164 historical MAC COGS lines;
  do not combine it with inventory-quantity corrections.

Current production baseline remains dirty: 3 negative stock items, 119 MAC
drift lines (+121,370 VND), and 3 material PO cost mismatches. No production
data was written during Phase B.

---

## Pending hand-off tasks (by owner)

Bảng tổng hợp các task đang chờ owner khác pick up. Chi tiết trong từng direction log entry bên dưới.

> **Roadmap đầy đủ**: `docs/audits/system-optimization-roadmap.md` — tổng hợp toàn bộ optimization tasks (P0-P3), để long-term planning.

### Antigravity (UI)

| Marker | Task | File | Spec |
|---|---|---|---|
| `[x]` | Admin toggle page (server component) | `app/admin/products/toppings/page.tsx` (new) | `docs/superpowers/specs/2026-06-27-topping-standalone-design.md` §Admin UI |
| `[x]` | Admin toggle component (client) | `components/ToppingsManager.tsx` (new) | same spec |
| `[x]` | Toggle server action | `app/admin/products/toppings/actions.ts` (new) | same spec §Server action |
| `[!]` | (Codex review required after Antigravity PR) | — | per COLLABORATION.md rule C |

### Codex (engine / data review)

| Marker | Task | Notes |
|---|---|---|
| `[ ]` | Post-hoc review: `scripts/import-june-2026-sales.ts` (applied 2026-06-27) | Order creation + MAC COGS + ledger writes; user verbally approved without Codex review. |
| `[ ]` | Post-hoc review: `scripts/setup-topping-standalone.ts` (applied 2026-06-27) | Catalog mutation (CAT-007 + 7 products/variants/recipes). |
| `[ ]` | Review: POS filter fix `app/pos/page.tsx:42-45` (applied 2026-06-27 by Claude) | `status !== "DELETED"` → `status === "ACTIVE"`. Data flow impact. |
| `[!]` | Review: toggle server action after Antigravity ships it | Mutates Products sheet. |

---

## Direction change log

### 2026-06-27 (Antigravity) — UI-17 revision
- Remove copy button + truncation per user feedback.
- Show full ID (reality: short codes like SPM-001, not UUIDs).
- Commit: 59fa72bdde954b01bdb26f5b0b915b0df97d10e6.

### 2026-06-27 (Antigravity) — UI-18 inventory mobile cards
- Mobile (< 768px) card layout for inventory items table.
- Same pattern as UI-13 (commit 6f0a3c3).
- Commit: a6475a6783c369b38fd56c781cee6788f9d6cc2b.

### 2026-06-27 (Antigravity) — UI-12 mobile heatmap accordion fix

- Refactor mobile heatmap từ flat list (~200-300 cards) → day-grouped accordion (7 sections max, default collapsed).
- Native `<details>`+`<summary>` cho accessibility, zero JS.
- Commit: `09713a30e34f4be2ecc706aa4cfaa4dbaf5b8191`.
- Claude review pending.

### 2026-06-27 (Claude) — Standalone topping report classification (actions done)

- New: standalone topping sales (CAT-007 products) routed into topping sections of Sales + P&L reports. Spec `docs/superpowers/specs/2026-06-27-standalone-topping-report-classification-design.md`.
- Implementation: `app/admin/reports/actions.ts` — both `getSalesDataV2` and `getPnLDataV2` build `standaloneToppingToModId` map and merge standalone with add-on via `MOD:<id>` key.
- No UI changes (page filters still work with `MOD:` prefix preserved).
- **Codex review (pending)**: data-flow change in `app/admin/reports/actions.ts`.
- Verification: `rtk tsc` 0 errors, `rtk vitest` 197/197 pass.

### 2026-06-27 (Claude) — Topping standalone sales setup (data done, UI pending)

- New: standalone topping sales. Spec `docs/superpowers/specs/2026-06-27-topping-standalone-design.md`.
- Data layer APPLIED: CAT-007 "Topping" + 7 Products (PROD-029..035) + 7 Variants (VAR-038..044) + 7 Recipes (REC-071..077). Re-run `scripts/setup-topping-standalone.ts` (dry-run by default) is idempotent.
- POS filter fix `[x]` DONE by Claude 2026-06-27: `app/pos/page.tsx:42-45` changed `status !== "DELETED"` → `status === "ACTIVE"` for categories/products/variants/modifiers. Aligns POS with `docs/domain-dictionary.md` INACTIVE contract.
- **Antigravity tasks (pending)** — see "Pending hand-off tasks" table above:
  - `[~A]` Admin toggle page `app/admin/products/toppings/page.tsx`.
  - `[~A]` Admin toggle component `components/ToppingsManager.tsx`.
  - `[~A]` Toggle server action `app/admin/products/toppings/actions.ts`.
- **Codex review (pending)** — see "Pending hand-off tasks" table above.
- See `DEVELOPMENT-TRACKING.md` 2026-06-27 topping entry for full context.

### 2026-06-27 (Claude) — June 2026 sales backfill import (Phin Đi)

- User-provided spreadsheet backfilled: 110 line items → 77 orders, Phin Đi brand, June 1-26.
- Order_no range PHD000661 → PHD000747. Gross 1.045.000 VND, COGS 268.876 VND, GP 776.124 VND.
- See `DEVELOPMENT-TRACKING.md` 2026-06-27 entry for full summary.
- **Codex post-hoc review requested**: `scripts/import-june-2026-sales.ts` chạm `buildOrderFromCart` + `insertOrderV2Records` + MAC COGS + ledger. User approved `--apply` without Codex review (verbal). Suggest Codex spot-check script logic + audit results before depending on this data in COGS/FIFO/P&L work.
- **Follow-up for user (non-blocking)**:
  - `Products.brand_id` missing for PROD-027 (Khoai lang) and PROD-028 (Trứng luộc) — recommend set `BR-001`.
  - VAR-036 has no recipe → COGS = 0. Recommend configure recipe + `apply-cogs-recalc.ts` for June range.

### 2026-06-26 (Codex) — Phase 9 negative stock diagnosis

- Phase 9 diagnosis and dry-run resolve plan are ready for Claude/user review.
- Diagnosis script: `scripts/diagnose-negative-stock.ts`.
- Diagnosis output: `docs/audits/2026-06-26-negative-stock-diagnosis.json`.
- Resolve script: `scripts/resolve-negative-stock.ts`.
- Dry-run result: 6 rows planned, no data written.
- Classification counts: `MISSING_PRODUCTION_YIELD=5`, `PO_RECEIPT_GAP=1`.
- Proposed writes after approval:
  - `PRODUCTION_YIELD` backfill rows for `BTP-008`, `BTP-003`, `BTP-010`, `BTP-002`, `BTP-011`.
  - `STOCK_ADJUST` row for `ING-015` +10 ml.
- Status: waiting for Claude/user approval before running `node_modules\.bin\vite-node.cmd scripts\resolve-negative-stock.ts --apply`.

### 2026-06-27 (Claude Coordinator) — Phase 9 applied

- Apply executed by Claude after Codex ran out of token (reset 1 Jul 15:44).
- 5 PRODUCTION_YIELD rows inserted (ING-015 self-balanced before apply due to June 2026 sales backfill commits).
- Reference ID: `PHASE9-NEGATIVE-STOCK-2026-06-26`. unit_cost=0 for all 5 (no prior yield history).
- Post-apply verification: `audit-current-stock.ts` 0 negative, 197/197 tests pass, idempotent re-run = 0 rows.
- **MAC drift 101 mismatches pre-existing** (not caused by apply) — root cause: 5 Claude commits about June 2026 sales backfill + topping standalone added new BTP_SHORTFALL orders. Logic verified: `lib/mac-cogs.ts:37,43` filter yield unit_cost=0 out of MAC calc.
- **Codex retroactive review needed** when token refreshes:
  1. Verify Phase 9 apply correctness (5 PRODUCTION_YIELD rows in Stock_Ledger with reference `PHASE9-NEGATIVE-STOCK-2026-06-26`).
  2. Investigate 101 MAC drift mismatches from June 2026 sales backfill (separate issue, not Phase 9).
- Pre-apply snapshot: `docs/audits/2026-06-27-phase9-pre-apply-snapshot.txt`.

### 2026-06-26 — MAC COGS primary direction

- User approved switching primary COGS valuation FIFO → MAC.
- Inventory quantity control remains ledger-based via `Stock_Ledger.quantity_change`.
- FIFO demoted to audit/debug only.
- Design note: `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`.
- Migration applied: 1267 historical lines MAC-recalc'd, 272 BTP shortfall correction rows added. All audits clean.

### 2026-06-26 (Claude) — Open Questions resolved + P&L breakdown flag

Spec đã update với 3 Open Questions answered (Q1 rewrite, Q2 không populate SALES_CONSUME.unit_cost, Q3 lazy SP MAC).

**P0 issue còn tồn tại — DEFERRED TO CODEX**:

**P&L breakdown recompute FIFO thay vì dùng stored MAC** (spec violation).

- `app/admin/reports/actions.ts:449-501` `splitLineCogsBySaleSource` — recompute FIFO để split variant vs modifier.
- `lib/report-v2-allocators.ts` `breakdownCOGSByIngredient` — recompute FIFO để breakdown theo ingredient.
- Tổng COGS = MAC stored (đúng), nhưng breakdown có thể lệch.

**Why Codex**:
- Codex viết MAC engine + write paths.
- Có thể có lý do giữ FIFO breakdown (audit?) — confirm trước.
- Refactor cần design decision: proportionally split stored MAC theo recipe quantity, hoặc MAC recompute via consumption rows (không FIFO).

**Tasks cho Codex**:
1. Confirm có lý do giữ FIFO breakdown không, hay là bug cần fix.
2. Nếu fix: refactor `splitLineCogsBySaleSource` + `breakdownCOGSByIngredient` dùng stored MAC hoặc MAC recompute.
3. Viết audit `scripts/audit-pnl-mac-consistency.ts` verify P&L total = sum cost_at_sale.
4. Update R1 status trong handoff: nếu breakdown refactor, `filterLedgerForFifoInit` có thể không còn cần ở allocators (chỉ giữ cho audit scripts).

**Spec compliance** (Codex has authority to edit if needed):
- Spec section "Outstanding (P0 — deferred to Codex)" có full context.
- Claude đã add UI note MAC tại `app/admin/reports/pnl/page.tsx` (giải thích breakdown FIFO informational).
- Claude giữ nguyên WS-12 fix (filterLedgerForFifoInit) để FIFO allocators chạy đúng khi còn tồn tại.

**Impact trên handoff items**:
- R1 (filterLedgerForFifoInit): vẫn valid NGAY BÂY GIỜ — FIFO allocators vẫn dùng cho breakdown. **Sẽ obsolete nếu Codex refactor breakdown sang MAC**.
- R6 (audit scripts): vẫn valid.
- Bug Đào miếng fix: vẫn valid (modifier COGS = 0 do filter thiếu).
- CODE-5 (parseSpIngredients): đã done bởi Claude.

---

## Phần A — Review code changes của Claude (phiên 2026-06-25)

### File cần đọc

**Overview docs (3 file):**
1. `docs/COLLABORATION.md` — communication protocol (READ FIRST)
2. `DEVELOPMENT-TRACKING.md` — 4+ entries mới nhất (2 Claude + 4 Codex MAC migration)
3. `docs/audits/2026-06-25-full-system-audit-roadmap.md` — Phase 0-5, 5A, 6.1 done
4. `docs/audits/script-cleanup-plan.md` — Phase 6.1 output

**Code modified (7 file):**
- `lib/report-v2-allocators.ts` — export `filterLedgerForFifoInit`, apply 2 chỗ
- `lib/report-v2-allocators.test.ts` — +2 regression tests WS-12
- `app/admin/reports/actions.ts` — apply filter + Phase 5.2 fields + Phase 5.3 timezone
- `app/admin/reports/sales/page.tsx` — +2 UI cards
- `app/admin/inventory/actions.ts` — `getRealtimeStock` non-inv filter + `submitStockAdjustment` reason required
- `lib/purchase-ledger-rebuild.ts` — 4 error msg tiếng Việt
- `lib/purchase-ledger-rebuild.test.ts` — update 2 regex match

**Code mới (2 file):**
- `lib/report-time.ts` — `toSaigonUtcRange` helper
- `lib/report-time.test.ts` — 6 tests

**Audit scripts mới (10 file trong `scripts/`):**
- `audit-void-orders.ts` (3.3)
- `audit-order-total-consistency.ts` (3.4)
- `audit-stock-ledger-schema.ts` (4.1)
- `audit-stock-adjustments.ts` (4.3)
- `audit-po-save-ledger.ts` (2.3)
- `audit-negative-periods-classification.ts` (4.4)
- `generate-script-cleanup-plan.ts` (6.1)
- `verify-cogs-allocation-impact.ts` (verify)
- `spotcheck-mod004.ts` (verify)
- `audit-dao-mieng-report-cogs.ts` (Codex's, kept)

### 8 Review points (Claude đã note trong `DEVELOPMENT-TRACKING.md`)

- [ ] **R1** `filterLedgerForFifoInit` — có cần loại thêm `STOCK_ADJUST`/`EDIT_CONSUME`? So sánh `lib/cogs-drift-audit.ts:136-143`. *(Vẫn valid dù MAC primary — FIFO vẫn dùng cho breakdown UI)*
- [ ] **R2** `toSaigonUtcRange` — behavior với ISO input không timezone suffix.
- [ ] **R3** `getRealtimeStock` cache staleness 60s cho `is_non_inventory` toggle.
- [ ] **R4** `sales/page.tsx:37-51` redundant date conversion — có nên đơn giản hoá?
- [x] **R5** Pre-existing TS error `lib/modifier-recipe.test.ts:21`. **Done by Claude (phiên 2026-06-26)** — narrow qua `if (!result.ok)` trước khi access `.error`.
- [ ] **R6** 7 audit scripts mới — review naming, output, read-only contract.
- [ ] **R7** `submitStockAdjustment` reason validation — UI form phải pass reason.
- [ ] **R8** Vietnamese error messages render đúng qua UI toast.

### Additional issues found in Codex MAC code (2026-06-26 Claude verify)

- [x] **R9** TS error `MacLedgerEntry` thiếu `reference_id` ở `lib/mac-cogs.ts:4-10` dù `lib/mac-cogs-audit.ts:138` dùng. **Done by Claude** — thêm `id?: string; reference_id?: string` vào type.
- [x] **R10** Runtime crash risk `lib/mac-cogs-audit.ts:187,236` — `row.item_reference.startsWith` mà `item_reference?: string`. **Done by Claude** — wrap `String(row.item_reference || "")`.
- [ ] **R11** `btp-shortfall-reprocess.ts:126` perf O(n²) — `workingLedger.filter()` mỗi order re-scan + growing workingLedger. *(Defer — 1-shot migration, performance acceptable)*
- [x] **R12** `buildLineConsumptionRows` + `modifierQtyByIdFromLine` trùng 4 chỗ. **Done by Claude (phiên 2026-06-26)** — extract `buildLineConsumptionRows` to `lib/inventory-consumption.ts`, replace 4 implementations.
- [x] **R13** FIFO drift audit `scripts/audit-cogs-drift.ts` giờ report nhiều mismatch (FIFO ≠ MAC). **Done by Claude (phiên 2026-06-26)** — added 3-line warning đầu output giải thích FIFO informational only, point tới MAC audit.

### Verify commands

```bash
rtk node_modules/.bin/vitest run                                       # 166/166
rtk node_modules/.bin/vite-node.cmd scripts/audit-cogs-drift.ts        # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-current-stock.ts     # 0 negative
rtk node_modules/.bin/vite-node.cmd scripts/audit-order-ledger.ts      # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-purchase-ledger.ts   # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-void-orders.ts       # clean
rtk node_modules/.bin/vite-node.cmd scripts/audit-stock-ledger-schema.ts
rtk node_modules/.bin/vite-node.cmd scripts/audit-order-total-consistency.ts
rtk node_modules/.bin/vite-node.cmd scripts/audit-po-save-ledger.ts
rtk node_modules/.bin/tsc --noEmit                                     # 1 pre-existing error
```

### Bug Đào miếng — Root cause

3 hàm truyền full ledger vào `FIFOTracker.init()`. Init consume `SALES_CONSUME` → batches depleted → late-processed lines thấy 0 stock → modifier COGS = 0. Fix: filter `SALES_CONSUME` + `EDIT_REVERSAL` trước init (mirror `auditCogsDrift`). Evidence: `scripts/verify-cogs-allocation-impact.ts` shows MOD-006 0→4209, MOD-004 121891→76776, total unchanged.

---

## Phần B — System-wide audit findings

### B.1 — UI/UX Issues

#### Date/Time display
- [x] **UI-1** HIGH Tạo `lib/datetime.ts` helper `formatDateTime(iso, opts?)` dùng `Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })`. Thay 2 helper trùng `OrderTable.tsx:134` + `OrderDetailModal.tsx:28`. **Done by Claude** — `lib/datetime.ts` + 9 tests, apply ở `OrderTable.tsx`, `OrderDetailModal.tsx`, `StockTable.tsx`.
- [x] **UI-2** HIGH `StockTable.tsx:80` và các trang `.toLocaleString("vi-VN")` thiếu `timeZone` option. **Done by Claude** — dùng `formatDateTime` helper mới.
- [x] **UI-3** HIGH `SalesFilter.tsx:84` push URL `.toISOString()` raw → không friendly. **Done by Claude (phiên 2026-06-26)** — `toDateOnlyForUrl` YYYY-MM-DD + `parseDateParam` backward compat với ISO legacy. Server `toSaigonUtcRange` handle date-only.

#### Sizing & touch target
- [x] **UI-4** HIGH Touch target < 44px: `OrderDetailModal.tsx:64` close button, `SalesFilter.tsx:111-113` preset buttons. **Done by Claude** — tăng `min-h-[36px]` + `aria-label="Đóng"`. Codex verify `OrderTable.tsx:280` "Hủy đơn" button.
- [x] **UI-5** HIGH `sales/page.tsx:256` heatmap cell `text-[8px]`. **Done by Claude** — `text-[10px]`.
- [x] **UI-6** MED `pnl/page.tsx:128,184,243` `max-h-[484px]`. **Done by Claude** — `max-h-[60vh]` (3 chỗ + StockTable 1 chỗ).

#### Layout & consistency
- [x] **UI-7** HIGH `ModifiersClient.tsx:131` text English `"active recipes"`. **Done by Claude** — `"phiên bản hoạt động"`.
- [ ] **UI-8** MED `PurchaseOrderForm.tsx:213` placeholder. *(Defer — cần đọc CustomDatePicker)*
- [x] **UI-9** HIGH `PurchaseOrderForm.tsx:165` gửi `transaction_date.toISOString()`. **Done by Claude (phiên 2026-06-26)** — đổi sang `toSaigonIsoString(transactionDate)` từ `lib/datetime.ts`. Server parse đúng ngày Saigon bất kể deploy TZ.
- [x] **UI-10** MED Format tiền `XXđ` → `XX đ`. **Done by Claude** — sweep trong `OrderDetailModal.tsx` (6 chỗ).
- [x] **UI-11** MED `OrderTable.tsx:137` show giây. **Done by Claude** — dùng `formatDateTime(dateString)` mặc định không giây.
- [x] **UI-12** MED Heatmap mobile. **Done by Antigravity** — added list view for mobile and min-width 1120px for desktop touch targets (commit 204d2a4).
- [x] **UI-13** MED Mobile table card fallback. **Done by Antigravity** — added card layout for mobile (<768px) in sales and PnL tables (commit 6f0a3c3).
- [ ] **UI-14** MED PO form grid fallback. *(Defer — cần đọc PO form)*
- [ ] **UI-15** MED PO inputs `w-32` overflow. *(Defer — cần đọc PO form)*
- [x] **UI-16** MED `StockTable.tsx:103` icon `🔍`. **Done by Claude** — `aria-hidden="true"`.
- [x] **UI-17** MED `ItemsClient.tsx:106` item.id raw UUID. **Done by Antigravity** — added short ID display and hover copy button (commit f8e14e5).

#### Low severity
- [x] **UI-18** LOW `OrderTable.tsx:359` className conflict. **Done by Claude** — removed `bg-white` duplicate.
- [x] **UI-19** LOW backdrop opacity khác nhau. **Done by Claude** — unified `bg-black/50 backdrop-blur-sm` ở OrderDetailModal.
- [x] **UI-20** LOW `created_by` hardcoded. **Done by Claude (phiên 2026-06-26)** — server override bằng `auth.actor.name` (CODE-22), client append removed khỏi PurchaseOrderForm.
- [x] **UI-21** LOW PnL emoji icons. **Done by Claude** — `aria-hidden="true"` 3 chỗ.

### B.2 — Code Architecture

#### Type Safety
- [x] **CODE-1** HIGH `app/admin/orders/actions.ts:111-162, 208-228` `any[]` + `Number(x) || 0` lặp. **Done by Claude (phiên 2026-06-26)** — extracted `coerceOrderV2`/`coerceLineV2` to `lib/order-types.ts`. Áp dụng ở `app/admin/reports/actions.ts` (2 chỗ).
- [x] **CODE-2** MED `app/admin/orders/actions.ts:349` `require()` runtime. **Done by Claude (phiên 2026-06-26)** — đổi sang static `insertMany` import (cùng commit CODE-8).
- [ ] **CODE-3** MED `lib/report-v2-allocators.ts:43-48, 145, 262` `any[]`. Typed `LedgerEntry[]` + `SemiProductContext`.
- [ ] **CODE-4** LOW `app/admin/inventory/actions.ts:411` `submitStockAdjustment(data: any)`. Typed input.

#### Error Handling
- [x] **CODE-5** HIGH `lib/report-v2-allocators.ts:190, 214` `try { JSON.parse } catch {}` silent skip SP. **Done by Claude** — added `parseSpIngredients` helper throws on malformed JSON; replaced both `try/catch {}` blocks; throws with SP id in message.
- [ ] **CODE-6** MED `app/admin/inventory/purchase-orders/actions.ts:51` `JSON.parse(linesJson)` không try/catch.
- [ ] **CODE-7** LOW `app/admin/orders/actions.ts:117-121` silent catch. Log warning nếu non-empty.

#### Data Integrity
- [x] **CODE-8** CRITICAL `app/admin/orders/actions.ts:337-351` `voidOrderV2` 3 writes không transaction. **Done by Claude (phiên 2026-06-26)** — reorder fail-safe (reversal+event first, order update last) + idempotency guard reject double-VOIDED. Bonus CODE-2: replace `require()` runtime bằng static `insertMany` import.
- [x] **CODE-9** CRITICAL `app/admin/inventory/purchase-orders/actions.ts:81-93` update PO loop remove; fail giữa → mất dữ liệu. **Done by Claude (phiên 2026-06-26)** — replace loop remove với `removeMany` batch (atomic), accumulate line/ledger rows + `insertMany` batch. Giảm fail-between window đáng kể.
- [ ] **CODE-10** HIGH `app/admin/orders/actions.ts:472` `editOrderV2` race condition.
- [x] **CODE-11** HIGH `app/pos/actions.ts:138-155` `assignOrderNo` race → trùng order_no. **Done by Claude (phiên 2026-06-26)** — thêm `ensureUniqueOrderNo` post-insert verify + auto-regenerate khi collision.
- [ ] **CODE-12** MED `findAll` (cache 5min) cho reference data trong write-path.

#### Performance
- [x] **CODE-13** HIGH `app/admin/orders/actions.ts:113-115, 209-210` `.find()` O(n) per line → O(n²). **Done by Claude (phiên 2026-06-26)** — build `productById`/`variantById` Maps 1 lần trước map.
- [x] **CODE-14** HIGH `app/admin/inventory/items/actions.ts:182-227` `updatePurchasedItem` N+1. **Done by Codex (2026-06-26)** — added `updateMany` to `lib/sheets_db.ts`, covered it with `lib/sheets_db.test.ts`, and replaced the PO-line history update loop with one batch update.
- [ ] **CODE-15** HIGH `app/admin/inventory/purchase-orders/actions.ts:116-164` loop insert. Accumulate + `insertMany`.
- [x] **CODE-16** MED `app/admin/reports/actions.ts:321-322` tạo Set mỗi iteration. **Done by Claude (phiên 2026-06-26)** — build Set 1 lần trước filter.
- [ ] **CODE-17** MED `lib/cogs-drift-audit.ts:146-163` re-consume prior lines O(n²).

#### Code Duplication
- [x] **CODE-18** HIGH `buildLineConsumptionRows` + `costConsumptionRowsFIFO` trùng 3 chỗ (`pos/actions`, `admin/orders/actions`, `cogs-drift-audit`). **Done by Claude (phiên 2026-06-26)** — extracted to `lib/inventory-consumption.ts`.
- [x] **CODE-19** MED `coerceOrder`/`coerceLine` trùng. **Done by Claude (phiên 2026-06-26)** — same as CODE-1.
- [ ] **CODE-20** MED Block filter "COMPLETED + superseded_by empty" lặp 4 lần. Helper `filterEligibleOrders`.
- [ ] **CODE-21** MED SEMI_PRODUCT resolution trùng. Helper `resolveSemiProduct`.

#### Security
- [x] **CODE-22** CRITICAL Không server action nào check `session.user.role === "ADMIN"`. **Done by Claude (phiên 2026-06-26)** — `requireAdmin`/`resolveActor` ở `lib/auth.ts`. Apply: `voidOrderV2`, `editOrderV2`, `savePurchaseOrder`, `approveStockAdjustment`, `submitStockAdjustment` (refactor: bỏ trust client `role` param, dùng server-side).
- [ ] **CODE-23** LOW `lib/sheets_db.ts:132-149` `generateNewId` predictable. OK cho ledger.
- [ ] **CODE-24** MED `lib/sheets_db.ts:69-87` sheet name dynamic. Whitelist `ALLOWED_SHEETS`.

---

## Priority (updated 2026-06-26 sau MAC migration)

**Done items removed from priority** (Claude phiên 2026-06-25 + 2026-06-26):
- UI-1/2/4/5/6/7/10/11/16/18/19/21 — done
- CODE-5, R5, R9, R10 — done

| Priority | Items | Ghi chú |
|---|---|---|
| **P0 — Critical (security/data)** | CODE-22 (auth guard), CODE-8 (void txn), CODE-9 (PO txn), CODE-11 (order_no race) | Rủi ro mất dữ liệu / bảo mật. Codex ưu tiên. |
| **P1 — High (sau MAC migration)** | R11 (BTP perf), R12 (dedup 4 chỗ tăng sau MAC), R13 (FIFO drift warning), CODE-13/14/15 (perf N+1), UI-3 (URL date), UI-9 (PO date ISO) | Tăng ưu tiên vì MAC migration thêm code mới. |
| **P2 — Medium (cosmetic + refactor)** | UI-8/12/13/14/15/17/20, CODE-1/10/12/16/17/19-21/24, R1/2/3/4/6/7/8 | UI + cleanup. |
| **P3 — Low / defer (large or low-impact)** | CODE-2/3/4/7/23, Phase 6.3-6.5/7/8 | Large refactor hoặc cần design. |

---

## Next 3 phiên đề xuất

### Codex phiên tiếp theo

1. **Verify** Claude fixes (R9, R10, R5) — chạy `tsc --noEmit` clean.
2. **P0**: CODE-22 auth guard (lớn nhất, rủi ro cao nhất).
3. **P1**: R12 dedup `buildLineConsumptionRows` (4 chỗ giờ là 5 sau MAC).
4. **P1**: R13 add warning trong FIFO drift audit output.

### Claude phiên tiếp theo (nếu anh cần)

1. **P1**: UI-9 (PO transaction_date UTC → Saigon) — em đã tạo `toSaigonIsoString` helper sẵn trong `lib/datetime.ts`.
2. **P1**: UI-3 (SalesFilter URL date) — dùng `formatDate(iso)` từ helper.
3. **P2**: UI-8/14/15 (PO form polish).

### Sau khi cả 2 xong P0-P1

1. Phase 6.2 (script deletion — review từng script).
2. Phase 7 (mobile UI audit — cần dev server).
3. Phase 8 (offline/sync — cần design approval).

---

## Output mong đợi từ Codex

1. **Phần A**: Confirm/reject R1-R13. Flag thêm edge cases.
2. **Phần B**: Làm item `[ ]` còn lại theo priority. Mỗi fix commit riêng với `Codex:` prefix.
3. Update file này: chuyển `[ ]` → `[x]` khi xong, note commit sha.
4. Update `DEVELOPMENT-TRACKING.md` entry mới (newest first).
5. **Không push** unless explicitly asked.
6. Cuối phiên: đọc `docs/COLLABORATION.md` section 4 "Quy trình làm việc mỗi phiên".

## Quy tắc (CLAUDE.md + COLLABORATION.md)

- Code/comments: English only
- User-facing strings: tiếng Việt
- CamelCase, no emojis mới (cũ OK với `aria-hidden`)
- Surgical changes, simplicity first
- Transactions cho critical flows (P0)
- Lodash khi có thể
- Tuân thủ `docs/domain-dictionary.md`
- **Communication**: tuân thủ `docs/COLLABORATION.md`
