# Current stock on the Hàng hoá screens (BR-CATALOG-004) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Hàng hoá list gets a "Tồn kho" column and each item's page gets "Tồn kho hiện tại", in the base unit; Dụng cụ shows "Xem ở Tài sản" and non-inventory items show "Không theo dõi tồn".

**Architecture:** One pure function turns an item plus its on-hand figure into the text to show. One server function builds that text for every item, reading the single on-hand formula `computeOnHandByPurchasedItem` (`lib/stock/purchased-item-onhand.ts`). Both Hàng hoá pages call it and pass the result down. Display only: nothing is written, no migration.

**Tech Stack:** Next.js App Router, TypeScript, Vitest.

**Spec:** `docs/02-rules/business-rules/catalog.md` → `BR-CATALOG-004` (owner 2026-10-05: *"1b"*, *"2a"*, *"1a"*). Changes an existing screen, adds no table and no route, so the design lives here (CLAUDE.md, Quy trình).

## Current state

Seen: `lib/stock/purchased-item-onhand.ts`, `app/admin/inventory/items/{page.tsx,actions.ts,components/ItemsClient.tsx}`, `app/admin/inventory/items/[id]/{page.tsx,components/ItemDetailView.tsx}`, `app/admin/inventory/issue-slips/actions.ts` (how it labels on-hand with a base unit), `app/admin/inventory/assets/[id]/page.tsx`, `components/ui/list/sort.ts`, `components/ui/detail/FieldList.tsx`, `lib/shared/format.ts`.
Not seen: `components/ui/list/DataList.tsx` in full (only its column options), the stocktake screen's own on-hand display.

1. **States, and how each is set.** Three kinds of item, decided per row, in this order:
   - **Dụng cụ**: its category's `system_type` is `EQUIPMENT`. Shows "Xem ở Tài sản".
   - **Không theo dõi tồn**: `purchased_items.is_non_inventory` is true (stored as boolean; older rows may carry the strings `"true"`/`"TRUE"`, read the same way the issue-slip screen does). Shows "Không theo dõi tồn".
   - **Theo dõi tồn**: everything else. Shows the figure and the base unit, e.g. "42.000 ml".

   Dụng cụ wins when both flags apply (none do today: the 15 non-inventory items are all Nguyên liệu or Vật tư tiêu hao).
2. **Buttons, and when to hide them.** No new button. On the item's own page, "Xem ở Tài sản" is a link to `/admin/inventory/assets?q=<item code>` (the assets list searches by item code). It is not a link to `/admin/inventory/assets/<item code>`, because that page returns "not found" when the item has no asset still in use. On the list it is plain text: the whole row already links to the item's own page, and a link inside a link misbehaves.
3. **What the list contains, and what is excluded.** Same rows as today. The new column sorts by figure; "Xem ở Tài sản" and "Không theo dõi tồn" sort last in both directions (`sortRows` puts empty values last). Zero is a figure and shows "0 ml", not hidden: 35 of the 69 tracked items stood at zero on 2026-10-05.
4. **Inputs.** None: display only. Figures out of the usual range:
   - A negative figure shows as is, "-5 trái". It is a real signal, not a typo: an issue slip refuses to go below zero, so a negative means something is wrong. Measured 2026-10-05: 0 negative among 69 tracked items.
   - A fraction shows up to two decimals, "0,5 kg". Measured: 0 fractional.
   - An item with no active conversion has no base unit and shows the figure alone. Measured: 0 such items.
5. **Data served, and data deliberately not served.**
   - **Served:** today's on-hand from completed purchase orders minus every stock issue, stocktake corrections included. It is the same formula as the issue-slip screen, never a second copy. A cancelled order (`BR-INV-015`) is already left out, because only `COMPLETED` counts.
   - **Not served:**
     - stock as of a past date;
     - stock in the purchase package (owner chose the base unit only, *"1b"*);
     - Dụng cụ quantities (they live on Tài sản, *"2a"*);
     - any figure for non-inventory items (*"1a"*).

Extra questions for this job:

6. **Where does the base unit come from?** From the item's ACTIVE conversion `base_unit`, the same source the issue-slip screen uses. `purchased_items.default_unit_id` is null on every row. Measured 2026-10-05: no item has two ACTIVE conversions with different base units.
7. **Freshness.** Both pages are `force-dynamic`, and `computeOnHandByPurchasedItem` reads without the cache. An issue slip saved a second ago shows on the next page load.
8. **Cost.** One extra read of every purchase line and stock issue per page load, already paid by the issue-slip screen. Accepted; no paging change.
9. **Who sees it.** Same as today (`requireAdmin`). Not added to the sales screen.

## Worked example (real data, measured 2026-10-05; these figures move every time stock is issued)

| Item | Kind | Bought (completed orders) | Issued | Shows |
|---|---|---|---|---|
| Sữa tươi Mlekovita (`SPM-002`) | tracked | 193.000 ml, 5 lines | 151.000 ml, 36 issues | **42.000 ml** |
| Trứng gà (`SPM-045`) | tracked | 1.800 trái, 24 lines | 1.684 trái, 18 issues (2 of them stocktake corrections) | **116 trái** |
| Đá viên (`SPM-005`) | non-inventory | 4.515.000 g, 9 lines | 0 | **Không theo dõi tồn** |
| Muỗng nhựa đen (`SPM-076`) | non-inventory | 3.000 Cái | 0 | **Không theo dõi tồn** |
| Muỗng nhựa định lượng 10g (`SPM-078`) | Dụng cụ | 5 Cây | 0 | **Xem ở Tài sản** |

Item counts that day: 69 tracked, 15 non-inventory, 67 Dụng cụ, all ACTIVE.

## Global Constraints

- Code and comments in English; on-screen text in Vietnamese, exactly: `Tồn kho`, `Tồn kho hiện tại`, `Xem ở Tài sản`, `Không theo dõi tồn`.
- Number format: vi-VN, thousands with ".", up to two decimals with ",", no trailing zeros (`new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 })`).
- One on-hand formula: call `computeOnHandByPurchasedItem`; never sum purchases or issues again.
- Desktop and phone both work (`.claude/rules/ui-devices.md`): desktop column, phone card line.
- No popups (`BR-DATA-007`); nothing is written.

## Review Focus

1. **An item that is both Dụng cụ and non-inventory** must show "Xem ở Tài sản". Pinned in Task 1.
2. **`is_non_inventory` stored as the string `"TRUE"`** must read as non-inventory. Pinned in Task 1.
3. **Sorting by Tồn kho descending** must still put the two text kinds last, not first. Pinned in Task 2.
4. **An item with stock but no row in the on-hand map** (never bought, never issued) must show "0 <unit>", not crash or show blank. Pinned in Task 1.
5. **Phone width**: the card shows the stock line, and nothing scrolls sideways. Checked by eye in Task 3.

---

### Task 1: Stock display builder and server function (backend → Sonnet)

**Files:**
- Create: `lib/stock/item-stock-display.ts`
- Create: `lib/stock/item-stock-display.test.ts`
- Modify: `app/admin/inventory/items/actions.ts` (add `getItemStockById`)
- Modify: `app/admin/inventory/items/actions.test.ts` (add its test)

**Interfaces:**
- Produces:
  ```ts
  export type ItemStockDisplay =
    | { kind: "equipment"; text: string }   // "Xem ở Tài sản"
    | { kind: "untracked"; text: string }   // "Không theo dõi tồn"
    | { kind: "figure"; text: string; onHand: number }; // "42.000 ml"

  export function buildItemStockById(input: {
    items: Array<{ id: string; item_category_id: string; is_non_inventory: unknown }>;
    categories: Array<{ id: string; system_type?: string | null }>;
    conversions: Array<{ purchased_item_id: string; base_unit: string; status: string }>;
    units: Array<{ id: string; name: string }>;
    onHandById: Map<string, number>;
  }): Record<string, ItemStockDisplay>;
  ```
  In `app/admin/inventory/items/actions.ts`: `export async function getItemStockById(): Promise<Record<string, ItemStockDisplay>>`. It runs `requireAdmin` and throws on failure, the same as `getItemsData`. It reads `Purchased_Items`, `Item_Categories`, `UOM_Conversions` and `Units`, and calls `computeOnHandByPurchasedItem()`.

- [ ] **Step 1: Write the failing tests** in `lib/stock/item-stock-display.test.ts`, one `it` per row:
  - `SPM-002` tracked, on-hand 42000, ACTIVE conversion base unit "ml" → `{ kind: "figure", text: "42.000 ml", onHand: 42000 }`.
  - `SPM-045` tracked, 116, "trái" → text `"116 trái"`.
  - `SPM-005` with `is_non_inventory: true`, on-hand 4515000 → `{ kind: "untracked", text: "Không theo dõi tồn" }`.
  - `is_non_inventory: "TRUE"` → untracked.
  - Item in a category with `system_type: "EQUIPMENT"` → `{ kind: "equipment", text: "Xem ở Tài sản" }`, also when `is_non_inventory` is true.
  - Tracked item missing from `onHandById` → `"0 ml"`, onHand 0.
  - −5 → `"-5 trái"`. 0.5 with "kg" → `"0,5 kg"`. 1234.567 → `"1.234,57 …"`.
  - Only an INACTIVE conversion → the figure with no unit and no trailing space, `"42.000"`.
- [ ] **Step 2: Run** `npx vitest run lib/stock/item-stock-display.test.ts`. Expected red: the module does not exist (missing function).
- [ ] **Step 3: Implement** `buildItemStockById`:
  - equipment check first, then non-inventory (`=== true || === "true" || === "TRUE"`), else figure;
  - unit from the item's ACTIVE conversion;
  - text `` `${fmt(onHand)} ${unit}`.trim() ``.
- [ ] **Step 4: Test `getItemStockById`** in `actions.test.ts`. Mock `@/lib/db/tables` and `@/lib/stock/purchased-item-onhand`, and check it returns the map for two items. Show it red first (missing export), then green.
- [ ] **Step 5:** `npx tsc --noEmit`, `npx vitest run lib/stock app/admin/inventory/items`. No commit: Opus reviews and commits.

### Task 2: Show it on the list and the item page (UI → Gemini via agy)

**Files:**
- Modify: `app/admin/inventory/items/page.tsx`: also call `getItemStockById()` in the same `Promise.all`; pass `stockById` to `ItemsClient`.
- Modify: `app/admin/inventory/items/components/ItemsClient.tsx`:
  - add the prop `stockById: Record<string, ItemStockDisplay>`;
  - add a column `{ key: "stock", header: "Tồn kho" }` after "Phân loại", not `secondary`. `sortValue` returns `onHand` for a figure and `null` otherwise. Render the text; the two text kinds use `text-text-muted`.
  - Phone card: a line `Tồn kho: <text>` under the category.
- Modify: `app/admin/inventory/items/[id]/page.tsx`: call `getItemStockById()` in the same `Promise.all`; pass `stock={stockById[item.id]}`.
- Modify: `app/admin/inventory/items/[id]/components/ItemDetailView.tsx`:
  - add the prop `stock?: ItemStockDisplay`;
  - add the field `{ label: "Tồn kho hiện tại", value }` right after "Tính tồn kho". For equipment the value is a `Link` "Xem ở Tài sản" to `` `/admin/inventory/assets?q=${encodeURIComponent(item.id)}` ``. Otherwise it is the text; missing `stock` shows "—".
- Tests: `ItemsClient.test.tsx`, `ItemDetailView.test.tsx`, `[id]/page.test.tsx`.

- [ ] **Step 1: Failing tests:**
  - The list renders "42.000 ml" for `SPM-002`, "Không theo dõi tồn" for `SPM-005` and "Xem ở Tài sản" for `SPM-078`, with no link inside the row for the last.
  - With `sort=stock&dir=desc`, the order is 42000, 116, then the two text rows.
  - The detail shows "Tồn kho hiện tại" with "42.000 ml". For `SPM-078` it shows a link to `/admin/inventory/assets?q=SPM-078`.

  Red first: the prop or column is missing.
- [ ] **Step 2: Implement; tests green.** `npx tsc --noEmit`.

### Task 3: Review, gates, docs (Opus)

- [ ] Review both diffs against this plan.
- [ ] Run all five gates. Build in a throwaway worktree.
- [ ] Look at the list and an item page on the dev server, desktop and phone width (read only, no "Lưu").
- [ ] Mark `BR-CATALOG-004` built, with the date.
- [ ] Check `docs/03-workflows/` for a flow that names the Hàng hoá screens, and add a behaviour-change line.
- [ ] Commit.
