# System Optimization Roadmap

Danh sách task tối ưu hệ thống FNB App, sắp xếp theo priority. Mỗi task có: motivation, scope gợi ý, dependencies, owner đề xuất.

Cập nhật lần cuối: 2026-06-27.

Marker theo `docs/COLLABORATION.md` section B: `[ ]` pending, `[~C/X/A]` in-progress by agent, `[x]` done, `[!]` blocked, `[-]` wontfix.

---

## P0 — Critical (data integrity / scalability)

### 1. `[ ]` Supabase full migration (primary DB)

**Motivation**: Google Sheets API rate limit (300/min/user) gây partial failures khi import hàng loạt. Không có transaction thật → orphan rows khi cleanup-on-fail cũng fail. Reads chậm (mỗi page load full-scan sheet). Order_no race condition (CODE-11 hack).

**Scope**:
- Setup Postgres schema cho ~22 sheets (transactions + catalog + inventory + purchasing + production + users)
- Migration script 1-shot: Sheets → Supabase (dry-run + `--apply`)
- New `lib/db.ts` Supabase client (replace `lib/sheets_db.ts`)
- Compatibility shim: `findAll/insert/update/remove` với same signature → minimize caller changes
- Update all callers (~100+ files): `app/**/actions.ts`, `scripts/*`, `lib/sheets-db-v2.ts`
- Rewrite `supabase/functions/backup-to-sheets/index.ts` cho V2 schema, deploy cron daily
- Verification: parity check (count + sum) Sheets vs Supabase post-migration

**Status hiện tại**: Supabase project đã tạo (URL + secret key trong `.env.local`). Ping test PASS. Schema chưa tạo.

**Dependencies**: none.

**Owner**: Claude (spec + migration script), Codex review (data flow changes), Antigravity (UI verify không break).

**Spec reference**: chưa viết — cần brainstorm `docs/superpowers/specs/2026-06-27-supabase-migration-design.md`.

**Time estimate**: 2-3 tuần.

---

### 2. `[ ]` P&L breakdown recompute FIFO thay vì stored MAC (P0 deferred)

**Motivation**: P&L report breakdown (theo ingredient + theo sale source) đang recompute FIFO, không dùng stored MAC. Tổng COGS = MAC stored (đúng), nhưng breakdown có thể lệch. Vi phạm spec `2026-06-25-mac-cogs-inventory-design.md`.

**Files**:
- `app/admin/reports/actions.ts:449-501` `splitLineCogsBySaleSource` — recompute FIFO.
- `lib/report-v2-allocators.ts` `breakdownCOGSByIngredient` — recompute FIFO.

**Tasks cho Codex**:
1. Confirm có lý do giữ FIFO breakdown không, hay là bug cần fix.
2. Nếu fix: refactor dùng stored MAC hoặc MAC recompute via consumption rows (không FIFO).
3. Viết audit `scripts/audit-pnl-mac-consistency.ts` verify P&L total = sum cost_at_sale.
4. Update R1 status trong handoff.

**Status**: deferred to Codex (per `docs/audits/codex-handoff-2026-06-25.md` 2026-06-26 (Claude) entry).

**Dependencies**: none (có thể chạy song song Supabase migration).

**Owner**: Codex.

---

## P1 — Important (UX / type correctness)

### 3. `[ ]` AuthActor type: thêm MANAGER role

**Motivation**: `lib/auth.ts:9` `AuthActor.role` type = `"ADMIN" | "STAFF" | "SYSTEM"` nhưng UI `app/admin/users/components/UsersClient.tsx:88` render badge cho role `"MANAGER"`. Nếu user MANAGER tồn tại trong Users sheet, type TS không acknowledge → potential type-safety gap.

**Files**:
- `lib/auth.ts` — extend type union.
- Verify `requireAdmin()` behavior với MANAGER: hiện tại reject (đúng rule "ADMIN+ trở lên"), giữ nguyên.

**Scope**: minor type fix. Không break runtime.

**Owner**: Codex (engine file `lib/auth.ts`).

---

### 4. `[ ]` POS UI: ẩn "Hủy đơn" button cho non-admin

**Motivation**: `OrderTable.tsx:280, 347` và `OrderDetailModal.tsx:200` render nút "Hủy đơn" cho mọi user. Non-admin (STAFF/MANAGER) click → server-side `requireAdmin()` reject → error popup "Chỉ ADMIN mới có quyền...". UX kém.

**Scope**:
- Lấy current user role từ session (NextAuth).
- Condition render: chỉ show "Hủy đơn" nếu `role === "ADMIN"`.
- Apply cho cả OrderTable (list) và OrderDetailModal (detail).

**Files**: `app/admin/orders/OrderTable.tsx`, `app/admin/orders/OrderDetailModal.tsx`.

**Owner**: Antigravity (UI), Codex review (data flow nếu có).

---

### 5. `[~A]` Topping standalone admin toggle UI

**Motivation**: Owner cần toggle on/off standalone topping visibility trong POS. Data layer đã xong (CAT-007 + 7 products/variants/recipes + migration_notes link). POS filter fix đã xong. Chỉ thiếu admin UI.

**Spec**: `docs/superpowers/specs/2026-06-27-topping-standalone-design.md` §Admin UI.

**Files** (new):
- `app/admin/products/toppings/page.tsx` — server component.
- `components/ToppingsManager.tsx` — client component, table với ON/OFF switches.
- `app/admin/products/toppings/actions.ts` — `toggleToppingStandalone(productId, enabled)`.

**Owner**: Antigravity.

**Status**: pending handoff (see `docs/audits/codex-handoff-2026-06-25.md` Pending tasks table).

---

## P2 — Cleanup (data hygiene)

### 6. `[ ]` Products.brand_id missing cho PROD-027, PROD-028, PROD-029..035

**Motivation**: 8 products không có field `brand_id` (field absent hoàn toàn trong sheet row, không phải empty). PROD-027 (Khoai lang) + PROD-028 (Trứng luộc) tạo 2026-06-26. PROD-029..035 (7 standalone toppings) tạo 2026-06-27. Reports-by-brand có thể missclassify.

**Scope**: add `brand_id = "BR-001"` cho 9 products trong Products sheet (PROD-027, 028, 029, 030, 031, 032, 033, 034, 035).

**Manual fix**: edit Google Sheet trực tiếp, hoặc viết script `scripts/fix-product-brand-id.ts`.

**Owner**: Claude (script) hoặc user (manual edit sheet).

---

### 7. `[ ]` VAR-036 (Khoai lang) recipe setup

**Motivation**: VAR-036 không có recipe → COGS = 0 cho 78 units bán trong June 2026 backfill. P&L understated.

**Scope**:
- Define recipe cho Khoai lang (ingredient + quantity). Vd: 1 phần = 1 củ khoai lang (ING-XXX).
- Add row to Recipes sheet: `target_type=PRODUCT_VARIANT, target_id=VAR-036`.
- Run `scripts/apply-cogs-recalc.ts --start=2026-06-01 --end=2026-06-26` để backfill `cost_at_sale` cho 49 lines đã bán.

**Owner**: User (define recipe) + Claude (script).

---

### 8. `[ ]` Recipe + price sync (modifier ↔ standalone variant)

**Motivation**: Khi user update Modifier recipe/price, standalone Variant recipe/price không tự sync. COGS có thể lệch giữa add-on sale và standalone sale. Known limitation từ topping standalone spec.

**Scope**:
- Add "Sync from modifier" button trong admin Toppings page (sau khi task #5 ship).
- Hoặc script `scripts/sync-topping-recipe-from-modifier.ts` (dry-run/--apply).
- Hoặc post-save hook trong Modifier save action.

**Owner**: Claude (script) hoặc Antigravity (UI button).

---

## P3 — Minor / future enhancements

### 9. `[ ]` Order_no race condition (CODE-11 follow-up)

**Motivation**: `app/pos/actions.ts:175-202` `ensureUniqueOrderNo` có retry loop nhưng best-effort. Sheets API không có unique constraint. Đã hack partial fix nhưng có thể fail trong high-concurrency scenarios.

**Scope**: Supabase migration sẽ solve via DB unique index trên `order_no`. Trước migration, accept risk.

**Dependencies**: task #1 (Supabase migration).

**Owner**: auto-resolved by task #1.

---

### 10. `[ ]` Hourly heatmap mobile responsive (user WIP)

**Motivation**: User đang WIP mobile heatmap layout trong `app/admin/reports/sales/page.tsx` (file dirty). Biến desktop grid → mobile list view.

**Owner**: User (WIP, không phải task cho agents).

---

## Pending hand-off reviews (Codex)

### 11. `[ ]` Post-hoc review: `scripts/import-june-2026-sales.ts`

Applied 2026-06-27. Order creation + MAC COGS + ledger writes. User verbally approved without Codex review.

### 12. `[ ]` Post-hoc review: `scripts/setup-topping-standalone.ts`

Applied 2026-06-27. Catalog mutation (CAT-007 + 7 products/variants/recipes).

### 13. `[ ]` Review: POS filter fix `app/pos/page.tsx:42-45`

Applied 2026-06-27 by Claude. `status !== "DELETED"` → `status === "ACTIVE"`. Data flow impact.

### 14. `[ ]` Review: report classification `app/admin/reports/actions.ts`

Applied 2026-06-27 by Claude. Standalone topping routing trong `getSalesDataV2` + `getPnLDataV2`.

### 15. `[ ]` Review: toggle server action (after Antigravity ships task #5)

Mutates Products sheet.

---

## Đề xuất thứ tự thực hiện

1. **#1 Supabase migration** (P0, biggest impact) — 2-3 tuần
2. **#2 P&L MAC breakdown** (P0, parallel với #1) — Codex
3. **#5 Topping admin UI** (P1, ready for Antigravity)
4. **#11-15 Codex reviews** (pending, không block)
5. **#3 MANAGER role type** (P1, quick fix)
6. **#4 POS hide button** (P1, UX quick win)
7. **#6 brand_id cleanup** (P2, data hygiene)
8. **#7 VAR-036 recipe** (P2, COGS accuracy)
9. **#8 recipe/price sync** (P2, sau #5)
10. **#9 order_no race** (auto-resolved by #1)

Item #10 (heatmap mobile) là user WIP, không phải task cho agents.

---

## Cập nhật

Khi hoàn thành task, update marker `[ ]` → `[x]` + thêm note với commit hash. Add task mới vào end của section phù hợp.
