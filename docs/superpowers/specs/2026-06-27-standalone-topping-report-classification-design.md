# Standalone Topping Report Classification — Design

**Date**: 2026-06-27
**Author**: Claude (Coordinator)
**Status**: Approved by user, ready for implementation
**Depends on**: `docs/superpowers/specs/2026-06-27-topping-standalone-design.md` (data layer shipped 2026-06-27)

## Context

The 2026-06-27 topping-standalone setup created CAT-007 "Topping" + 7 Products (PROD-029..035) so customers can buy toppings without a drink. Each topping variant is a regular `Order_Lines_V2` row with `product.category_id === "CAT-007"`.

The current Sales and P&L reports classify lines as topping only when `product_id.startsWith("MOD:")` (modifier add-on). Standalone topping variants have real product IDs (`PROD-0XX`) so they leak into the drink sections:

- **Sales `bestSellers`**: standalone toppings appear next to drinks.
- **Sales `bestToppings`**: standalone toppings missing — revenue/qty under-counted.
- **Sales category chart**: standalone creates a CAT-007 slice; add-ons create a lowercase `"topping"` slice — both render with label "Topping".
- **P&L `toppingProfitAnalysis`**: standalone toppings fall into the drink profit analysis.

## Goals

1. Sales report `bestToppings` includes standalone topping sales merged with the corresponding modifier add-on sales (one row per topping name).
2. Sales report `bestSellers` excludes standalone toppings (drink list is drink-only).
3. Sales category chart shows a single "Topping" slice aggregating both standalone and add-on revenue.
4. P&L `toppingProfitAnalysis` includes standalone toppings merged with their add-on counterpart.
5. P&L drink profit analysis excludes standalone toppings.

## Non-goals

- Stock report changes — stock is ingredient-level and already correct.
- Modifying `lib/report-v2-allocators.ts` return types — would require Codex allocator change; defer.
- Historical reclassification of orders placed before CAT-007 existed — those have no CAT-07 lines by definition.
- Category chart refactor beyond the merge fix.

## Architecture

### Detection rule

A `ProductRevenueRow` (output of `breakdownRevenueByProduct`) is a "topping" for report purposes if EITHER:

- `product_id.startsWith("MOD:")` — modifier add-on (existing behavior), OR
- The underlying product's `category_id === "CAT-007"` — standalone topping.

The second check requires looking up the product's category. Since the reports already load `Products`, the lookup is cheap.

### Merge key

When a standalone topping matches a known modifier (via `Products.migration_notes` link `topping-standalone::mod_id=MOD-XXX`), bucket it under the linked modifier ID. This makes the topping appear once in `bestToppings` regardless of how it was sold.

If a standalone topping has no `migration_notes` link (e.g. user-created topping without the setup script), fall back to bucketing under the standalone product ID. This produces a separate row in `bestToppings` — acceptable trade-off vs. forcing a link.

### Where the change lives

`app/admin/reports/actions.ts` — both `getSalesDataV2` and the P&L data loader. Specifically the classification loop after `breakdownRevenueByProduct`.

No change to `lib/report-v2-allocators.ts`. We work with what it returns today.

## Data flow

### Step 1 — load products (already done in Sales; needed in P&L)

```typescript
const products = await findAll("Products");

// Map: standalone topping product_id -> linked modifier_id (or product_id fallback)
const standaloneToppingToModId = new Map<string, string>();
for (const p of products) {
  if (String(p.category_id) !== "CAT-007") continue;
  const notes = String(p.migration_notes || "");
  const match = notes.match(/topping-standalone::mod_id=(MOD-\d+)/);
  standaloneToppingToModId.set(String(p.id), match ? match[1] : String(p.id));
}
```

### Step 2 — classification loop (replaces existing logic)

```typescript
for (const r of productRows) {
  let toppingKey: string | null = null;

  if (r.product_id.startsWith("MOD:")) {
    toppingKey = r.product_id.replace(/^MOD:/, "");
  } else if (standaloneToppingToModId.has(r.product_id)) {
    toppingKey = standaloneToppingToModId.get(r.product_id)!;
  }

  if (toppingKey) {
    if (!bestToppingsMap.has(toppingKey)) {
      bestToppingsMap.set(toppingKey, {
        modifier_id: toppingKey,
        name: r.product_name,
        qty: 0,
        revenue: 0,
      });
    }
    const row = bestToppingsMap.get(toppingKey)!;
    row.qty += r.qty;
    row.revenue += r.revenue;
  } else {
    // Existing bestSellers logic
    if (!bestSellersMap.has(r.product_id)) {
      bestSellersMap.set(r.product_id, {
        product_id: r.product_id,
        name: r.product_name,
        totalQty: 0,
        totalRevenue: 0,
        sizes: {},
      });
    }
    const row = bestSellersMap.get(r.product_id)!;
    row.totalQty += r.qty;
    row.totalRevenue += r.revenue;
    if (r.size_name) {
      row.sizes[r.size_name] = (row.sizes[r.size_name] || 0) + r.qty;
      uniqueSizesSet.add(r.size_name);
    }
  }
}
```

The canonical modifier lookup (`buildCanonicalModifierLookup`) stays — it normalizes names for legacy IDs. The merge key from `standaloneToppingToModId` already produces a valid MOD-XXX ID, which the canonical lookup will resolve.

### Step 3 — category chart merge

In `app/admin/reports/sales/page.tsx` lines 66-82:

```typescript
// Bucket standalone topping revenue under "topping" key (not CAT-007)
const standaloneProductIds = new Set(standaloneToppingToModId.keys());
for (const item of data.bestSellers) {
  if (standaloneProductIds.has(item.product_id)) continue; // standalone toppings already in bestToppings
  const p = products.find(x => x.id === item.product_id);
  const catId = p?.category_id || "unknown";
  categorySalesMap[catId] = (categorySalesMap[catId] || 0) + item.totalRevenue;
}
for (const t of data.bestToppings) {
  categorySalesMap["topping"] = (categorySalesMap["topping"] || 0) + t.revenue;
}
```

Since standalone toppings now flow into `bestToppings` (via Step 2), the second loop picks them up. The first loop's `standaloneProductIds` guard is defensive — it shouldn't trigger because standalone toppings don't appear in `bestSellers` anymore, but it prevents regressions if Step 2 changes.

### Step 4 — P&L `toppingProfitAnalysis`

In `app/admin/reports/pnl/page.tsx` line 42:

```typescript
// Before:
const toppingProfitAnalysis = data.productProfitAnalysis.filter(p => p.product_id.startsWith("MOD:"));

// After:
const standaloneToppingProductIds = new Set(/* built in actions, exposed via data */);
const toppingProfitAnalysis = data.productProfitAnalysis.filter(
  p => p.product_id.startsWith("MOD:") || standaloneToppingProductIds.has(p.product_id)
);
```

`getPnlDataV2` (or equivalent) needs the same classification treatment as `getSalesDataV2`: standalone toppings routed to `toppingProfitAnalysis` instead of regular product analysis. The page-level filter is a backstop; the action-level routing is the canonical fix.

## Files affected

| File | Owner per COLLABORATION.md | Change |
|---|---|---|
| `app/admin/reports/actions.ts` `getSalesDataV2` | Codex (data flow) | Build `standaloneToppingToModId` map; rewrite classification loop; expose standalone IDs in return for chart merge. |
| `app/admin/reports/actions.ts` P&L data function | Codex | Same classification logic; route standalone toppings into topping analysis. |
| `app/admin/reports/sales/page.tsx` | Antigravity | Category chart merge: skip standalone products in `bestSellers` loop. Minor change. |
| `app/admin/reports/pnl/page.tsx` | Antigravity | Include standalone IDs in `toppingProfitAnalysis` filter. |

No engine-file changes (`lib/*`). All changes confined to report actions + report UI pages.

## Verification

After implementation:

1. **Sales report — Best Toppings list**: with 7 standalone toppings configured and at least 1 sale of each:
   - Each topping appears once (not split between standalone and add-on).
   - Qty and revenue include both standalone and add-on sales.
   - Total of `bestToppings.revenue` equals sum of standalone topping line totals + add-on modifier revenue.
2. **Sales report — Best Sellers list**: no PROD-029..035 appear.
3. **Sales category chart**: single "Topping" slice; total equals Best Toppings total.
4. **P&L `toppingProfitAnalysis`**: includes standalone topping profit; total profit equals sum of standalone topping profit + add-on modifier profit.
5. **P&L drink profit analysis**: no PROD-029..035 appear.

Tests: extend `lib/report-v2-allocators.test.ts` or write a new report-classification test if needed. The change is in `actions.ts` which may not have unit tests — manual verification via the report pages is acceptable for v1.

## Risk boundary

- `app/admin/reports/actions.ts` is Codex territory (data flow). Codex review required.
- `app/admin/reports/{sales,pnl}/page.tsx` are Antigravity territory (UI). Antigravity implements page changes; Codex reviews the data flow impact.
- No `lib/*` changes in this spec.

## Open follow-ups (non-blocking)

- **Recipe drift** (carried from topping-standalone spec): if a modifier's recipe is edited, the standalone variant recipe does not auto-sync. Affects COGS accuracy in P&L. Mitigation: re-run `setup-topping-standalone.ts` after modifier edits, OR add a future sync script.
- **`Products.brand_id` missing** for PROD-027/028/029..035: reports-by-brand may misclassify. Out of scope for this spec.
- **Future topping categories**: if a second topping-like category is added, the hardcoded `CAT-007` check should be replaced with a category flag (e.g. `is_topping_category`).
