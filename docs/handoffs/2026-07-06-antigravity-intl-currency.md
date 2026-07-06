# Antigravity Prompt — Intl.NumberFormat centralization (number display only)

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Trigger: UI Phase D consistency. 144 `toLocaleString(...)` calls across 31 files. Convention is ad-hoc `num.toLocaleString("vi-VN")` followed by `" đ"` literal — repeated everywhere, no centralized helper.

**User direction (2026-07-06):** Display numbers only, NO currency unit ("đ" / "₫" / "VND"). Just the formatted number with vi-VN thousand separators.

## Goal

Create centralized `lib/format.ts` with a number formatter. Migrate the ~120 `toLocaleString("vi-VN") + " đ"` calls to use it. Currency symbol suffix is REMOVED everywhere.

After this change:
- Money displays as plain numbers: `15.000` (not `15.000 đ`)
- Single source of truth for format
- Context (currency vs quantity) inferred from surrounding UI labels

## File 1: Create `lib/format.ts`

```ts
/**
 * Centralized number formatter — vi-VN locale, plain number output.
 *
 * Why: 144 ad-hoc toLocaleString calls used inconsistent formats. User direction
 * 2026-07-06: display numbers only, no currency unit suffix. Context (VND vs
 * quantity) is inferred from surrounding UI labels.
 */

const NUMBER_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER_DECIMAL = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format number with vi-VN thousand separators.
 * Returns "15.000" for 15000.
 * Returns "---" for null/undefined/NaN/Infinity (defensive).
 */
export function formatNumber(
  value: number | string | null | undefined,
  opts: { withDecimals?: boolean } = {}
): string {
  const { withDecimals = false } = opts;
  if (value === null || value === undefined) return "---";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "---";
  return withDecimals
    ? NUMBER_FORMATTER_DECIMAL.format(num)
    : NUMBER_FORMATTER.format(num);
}
```

Note: do NOT name it `formatVND` or include any currency symbol. Just `formatNumber`. The fact that a number is VND money is conveyed by the surrounding UI (table header "Tổng tiền", button "Lưu giá", etc.).

## File 2: Migrate usages

For each `num.toLocaleString("vi-VN") + " đ"` (or similar with "₫" / " VND"), replace with `formatNumber(num)` AND remove the currency suffix.

**Before:**
```tsx
<span>{Number(order.net_total || 0).toLocaleString("vi-VN")} đ</span>
```

**After:**
```tsx
import { formatNumber } from "@/lib/format";
// ...
<span>{formatNumber(order.net_total)}</span>
```

Note: `formatNumber` handles `null/undefined/0` internally — no need for `Number(... || 0)` coercion.

## Files to migrate (priority order by call count)

| File | Calls | Priority |
|---|---|---|
| `app/admin/reports/pnl/page.tsx` | 25 | High |
| `app/admin/reports/sales/page.tsx` | 21 | High |
| `app/admin/orders/components/LineItemEditor.tsx` | 10 | High |
| `app/admin/orders/OrderDetailModal.tsx` | 9 | High |
| `app/admin/inventory/purchase-orders/[id]/page.tsx` | 9 | High |
| `components/POSScreen.tsx` | 8 | Medium |
| `components/pos/CartPanel.tsx` | 7 | Medium |
| `app/admin/page.tsx` | 5 | Medium |
| `app/admin/orders/OrderEditModal.tsx` | 4 | Medium |
| `app/admin/products/cogs-estimate/CogsCalculator.tsx` | 3 | Medium |
| `app/admin/promotions/components/PromotionsClient.tsx` | 3 | Medium |
| `components/pos/ProductCard.tsx` | 3 | Medium |
| Others (1-2 calls each) | ~22 files | Low |

## Also remove local `formatPrice` in `RecipeHistoryTimeline.tsx`

```tsx
// Remove local helper at line 84, replace usages with formatNumber
const formatPrice = (p: string | number | null) => {
  // ...
  return num.toLocaleString("vi-VN") + " đ";
};
```

After migration, this local helper is redundant. Replace its 3 usages with `formatNumber`.

## Context preservation

Some displays rely on the " đ" suffix for clarity (e.g., standalone total amounts). For those cases, the surrounding label provides context:

- ✓ "Tổng tiền: 15.000" — clear from label "Tổng tiền"
- ✓ "30.000 ₫" in a price tag — UI should remove the ₫
- ✓ Table column header "Tổng (VND)" + cell "15.000" — header provides unit

If a display absolutely requires the unit, leave a comment in the migration commit explaining why.

## Verify

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual: open `/admin/reports/pnl`, `/admin/orders`, `/pos` — verify all money displays show numbers only (no "đ" / "₫" / "VND" suffix)
4. Edge cases:
   - Null amount → "---"
   - 0 → "0"
   - Negative (refund) → "-15.000"
   - Large number (1M+) → "1.000.000"

## Commit strategy

Suggested: split into 2 commits:

1. `Antigravity feat: lib/format.ts centralized number formatter (no currency suffix)`
2. `Antigravity refactor: migrate toLocaleString("vi-VN") to formatNumber (31 files)`

## Out of scope

- Do NOT include any currency symbol in `formatNumber` output
- Do NOT add decimal places by default (VND has no minor units; most displays are integers)
- Do NOT touch non-currency number formatting that already uses `toLocaleString` correctly for quantities/percentages
- Do NOT add new dependencies

## Coordination note

This prompt is queued. Antigravity may already be mid-task on the touch-action + form-labels-htmlFor prompt (commit attempts showed pre-commit failures on `components/ProductForm.tsx` — likely a separate syntax issue in another in-flight change). Finish that work first, then pick up this Intl migration.

If Antigravity prefers to do this in the same session as the touch-action work, batch the Intl migration after forms are clean.
