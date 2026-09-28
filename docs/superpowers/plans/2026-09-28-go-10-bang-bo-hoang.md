# Gỡ 10 bảng bỏ hoang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the 10 abandoned tables, every function and code path that reads or writes them, and the "Điều chỉnh Tồn kho" menu entry, without changing any figure.

**Architecture:** Code stops touching the tables first (one push), then one migration (`0105`) rewrites `save_product_atomic` without recipes, drops the dead functions, the `purchased_items.semi_product_id` link, and the 10 tables. The nightly Drive backup (edge function + Apps Script list) is shrunk to 34 tables in step with it.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres (PL/pgSQL), Vitest, Deno edge function, Google Apps Script.

**Who codes (owner, 2026-09-28):** UI goes to Gemini through the `agy` CLI:
deleting `app/admin/inventory/stock-adjustments/` and the menu entry in
`app/admin/layout.tsx`, part of Task 2. Everything else goes to Sonnet. Opus
reviews.

**Spec:** `docs/superpowers/specs/2026-09-28-ban-do-bang-du-lieu.md` (group C). Owner decision 2026-09-28: "Ok gỡ" — option a, all 10 plus the menu entry.

## Hiện trạng

1. **Trạng thái.** Không áp dụng cho trạng thái mới, vì việc này chỉ gỡ. Các trạng thái đang có bị gỡ theo bảng: phiếu cân bằng kho (PENDING/APPROVED, 0 dòng), ca làm việc (OPEN/CLOSED, 1 dòng chạy thử), công thức (ACTIVE, có ngày bắt đầu/kết thúc, 1 dòng rỗng).
2. **Nút.** Mục menu "Điều chỉnh Tồn kho" (`app/admin/layout.tsx:36`) mở trang chỉ có nút "Duyệt" cho phiếu chờ duyệt, nhưng không có cách nào tạo phiếu. Cả trang bị gỡ. Màn Món không có nút nào về công thức (đã gỡ ở đợt 27/08). Riêng việc lưu món thì mỗi cỡ mới vẫn âm thầm tạo một công thức rỗng.
3. **Danh sách.** Trang cân bằng kho liệt kê `stock_adjustments` (luôn trống). Màn kiểm kê gộp tên bán thành phẩm vào bảng tra tên (luôn trống). Báo cáo tải công thức rồi bỏ không dùng.
4. **Ô nhập.** Không áp dụng, vì không thêm hay đổi ô nhập nào. Form món giữ nguyên ô ngày áp dụng giá (`effective_date`). Ô này vẫn dùng cho lịch sử giá.
5. **Phục vụ dữ liệu nào.** Chỉ bỏ dữ liệu không góp vào số nào. Cố ý không đụng:
   - `order_lines_v2.recipe_snapshot_json`: cột của đơn, không phải bảng công thức.
   - Kiểu dòng kiểm kê `SEMI_PRODUCT` / `BASE_INGREDIENT` trong `stocktake_lines` (0 dòng dùng, nhưng là ràng buộc của bảng đang sống; gỡ là việc khác).
   - `pos_drafts`, `pos_sync_failures`.

**Câu hỏi riêng cho việc này:**

6. **Ai còn đọc kết quả của thứ bị gỡ?** Bản sao lưu Drive (hàm `backup-to-drive` và danh sách `EXPECTED_TABLES` trong Apps Script), khôi phục sao lưu (`lib/db/backup-restore.ts` dùng `BACKUP_TABLES`), việc lưu món (`recipe_count` trong kết quả hàm).
7. **Thứ tự lên máy chủ nào không làm gãy gì?** Xem mục Release.
8. **Máy bán hàng có bị ảnh hưởng không?** Không. `app/pos/` không đọc bảng nào trong 10 bảng (đã dò 2026-09-28).

## Đo 2026-09-28 (máy chủ thật, chỉ đọc)

| Bảng | Dòng | Nội dung |
|---|---|---|
| `recipes` | 1 | `REC-001`, công thức rỗng của cỡ `500ml` món **Test11** (`VAR-060`, 12.000đ), tạo 31/08 khi lưu món |
| `semi_products` | 0 | |
| `production_orders` / `production_items` | 0 / 0 | |
| `stock_adjustments` | 0 | |
| `shifts` / `shift_stock_checks` | 1 / 2 | `SHF-001` "smoke test - safe to delete", 23/07; `CHK-0001/0002` đếm Siro BTP-013 của ca đó |
| `data_migration_runs` | 1 | `HONG_TO_LUC_2026-06-29_V1`, có ảnh chụp trước khi đổi |
| `data_recovery_changes` | 0 | |
| `sync_state` | 1 | `orders_v2`, mốc cuối 13/07/2026 |

`purchased_items.semi_product_id` khác rỗng: 0 trên 151 dòng. `stocktake_lines` khác `PURCHASED_ITEM`: 0 trên 50 dòng.

**Ví dụ tính sẵn.** Sau khi gỡ, anh sửa giá cỡ `500ml` món Test11 từ 12.000đ lên 13.000đ:
- Hiện giờ: hàm lưu món khoá dòng `REC-001` và trả `recipe_count = 0`.
- Sau khi gỡ: hàm không đụng công thức. Hàm vẫn ghi 1 dòng lịch sử giá, `PPH-` kế tiếp, giá cũ 12.000đ, giá mới 13.000đ.

Thêm một cỡ mới `700ml` giá 15.000đ:
- Hiện giờ: hàm tạo thêm công thức rỗng `REC-002`.
- Sau khi gỡ: hàm chỉ tạo cỡ món `VAR-` kế tiếp và 1 dòng lịch sử giá.

Giá vốn trước và sau phải bằng nhau: 49.943.622đ (`verify-cogs`, 2026-09-28).

## Hàm trong cơ sở dữ liệu còn sống có đụng 10 bảng

Suy từ chữ migration (lấy bản `create or replace` cuối của mỗi hàm, bỏ hàm đã `drop`). Không phiên nào ở máy này đọc thẳng được danh sách hàm trên máy chủ.

| Hàm | Bản cuối | Xử lý |
|---|---|---|
| `save_product_atomic` | `0050` | Viết lại, bỏ phần công thức |
| `submit_stock_adjustment_atomic` | `0083` | Drop |
| `approve_stock_adjustment_atomic` | `0084` | Drop |
| `apply_full_history_recovery` | `0046` | Drop (không code nào gọi) |
| `remove_audit_baseline_lock` | `0032` | Drop (bảng khoá đã xoá ở `0054`; không code nào gọi) |
| `prune_data_recovery_changes` | `0045` | Drop (hàm của trigger trên `data_recovery_changes`) |

Trigger: chỉ có trigger nằm trên chính các bảng bị xoá (`trg_shifts_touch`, trigger dọn của `data_recovery_changes`, trigger `touch` của các bảng có `updated_at`). Chúng mất theo bảng. Không bảng sống nào có trigger ghi vào 10 bảng.

Khoá ngoại trỏ vào 10 bảng:
- `purchased_items.semi_product_id → semi_products`: bảng sống, phải gỡ cột trước.
- `production_orders.semi_product_id`, `production_items.production_order_id`, `shift_stock_checks.shift_id`: đều nằm giữa các bảng cùng bị xoá.

Đã xem: toàn bộ `supabase/migrations/`, `app/`, `lib/`, `components/`, `types/`, `supabase/functions/`, `scripts/apps-script/`, `tests/edge-functions/drive-backup.test.ts`. Chưa xem: `scripts/restore-backup-to-target.ts` và `scripts/verify-drive-backup.ts`. Cả hai đọc `BACKUP_TABLES` nên tự theo, nhưng chưa mở ra kiểm.

## Global Constraints

- Code and comments in English; visible text in Vietnamese.
- Never edit an applied migration; new file `0105_*`.
- Every new test must be seen red on the unfixed tree; say whether red by wrong value or missing thing.
- `scripts/apps-script/backup-to-drive.gs` `EXPECTED_TABLES` must equal `BACKUP_TABLES` in order (existing test).
- Five commands green before reporting: `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, `npm run build`; plus `npx vite-node scripts/verify-cogs.ts`.

## Review Focus

1. Saving an existing product (name/price edit) after the change — must still write price history and not error.
2. Adding a new size to an existing product — no recipe row, no count mismatch.
3. Deleting a unit — the unit-in-use check must still cover purchase lines and purchased items after losing the semi-product/production branches.
4. Restoring an old 44-table backup file into the new 34-table schema — extra table keys must be ignored, not crash (`lib/db/backup-restore.ts` iterates `BACKUP_TABLES`, so it reads only the 34).
5. The night between the edge function deploy and the Apps Script paste — a missing table is fatal in Apps Script, so the paste goes first (Release step 1).

---

### Task 1: Product save stops touching recipes

**Files:**
- Modify: `app/admin/products/actions.ts` (drop `RECIPE_SHEET`, `planRecipeSave`/`findLatestActiveRecipe`, `expectedRecipeCount`, `recipe_decision`/`active_recipe_id`/`ingredients_json` on each variant)
- Modify: `lib/products/product-save-transaction.ts` (drop `expectedRecipeCount` input, `recipeCount` output, `recipe_count` check)
- Delete: `lib/products/recipe-selection.ts`, `lib/products/recipe-selection.test.ts` — the only callers are in `app/admin/products/actions.ts`, removed here.
- Modify tests: `lib/products/product-save-transaction.test.ts`, `app/admin/products/actions.failure.test.ts` and any other products action test that asserts `recipe_decision`.
- Create: `supabase/migrations/0105_drop_abandoned_tables.sql` (section 1 of it: `save_product_atomic`)
- Create: `tests/migrations/drop-abandoned-tables-migration.test.ts`

- [ ] **Step 1: failing tests.**
  - In `product-save-transaction.test.ts`, assert that the rpc payload's variants carry no `recipe_decision` key.
  - Assert that a result without `recipe_count` is accepted.
  - In the new migration test, assert that the `save_product_atomic` body in `0105` contains no `recipes`, keeps the signature `(boolean, jsonb, jsonb, jsonb, timestamptz)`, and returns no `recipe_count`.
- [ ] **Step 2: run, see red.**
  - The migration test is red because the file is missing.
  - The transaction test is red because the value is wrong: `recipe_decision` is still sent.
- [ ] **Step 3: write `0105` section 1.**
  - Copy `0050`'s function.
  - Remove: `v_recipe_decision`, `v_active_recipe_id`, `v_next_recipe`, `v_recipe_count`, the `recipes:id` advisory lock, the REC id scan, the recipe-decision validation, the `ingredients_json` check, the whole UNCHANGED/CREATE_VERSION/CREATE_INITIAL block, and the recipe insert.
  - Return `product_id`, `variant_count`, `price_history_count`, `removed_variant_count`.
  - Keep the four revoke/grant lines.
  - Header comment: owner decision 2026-08-27 plus 2026-09-28; the return shape changes, so it must ship with the code (Release order).
- [ ] **Step 4: update the TS code.** In `saveProduct`, `variantPlans` becomes `{ id, size_name, price }`.
- [ ] **Step 5: run the affected tests, then `npx tsc --noEmit`.** Expect green.
- [ ] **Step 6: commit.** `feat(products): saving a product no longer writes a recipe`

### Task 2: Remove the stock adjustment screen

**Files:**
- Delete: `app/admin/inventory/stock-adjustments/` (page + `components/StockAdjustmentsClient.tsx`)
- Delete: `lib/stock/stock-adjustment-transaction.ts` and its `.test.ts`
- Modify: `app/admin/inventory/actions.ts`. Remove the submit/approve adjustment actions (around lines 490–540), their imports, and their `revalidatePath` calls.
- Modify: `app/admin/layout.tsx:36`. Remove `{ name: "Điều chỉnh Tồn kho", href: "/admin/inventory/stock-adjustments" }`.
- Modify tests that exercise those actions: `app/admin/inventory/actions.auth.test.ts`, `actions.cache.test.ts`, `actions.failure.test.ts`. Delete only the cases for the removed actions, and name them in the commit body.
- Extend: `tests/migrations/drop-abandoned-tables-migration.test.ts`

- [ ] **Step 1: failing tests.**
  - Migration test: `0105` contains `drop function if exists public.submit_stock_adjustment_atomic(` and `approve_stock_adjustment_atomic(`, with the argument lists copied from `0083`/`0084`.
  - A layout test (or the existing menu/route-coverage test): no menu entry points at `/admin/inventory/stock-adjustments`.
- [ ] **Step 2: run, see red.** Both are missing.
- [ ] **Step 3: delete the files, edit layout and actions, add the two drops to `0105`.**
- [ ] **Step 4: `npx tsc --noEmit`, `npx vitest run app/admin/inventory tests/migrations`.** Expect green.
- [ ] **Step 5: commit.** `feat(inventory): remove the stock adjustment screen, never able to create one`

### Task 3: Remove the remaining readers

**Files:**
- `app/admin/inventory/actions.ts` (~400–425): drop the `Semi_Products` and `Production_Items` unit-in-use checks.
- `lib/catalog/unit-delete-restriction.ts` + test: drop the `semi_products` and `production_items` kinds.
- `app/admin/inventory/stocktake/actions.ts:59–90`: drop the `Semi_Products` read and the `semiProducts` field.
- `app/admin/reports/actions.ts:107–113`: drop the unused `findAll("Recipes")` and its destructured `recipes`.
- `app/admin/clear-cache/page.tsx:5`: drop `revalidateTag("sheets-Recipes")`, and any `Semi_Products` tag if present.
- `lib/db/tables.ts`:
  - drop `'Recipes'` and `'Semi_Products'` from `CATALOG_SHEETS`
  - drop the `recipes` entry from `JSON_COLUMNS_BY_TABLE` (keep `pos_drafts`)
  - drop the `base_ingredients` boolean entry (the table was dropped 2026-09-01)
- `types/db.ts`: drop `semi_product_id` and any row types for the 10 tables.

- [ ] **Step 1: failing test.** In `actions.delete-unit.test.ts`, deleting a unit must no longer query `Semi_Products` or `Production_Items`. Assert that `findAllWhere` is not called with either name. Red on the current tree because the value is wrong.
- [ ] **Step 2: make the edits.**
- [ ] **Step 3: `npx tsc --noEmit`, `npx vitest run`.** Expect green.
- [ ] **Step 4: commit.** `refactor: stop reading recipes, semi-products and production items`

### Task 4: Drop the tables and shrink the backup

**Files:**
- `supabase/migrations/0105_drop_abandoned_tables.sql` (section 3)
- `supabase/functions/backup-to-drive/core.ts`: remove the 10 names from `BACKUP_TABLES` and from `BACKUP_TABLE_ORDER_COLUMNS`.
- `scripts/apps-script/backup-to-drive.gs`: `EXPECTED_TABLES` becomes the same 34, in the same order.
- `tests/edge-functions/drive-backup.test.ts`:
  - Change 44 to 34.
  - Replace the `sync_state`/`data_migration_runs`/`data_recovery_changes` assertions with `not.toContain` for all 10.
  - Drop `shifts` and `shift_stock_checks` from the coverage list.
- Delete: `supabase/functions/backup-to-sheets/` (its only state is `sync_state`; it last ran 13/07).

- [ ] **Step 1: failing test.** Add the 10 `drop table` lines to `0105` before touching `core.ts`. Then "never lists a table that has since been dropped" goes red with the 10 names (wrong value). Also update the count assertions, which go red on the value.
- [ ] **Step 2: write `0105` section 3, in this order.**
  - A guard `do $$` that refuses unless the counts are still: recipes ≤ 1 and every row has an empty `ingredients_json`; semi_products = 0; production_orders = 0; production_items = 0; stock_adjustments = 0; shifts ≤ 1; data_recovery_changes = 0; `purchased_items.semi_product_id` not null = 0.
  - `alter table public.purchased_items drop column if exists semi_product_id;`
  - Drop the four dead functions: `apply_full_history_recovery`, `remove_audit_baseline_lock`, `prune_data_recovery_changes`, plus the two from Task 2, with the argument lists copied from their last definitions.
  - `drop table if exists` in child-first order: `production_items`, `production_orders`, `shift_stock_checks`, `shifts`, `stock_adjustments`, `recipes`, `semi_products`, `data_recovery_changes`, `data_migration_runs`, `sync_state`.
  - Header: the trigger/foreign-key inventory from this plan, stated as read from migration text.
- [ ] **Step 3: edit `core.ts`, the `.gs` file, and the test.** Delete `backup-to-sheets/`.
- [ ] **Step 4: `npx vitest run tests/edge-functions tests/migrations lib/db`.** Expect green.
- [ ] **Step 5: commit.** `feat(db): drop the 10 abandoned tables (migration 0105, not applied)`

### Task 5: Docs

- `docs/01-system/TABLE-DICTIONARY.md`: 44 → 34. Remove the 10 rows and add them to the dropped list with the 2026-09-28 date.
- `docs/01-system/SYSTEM-OVERVIEW.md`: remove `backup-to-sheets`. Say backup covers 34 tables.
- `docs/02-rules/business-rules/inventory.md`:
  - `BR-INV-006`: recipes no longer stay; the table was dropped 2026-09-28.
  - `BR-INV-003`: mark it retired, keeping its code so the rules test still resolves. Check `check-rules-current` for what a retired rule needs.
- `docs/02-rules/business-rules/cogs.md:77`: replace "96 active variant recipes…" with the fact that recipes were removed (2026-08-27 decision, table dropped 2026-09-28).
- `docs/02-rules/GLOSSARY.md`, `docs/03-workflows/inventory-catalog.md`, `product-catalog.md`, `stock-issue.md`, `docs/01-system/MULTI-BRANCH-IMPACT.md`, `docs/01-system/SYSTEM-MAP.md`: strip references to the 10 tables and to the stock-adjustment screen.
- `docs/superpowers/specs/2026-09-28-ban-do-bang-du-lieu.md`: mark group C as done.
- Regenerate `docs/generated/system-map.md` via `npx vite-node scripts/system-map/generate.ts`.

- [ ] Run `check-rules-current` and `doc-checks/run-blocking`. Expect PASS.
- [ ] Commit: `docs: the 10 abandoned tables are gone`

### Task 6: Verify locally

- [ ] Run all five commands and `verify-cogs`. Report each with its denominator.
- [ ] Fresh reviewer (`reviewer` agent) on the diff against this plan.

## Release (each step needs its own owner approval)

The order avoids a broken night of backups and keeps product saving down for as short a time as possible.

1. **Owner pastes the new `EXPECTED_TABLES` into Google Apps Script.** The file content is given to him. With the edge function still sending 44 tables, the extra 10 only trigger a non-fatal warning email. Pasting after the edge function deploy would make one night's backup fail.
2. **Push code** (Vercel deploys, about 2–3 minutes).
   - From the moment the new code is live until step 4, saving a product fails, because the old database function still demands a recipe decision.
   - The POS and every other screen are unaffected.
   - Do steps 2–4 back to back.
3. **Deploy the edge function:** `npx supabase functions deploy backup-to-drive`. Harmless while the tables still exist; it simply stops reading them.
4. **Run migration `0105`:** `npx supabase db push --linked`.
5. **Delete the dead edge function:** `npx supabase functions delete backup-to-sheets`.
6. **Check after release.**
   - Re-count tables: 34 exposed.
   - Run `verify-cogs`: 49.943.622đ, 0 mismatch / 191 orders.
   - Owner saves one product: edit a price, then remove it again.
   - The next morning, confirm the Drive backup file exists with 34 tables: `npx vite-node scripts/verify-drive-backup.ts`.

Nothing to export first: every Drive backup up to the night before step 4 already holds all 44 tables, including the 5 non-empty ones above. Step 6 relies on that. Before step 4, run `npx vite-node scripts/verify-drive-backup.ts` to confirm last night's file exists and lists `recipes`, `shifts`, `data_migration_runs`, `sync_state`.
