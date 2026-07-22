# Task: Feature-Completeness FC-2 — Low-Stock/Reorder Suggestion UI (functional only)

## Tóm tắt cho chủ doanh nghiệp

Backend đã xong: hệ thống tự tính mức tiêu thụ trung bình mỗi ngày của
từng nguyên liệu/bán thành phẩm, từ đó tính ra "mức tồn nên đặt hàng lại"
và "số lượng nên đặt" — không phải một ngưỡng cố định gõ tay như trước,
mà tính từ dữ liệu bán hàng và nhập hàng thực tế. Đây chỉ là **gợi ý**,
không tự tạo đơn đặt hàng. Việc còn lại là hiển thị gợi ý này lên giao
diện — theo đúng ý chủ quán, làm phần **chức năng thôi, chưa cần đẹp**,
phần giao diện đẹp/đồng bộ sẽ làm chung một lượt khi tái thiết kế UI/UX
sau này.

## Context

Owner-approved design:
`docs/superpowers/plans/2026-07-20-feature-completeness-required-now-roadmap.md`
section 2 (redesigned per owner feedback from a static per-item threshold
to a consumption-rate-based computed suggestion). Second of the 3
feature-completeness items, after FC-1 (split payment, done).

Claude built and verified the backend/logic layer, covering Codex's role
while it's rate-limited until 2026-07-25 (Codex should review
retroactively when back, see `REV-4` in `docs/ROADMAP.md`):

- New `lib/reorder-suggestion.ts` — pure function `computeReorderSuggestions(input, options)`,
  no data fetching of its own (matches `lib/full-history-recompute.ts`'s
  convention: caller fetches, this module only computes). Returns one
  `ReorderSuggestion` per active, inventory-tracked base ingredient and
  semi-product:

  ```ts
  type ReorderSuggestion = {
    itemId: string;
    itemName: string;
    itemType: "BASE_INGREDIENT" | "SEMI_PRODUCT";
    baseUnitName: string;
    currentStock: number;
    hasSufficientData: boolean;       // false => show "not enough data", not a number
    avgDailyConsumption: number | null;
    lookbackDays: number;             // default 14
    leadTimeDays: number | null;
    leadTimeIsDefault: boolean;       // true => no PO history, using the 3-day fallback
    safetyBufferMultiplier: number;   // default 1.3
    reorderPoint: number | null;
    isLowStock: boolean;              // currentStock <= reorderPoint
    targetCoverageDays: number;       // default 10
    suggestedReorderQtyBaseUnit: number | null;
    suggestedReorderQtyPurchaseUnit: number | null;  // converted via UOM_Conversions, null if no conversion exists
    purchaseUnitName: string | null;
    conversionRate: number | null;
  };
  ```

- New server action `getReorderSuggestions()` in
  `app/admin/inventory/actions.ts` (next to the existing
  `getRealtimeStock()`, same `requireAdmin()` gate, same
  `unstable_cache`/tag-revalidation pattern, 60s revalidate). Fetches
  `Stock_Ledger`, `Base_Ingredients`, `Semi_Products`, `Units`,
  `Purchased_Items`, `UOM_Conversions`, `Purchase_Orders`,
  `Purchase_Order_Lines` and calls `computeReorderSuggestions`.
- Read-only: no new write path, no new table, no atomicity concern.
- 9 unit tests (`lib/reorder-suggestion.test.ts`) covering: insufficient
  history → "not enough data", avg-daily-consumption + reorder-point math,
  lookback-window boundary, lead-time derived from completed POs vs. the
  default fallback, non-completed POs excluded from lead-time, purchase-unit
  conversion, never-negative suggested quantity, non-inventory items
  excluded, semi-products included alongside base ingredients.
- `tsc --noEmit` clean, full suite 650/650 (up from 641), `next build`
  passed.

## Scope

### 1. Extend `/admin/reports/stock` with a reorder-suggestion view

`app/admin/reports/stock/page.tsx` currently fetches `getRealtimeStock()`
+ `findAll("Stock_Adjustments")` and renders `components/StockTable.tsx`.
Add a call to `getReorderSuggestions()` (same import path pattern:
`import { getReorderSuggestions } from "@/app/admin/inventory/actions"`)
and display it — either as a new section on the same page, a tab, or a
new lightweight page under `/admin/reports/stock`, whichever fits the
existing page's layout with the least new structure.

For each item, show (using real Vietnamese ingredient/product names, not
internal codes, per this repo's communication rule):

- Current stock (`currentStock` + `baseUnitName`).
- Whether it's low stock (`isLowStock`) — visually flag rows where true.
- Suggested reorder quantity (`suggestedReorderQtyPurchaseUnit` +
  `purchaseUnitName` when available; otherwise fall back to
  `suggestedReorderQtyBaseUnit` + `baseUnitName`).
- When `hasSufficientData` is `false`: show "Chưa đủ dữ liệu" (or
  equivalent) instead of any computed number — never show a
  zero/misleadingly-confident value for these rows.
- Optional but useful: surface `leadTimeIsDefault` somehow (e.g. a small
  note) so the owner knows when a suggestion is using the 3-day fallback
  vs. a real historical lead time — this affects how much to trust the
  number.

### 2. Functional-only, per owner instruction

No new visual polish beyond what's needed to read the numbers. Reuse
`StockTable.tsx`'s existing table styling/patterns if extending that
component, or the simplest applicable existing table component otherwise.
Full redesign is deferred to the later frontend/UI/UX phase.

### 3. This is a suggestion, not automation

Do not wire this into automatically creating a purchase order. If you
want to add a "pre-fill new PO" convenience link/button from a
low-stock row to `/admin/inventory/purchase-orders/new`, that's fine and
was flagged as a nice-to-have in the original plan, but it must still
require the operator to review and submit the PO themselves — no
automatic PO creation.

## Explicitly out of scope

- Changing `lib/reorder-suggestion.ts`'s formula or defaults (lookback
  14 days, lead time fallback 3 days, safety buffer 1.3x, target coverage
  10 days) — these are owner-approved proposed defaults, adjustable later
  once real numbers can be sanity-checked, not something to tune from the
  UI side.
- Any write path — this feature has none.
- FC-3 (shift/cash reconciliation) — separate, lower-priority task, not
  started.

## Stop-and-ping trigger

- If `getReorderSuggestions()` is slow enough to notice on page load
  (e.g. because `Stock_Ledger` is large and uncached — it uses
  `findAllNoCache`) — flag it rather than silently accepting a slow page;
  a cache-tag adjustment or pagination may be needed, which is a backend
  change outside this handoff's scope.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: full suite passes (baseline: 650).
3. Manually exercise `/admin/reports/stock` (or the new page): confirm
   low-stock items are visually flagged, suggested quantities show in
   purchase units where a conversion exists, and items with too little
   history show "not enough data" rather than a number.
4. `git diff --check`: clean.
5. No push, no merge, no production data writes (this feature has no
   write path at all).
