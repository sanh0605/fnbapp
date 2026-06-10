# Revenue, COGS, Profit Calculation Audit - Design Spec

Date: 2026-06-10

## Problem Summary

7 issues found in revenue/COGS/profit calculations. 4 critical, 3 moderate.

## Issue 1: MAC is Lifetime Average (Critical)

**Current:** `MAC = sum(ALL PO_RECEIPT value) / sum(ALL PO_RECEIPT qty)` computed once for all time.

**Fix:** Compute MAC per day within P&L date range. For each day, sum all PO_RECEIPT entries from the beginning of time up to that day.

```
For each date D in P&L range:
  receipts = PO_RECEIPT.where(ingredient_id = X, created_at <= endOfDay(D))
  MAC[D][X] = sum(r.qty * r.unit_cost) / sum(r.qty)
```

Each order uses the MAC of its `created_at` date (VN timezone).

**Edge cases:**
- No receipts before order date: COGS = 0
- Division by zero (no receipts at all): MAC = 0

**Performance:** Group orders by date. Compute MAC once per date per ingredient. Orders on same date share the same MAC.

**Semi-products:** Semi-product MAC depends on base ingredient MAC at same date. Compute base MAC first, then derive semi-product MAC from recipe.

## Issue 2: Revenue Inconsistency Between Reports (Critical)

**Current:**
- P&L: computes from Order_Lines with line_discount allocation
- Sales Report: uses order.total_amount (header level) when no category filter
- Dashboard: uses order.total_amount; best sellers use qty * unit_price without discount

**Fix:** Extract shared `computeRevenueFromLines(orderLines, orders)` function. All 3 reports call this function.

Logic per Order_Line:
```
variantRaw = qty * unit_price
modsRaw = sum(mod.price * qty)
lineDiscount = line.line_discount || 0

if (lineDiscount >= variantRaw):
  variantRevenue = 0
  remainingDiscount = lineDiscount - variantRaw
else:
  variantRevenue = variantRaw - lineDiscount
  remainingDiscount = 0

For each modifier:
  modRaw = mod.price * qty
  modRatio = modRaw / modsRaw (if modsRaw > 0)
  modRevenue = max(0, modRaw - remainingDiscount * modRatio)
```

**Affected files:**
- `app/actions/reports.ts` - extract shared function, keep existing P&L logic
- `app/admin/reports/sales/page.tsx` - use shared function instead of order.total_amount
- `app/admin/page.tsx` - use shared function for best sellers

## Issue 3: Non-inventory Ingredients Included in COGS (Critical)

**Current:** `macMap` includes ALL base ingredients. Non-inventory items (cups, bags, etc.) are excluded from Stock_Ledger at order time but still included in P&L COGS.

**Fix:** Filter out non-inventory ingredients when building `macMap` and when computing recipe COGS.

```
macMap: only include base ingredients where is_non_inventory !== "TRUE"
COGS per recipe line: skip if ingredient is non-inventory
```

**Affected file:** `app/actions/reports.ts` in `getPnLData()`

## Issue 4: Recipe Fallback Uses Future Recipes (Moderate)

**Current:** `findRecipeAtTime` falls back to earliest recipe ever if none existed before order date. This can assign a future recipe to a historical order.

**Fix:** If no recipe found before order date, return null. Caller treats null as COGS = 0.

```
findRecipeAtTime(recipes, targetType, targetId, atTime):
  matching = recipes matching type+id where created_at <= atTime AND (no end_date or end_date > atTime)
  if matching.length > 0: return most recent
  return null  // was: fallback to earliest ever
```

**Affected file:** `app/actions/reports.ts`

## Issue 5: Hard-coded Free Coffee Shot (Moderate)

**Current:** Hard-coded check for "Ca phe da" + "20ml cot ca phe" sets modRevenue = 0.

**Fix:** Remove hard-coded check. The natural formula already handles this: if modifier price = 0, revenue = 0. COGS still calculates because the ingredient is consumed.

**Affected files:**
- `app/actions/reports.ts` - remove hard-coded check in getPnLData
- `app/admin/reports/sales/page.tsx` - remove same check if present

## Issue 6: Best Sellers Dashboard Ignores Discounts (Low)

**Current:** Best sellers rank by `qty * unit_price` without subtracting discounts.

**Fix:** Use shared `computeRevenueFromLines` to get actual revenue per product.

**Affected file:** `app/admin/page.tsx`

## Issue 7: Production Unit Cost = 0 (Low - No Fix Now)

`PRODUCTION_CONSUME` and `PRODUCTION_YIELD` have `unit_cost = 0`. This means semi-product costs are derived entirely from base ingredient MAC via recipes, not from production order costs.

This is acceptable for now. Semi-product MAC is already computed from base ingredient costs. No change needed unless tracking production overhead separately.

## Implementation Sequence

1. Extract `computeRevenueFromLines()` shared function (Issue 2)
2. Fix MAC to per-day calculation (Issue 1)
3. Filter non-inventory from COGS (Issue 3)
4. Fix recipe fallback (Issue 4)
5. Remove hard-coded free coffee shot (Issue 5)
6. Fix best sellers dashboard (Issue 6)

## Files to Modify

| File | Changes |
|---|---|
| `app/actions/reports.ts` | MAC per-day, non-inventory filter, recipe fallback, remove hard-code, extract shared function |
| `app/admin/reports/sales/page.tsx` | Use shared revenue function, remove hard-code |
| `app/admin/page.tsx` | Use shared revenue function for best sellers |

## Verification

After each fix, compare P&L numbers before and after for a known date range to ensure:
- Total revenue stays the same (Issues 2, 5, 6 should align reports, not change P&L)
- COGS changes reflect MAC fix (Issue 1) and non-inventory exclusion (Issue 3)
- Profit = Revenue - COGS is consistent across all reports
