# Wave 2 backend brief (Sonnet): Vietnamese refusals for item and item-category delete

Worktree: `C:/tmp/fnbapp-wave2` (branch `feat/list-template-wave2`). Work only there. Plan: `docs/superpowers/plans/2026-10-02-khuon-trang-dot2-hang-hoa.md`, "Hiện trạng" item 5.
Pattern to copy: `deleteSupplierAction` in `app/admin/suppliers/actions.ts` and its tests in `app/admin/suppliers/actions.test.ts` (commit 74fcff73).

## Why
- `deletePurchasedItemAction` (`app/admin/inventory/items/actions.ts`) calls `remove` directly. Every one of the 151 live items has at least one row in `uom_conversions`, so the `RESTRICT` foreign key refuses every delete and the owner only sees the generic "Có lỗi xảy ra…".
- `deleteItemCategory` (`app/admin/inventory/actions.ts`) returns `fail(error.message)` — the raw English Postgres string reaches the screen. All 3 live categories have items.

## Change 1 — `deletePurchasedItemAction`
Keep `requireOwner()` first. Then, inside try, load in parallel: `Purchased_Items`, `Purchase_Order_Lines`, `Stock_Issues`, `UOM_Conversions`, `Assets` (use `findAll` or `findAllWhere(..., { eq: { purchased_item_id: id } })`, as the codebase does). Count rows whose `purchased_item_id === id` in each.
- Item not found → `fail("Không tìm thấy hàng hoá.")`.
- Any count > 0 → `fail(\`Không xoá được ${item.name}: đã có ${parts.join(", ")}.\`)` where parts lists only non-zero counts, in this order, numbers through `formatNumber` (same import as suppliers):
  `"N dòng phiếu nhập"`, `"N lần xuất kho"`, `"N quy đổi"`, `"N tài sản"`.
  Example (live data, Sữa tươi Mlekovita SPM-002): "Không xoá được Sữa tươi Mlekovita: đã có 5 dòng phiếu nhập, 35 lần xuất kho, 1 quy đổi."
  Example (Túi lọc đa năng 200x300mm SPM-103): "Không xoá được Túi lọc đa năng 200x300mm: đã có 1 quy đổi."
- Otherwise remove as today (keep the revalidate calls). Errors → `describeActionError(error)`.

## Change 2 — `deleteItemCategory`
Keep `requireOwner()` first. Load `Item_Categories` and `Purchased_Items`.
- Not found → `fail("Không tìm thấy phân loại.")`.
- Items with `item_category_id === id` > 0 → `fail(\`Không xoá được ${category.name}: còn ${formatNumber(n)} hàng hoá thuộc phân loại này.\`)`. Live example: "Không xoá được Nguyên liệu: còn 56 hàng hoá thuộc phân loại này."
- Otherwise remove as today. Replace the `catch (error: any) { return fail(error.message) }` with `catch (error: unknown) { return describeActionError(error) }` (import if missing).

## Tests (red first)
- Add tests in `app/admin/inventory/items/actions.test.ts` and in the test file that covers `app/admin/inventory/actions.ts` (find it; create `app/admin/inventory/actions.test.ts` only if none exists), mocking `@/lib/db/tables` and `@/lib/auth/auth` the way the existing tests there do:
  1. item with 5 PO lines, 35 stock issues, 1 conversion → exact sentence above, `remove` not called;
  2. item with only 1 conversion → "…: đã có 1 quy đổi.";
  3. item with nothing → `remove` called once with ("Purchased_Items", id);
  4. unknown id → "Không tìm thấy hàng hoá.";
  5. non-owner → refused before any read (keep/extend existing coverage);
  6. category with 56 items → exact sentence, `remove` not called; category with 0 items → removed; a thrown DB error → not the raw message (describeActionError's output).
- Run each new test on the current code first and record whether it is red because of a wrong value or a missing function. Then implement.
- Run `npx vitest run app/admin/inventory` and `npx tsc --noEmit` — both green.

## Do not
- Touch any UI file, `components/`, `scripts/`, `.claude/`, `CLAUDE.md`.
- Change `deleteUnit` or `deleteConversionAction`.
- Write to real data, run migrations, push, or deploy. Do not commit — the wave 2 coordinator commits.

Report: files changed, each new test's red reason, green counts.
