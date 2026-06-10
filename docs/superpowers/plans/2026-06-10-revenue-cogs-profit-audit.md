# Revenue / COGS / Profit Audit - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 issues in revenue/COGS/profit calculation - MAC per-day, revenue consistency, non-inventory COGS exclusion, recipe fallback, remove hard-coded rules, dashboard accuracy.

**Architecture:** All changes are in 3 files. The bulk of logic lives in `app/actions/reports.ts` (P&L server action). A new shared utility `lib/report-utils.ts` provides `computeLineRevenue()` used by all 3 reports. MAC changes from a single lifetime average to a per-date map.

**Tech Stack:** Next.js server actions, Google Sheets DB (`lib/sheets_db.ts`), no test framework - verify via dev server.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/report-utils.ts` | **NEW** - Shared `computeLineRevenue()` function used by all 3 reports |
| `app/actions/reports.ts` | **MODIFY** - Per-day MAC, non-inventory filter, recipe fallback fix, remove hard-code, use shared utility |
| `app/admin/reports/sales/page.tsx` | **MODIFY** - Use shared `computeLineRevenue`, remove hard-code, fix KPI to use line-level revenue |
| `app/admin/page.tsx` | **MODIFY** - Use shared `computeLineRevenue` for best sellers revenue |

---

### Task 1: Create shared `computeLineRevenue` utility

**Files:**
- Create: `lib/report-utils.ts`

- [ ] **Step 1: Create `lib/report-utils.ts` with `computeLineRevenue`**

```typescript
export interface LineRevenueResult {
  variantRevenue: number;
  modRevenues: { id: string; name: string; revenue: number; raw: number }[];
  lineTotal: number;
}

export function computeLineRevenue(line: {
  qty: number;
  unit_price: number;
  line_discount: number;
  modifiers_json: string;
}): LineRevenueResult {
  const qty = Number(line.qty || 0);
  const price = Number(line.unit_price || 0);
  const lineDiscount = Number(line.line_discount || 0);

  const variantRaw = qty * price;
  let remainingDiscount = lineDiscount;

  let variantRevenue: number;
  if (remainingDiscount >= variantRaw) {
    variantRevenue = 0;
    remainingDiscount -= variantRaw;
  } else {
    variantRevenue = variantRaw - remainingDiscount;
    remainingDiscount = 0;
  }

  let mods: { id: string; name: string; price: number }[] = [];
  let modsRaw = 0;
  if (line.modifiers_json) {
    try {
      const parsed = JSON.parse(line.modifiers_json);
      if (Array.isArray(parsed)) {
        mods = parsed;
        mods.forEach((m: any) => { modsRaw += Number(m.price || 0) * qty; });
      }
    } catch {}
  }

  const modRevenues = mods.map((mod: any) => {
    const modRaw = Number(mod.price || 0) * qty;
    const modRatio = modsRaw > 0 ? modRaw / modsRaw : 0;
    const modDiscount = remainingDiscount * modRatio;
    const modRevenue = Math.max(0, modRaw - modDiscount);
    return {
      id: mod.id || mod.name || "",
      name: mod.name || "",
      revenue: modRevenue,
      raw: modRaw,
    };
  });

  const lineTotal = variantRevenue + modRevenues.reduce((s, m) => s + m.revenue, 0);
  return { variantRevenue, modRevenues, lineTotal };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/report-utils.ts
git commit -m "feat: add shared computeLineRevenue utility for reports"
```

---

### Task 2: Remove hard-coded free coffee shot from P&L and Sales report

This is the simplest change - removes 3 lines from each file. Doing it early so subsequent tasks don't need to preserve it.

**Files:**
- Modify: `app/actions/reports.ts:284-287`
- Modify: `app/admin/reports/sales/page.tsx:129-132`

- [ ] **Step 1: Remove hard-code from `reports.ts`**

Delete these 3 lines (284-287) in `app/actions/reports.ts`:

```typescript
        // REMOVE THESE 3 LINES:
        if (pName === "Cà phê đá" && mod.name === "20ml cốt cà phê") {
          modRevenue = 0;
        }
```

- [ ] **Step 2: Remove hard-code from `sales/page.tsx`**

Delete these 3 lines (129-132) in `app/admin/reports/sales/page.tsx`:

```typescript
            // REMOVE THESE 3 LINES:
            if (pName === "Cà phê đá" && mod.name === "20ml cốt cà phê") {
              modRevenue = 0;
            }
```

- [ ] **Step 3: Verify dev server starts**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/actions/reports.ts app/admin/reports/sales/page.tsx
git commit -m "fix: remove hard-coded free coffee shot rule from P&L and Sales reports"
```

---

### Task 3: Fix recipe fallback - remove future recipe assignment

**Files:**
- Modify: `app/actions/reports.ts:109-120`

- [ ] **Step 1: Replace fallback in `findRecipeAtTime`**

In `app/actions/reports.ts`, replace lines 109-120 (the fallback block):

Old code:
```typescript
    // Fallback: Nếu không tìm thấy công thức nào hiệu lực trước đó, lấy công thức được tạo sớm nhất
    const allForTarget = allRecipes.filter((r: any) => r.target_type === targetType && r.target_id === targetId);
    if (allForTarget.length === 0) return null;
    
    allForTarget.sort((a: any, b: any) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });
    return allForTarget[0];
```

New code:
```typescript
    return null;
```

- [ ] **Step 2: Verify `calculateRecipeCost` handles null**

Check that `calculateRecipeCost` (line 122) already returns 0 for null recipe:
```typescript
const calculateRecipeCost = (recipe: any) => {
    if (!recipe || !recipe.ingredients_json) return 0;  // <-- already handles null
```

- [ ] **Step 3: Verify `addRecipeIngredientsToConsumption` handles null**

Check that `addRecipeIngredientsToConsumption` (line 143) already handles null:
```typescript
const addRecipeIngredientsToConsumption = (recipe: any, lineQty: number) => {
    if (!recipe || !recipe.ingredients_json) return;  // <-- already handles null
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/reports.ts
git commit -m "fix: remove future recipe fallback in P&L - return null/COGS=0 when no recipe at order time"
```

---

### Task 4: Fix MAC to per-day calculation

This is the largest change. Replace the lifetime MAC with a date-indexed MAC map.

**Files:**
- Modify: `app/actions/reports.ts:36-83` (MAC calculation block)
- Modify: `app/actions/reports.ts:122-131` (`calculateRecipeCost` - needs date parameter)
- Modify: `app/actions/reports.ts:143-160` (`addRecipeIngredientsToConsumption` - needs date parameter)
- Modify: `app/actions/reports.ts:239-256` (variant COGS - needs date lookup)
- Modify: `app/actions/reports.ts:264-275` (modifier COGS - needs date lookup)

- [ ] **Step 1: Replace MAC calculation block (lines 36-83)**

Replace the entire MAC block in `getPnLData()` with:

```typescript
  // 2. Tính MAC theo ngày (Moving Average Cost tại từng thời điểm)
  const nonInventoryIds = new Set(
    baseIngredients.filter((b: any) => b.is_non_inventory === "TRUE" || b.is_non_inventory === true).map((b: any) => b.id)
  );

  const receipts = stockLedger.filter((s: any) => s.transaction_type === "PO_RECEIPT");

  // Lấy tất cả unique dates từ completedOrders (để tính MAC cho từng ngày)
  const orderDates = [...new Set(
    completedOrders.map((o: any) => {
      const d = new Date(o.created_at);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    })
  )].sort((a, b) => a - b);

  // macByDate[timestamp][ingredientId] = MAC tại cuối ngày đó
  const macByDate: Record<number, Record<string, number>> = {};

  // Tính MAC cho base ingredients tại mỗi ngày có đơn hàng
  const allIngredientIds = new Set(receipts.map((r: any) => r.item_reference));

  for (const dateTs of orderDates) {
    const dateEnd = dateTs + 24 * 60 * 60 * 1000 - 1; // end of day
    const macForDate: Record<string, number> = {};

    allIngredientIds.forEach((ingId: string) => {
      if (nonInventoryIds.has(ingId)) return; // Skip non-inventory
      let totalValue = 0;
      let totalQty = 0;
      receipts.forEach((r: any) => {
        if (r.item_reference !== ingId) return;
        const rTime = new Date(r.created_at).getTime();
        if (rTime > dateEnd) return;
        const qty = Number(r.quantity_change || 0);
        const cost = Number(r.unit_cost || 0);
        totalQty += qty;
        totalValue += qty * cost;
      });
      macForDate[ingId] = totalQty > 0 ? totalValue / totalQty : 0;
    });

    macByDate[dateTs] = macForDate;
  }

  // Helper: get MAC for an ingredient at a given order time
  const getMAC = (ingredientId: string, orderTime: string): number => {
    const orderTs = new Date(orderTime);
    const orderDateTs = new Date(orderTs.getFullYear(), orderTs.getMonth(), orderTs.getDate()).getTime();
    // Find the nearest date <= orderDateTs
    const sortedDates = orderDates.filter(d => d <= orderDateTs);
    if (sortedDates.length === 0) return 0;
    const nearestDate = sortedDates[sortedDates.length - 1];
    return macByDate[nearestDate]?.[ingredientId] || 0;
  };

  // Tính MAC cho Bán thành phẩm tại mỗi ngày
  const spRecipes = recipes.filter((r: any) => r.target_type === "SEMI_PRODUCT" && (!r.end_date || r.end_date === ""));

  semiProducts.forEach((sp: any) => {
    const recipe = spRecipes.find((r: any) => r.target_id === sp.id);
    if (!recipe || !recipe.ingredients_json) return;

    let ings: any[] = [];
    try { ings = JSON.parse(recipe.ingredients_json); } catch {}

    for (const dateTs of orderDates) {
      let totalCost = 0;
      for (const ing of ings) {
        const ingMac = macByDate[dateTs]?.[ing.ingredient_id] || 0;
        totalCost += ingMac * Number(ing.quantity || 0);
      }
      const yieldQty = Number(sp.batch_yield || 1);
      if (!macByDate[dateTs]) macByDate[dateTs] = {};
      macByDate[dateTs][sp.id] = yieldQty > 0 ? totalCost / yieldQty : 0;
    }
  });
```

- [ ] **Step 2: Update `calculateRecipeCost` to accept date-specific MAC**

Replace `calculateRecipeCost` (lines 122-131):

```typescript
  const calculateRecipeCost = (recipe: any, orderTime: string) => {
    if (!recipe || !recipe.ingredients_json) return 0;
    let ings: any[] = [];
    try { ings = JSON.parse(recipe.ingredients_json); } catch {}
    let cost = 0;
    for (const ing of ings) {
      if (nonInventoryIds.has(ing.ingredient_id)) continue;
      cost += getMAC(ing.ingredient_id, orderTime) * Number(ing.quantity || 0);
    }
    return cost;
  };
```

- [ ] **Step 3: Update `addRecipeIngredientsToConsumption` to accept date-specific MAC**

Replace `addRecipeIngredientsToConsumption` (lines 143-160):

```typescript
  const addRecipeIngredientsToConsumption = (recipe: any, lineQty: number, orderTime: string) => {
    if (!recipe || !recipe.ingredients_json) return;
    let ings: any[] = [];
    try { ings = JSON.parse(recipe.ingredients_json); } catch {}
    for (const ing of ings) {
      if (nonInventoryIds.has(ing.ingredient_id)) continue;
      const itemId = ing.ingredient_id;
      const qtyConsumed = Number(ing.quantity || 0) * lineQty;
      const costPerUnit = getMAC(itemId, orderTime);
      const lineIngredientCOGS = qtyConsumed * costPerUnit;

      if (!cogsByItem[itemId]) {
        cogsByItem[itemId] = 0;
        qtyByItem[itemId] = 0;
      }
      cogsByItem[itemId] += lineIngredientCOGS;
      qtyByItem[itemId] += qtyConsumed;
    }
  };
```

- [ ] **Step 4: Update variant COGS call sites**

In the main `orderLines.forEach` loop, update the variant COGS section (around lines 246-256):

```typescript
    const histRecipe = findRecipeAtTime(recipes, "PRODUCT_VARIANT", line.variant_id, orderTime);
    const variantCogs = calculateRecipeCost(histRecipe, orderTime) * qty;
    addRecipeIngredientsToConsumption(histRecipe, qty, orderTime);
```

- [ ] **Step 5: Update modifier COGS call sites**

In the modifiers loop (around lines 271-275):

```typescript
        const histModRecipe = findRecipeAtTime(recipes, "MODIFIER", mod.id, orderTime);
        const modCogs = calculateRecipeCost(histModRecipe, orderTime) * qty;
        addRecipeIngredientsToConsumption(histModRecipe, qty, orderTime);
```

- [ ] **Step 6: Update COGS Details to use order-specific MAC**

The `cogsDetails` block (lines 308-328) uses `macMap[id]` for display. Replace with a representative MAC (latest date in range):

```typescript
      return {
        item_id: id,
        name,
        qty: qtyByItem[id],
        unitName,
        mac: orderDates.length > 0 ? (macByDate[orderDates[orderDates.length - 1]]?.[id] || 0) : 0,
        cogs: cogsByItem[id]
      };
```

- [ ] **Step 7: Verify dev server starts**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds with 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/actions/reports.ts
git commit -m "fix: compute MAC per-day for accurate historical COGS in P&L report"
```

---

### Task 5: Use shared `computeLineRevenue` in P&L report

Refactor the revenue calculation in `reports.ts` to use the shared utility from `lib/report-utils.ts`. This reduces duplication and ensures consistency.

**Files:**
- Modify: `app/actions/reports.ts` (import and use `computeLineRevenue`)

- [ ] **Step 1: Add import at top of `reports.ts`**

Add after the existing import:
```typescript
import { computeLineRevenue } from "@/lib/report-utils";
```

- [ ] **Step 2: Replace inline revenue logic in the main `orderLines.forEach` loop**

Replace the revenue calculation block (lines ~206-237) with:

```typescript
    const lineRevenue = computeLineRevenue({
      qty: Number(line.qty || 0),
      unit_price: Number(line.unit_price || 0),
      line_discount: Number(line.line_discount || 0),
      modifiers_json: line.modifiers_json || "",
    });

    const variantRevenue = lineRevenue.variantRevenue;
```

- [ ] **Step 3: Replace modifier revenue in the same loop**

Replace the modifier revenue block (lines ~264-282) with:

```typescript
        const modRevenue = lineRevenue.modRevenues.find(m => m.id === (mod.id || mod.name))?.revenue || 0;
```

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/actions/reports.ts
git commit -m "refactor: use shared computeLineRevenue in P&L report"
```

---

### Task 6: Use shared `computeLineRevenue` in Sales report

Fix the Sales report to compute revenue from lines instead of `order.total_amount`, and remove the inline discount allocation logic.

**Files:**
- Modify: `app/admin/reports/sales/page.tsx`

- [ ] **Step 1: Add import**

Add at top of file:
```typescript
import { computeLineRevenue } from "@/lib/report-utils";
```

- [ ] **Step 2: Replace inline revenue calculation in the main `orderLines.forEach` (lines ~73-148)**

Replace the per-line discount allocation with `computeLineRevenue`:

The entire `orderLines.forEach` block should be refactored. The key change is replacing lines 73-89 (inline discount logic) and lines 116-132 (modifier discount logic) with calls to `computeLineRevenue`. Keep the product/topping accumulation logic, just change how `variantRevenue` and `modRevenue` are computed:

```typescript
    const lineRevenue = computeLineRevenue({
      qty: Number(line.qty || 0),
      unit_price: Number(line.unit_price || 0),
      line_discount: Number(line.line_discount || 0),
      modifiers_json: line.modifiers_json || "",
    });

    const variantRevenue = lineRevenue.variantRevenue;
    let remainingDiscountForMods = 0; // already handled by computeLineRevenue
```

And for modifiers, replace the inline mod discount calculation:
```typescript
            lineRevenue.modRevenues.forEach((modResult) => {
              if (!toppingSalesMap[modResult.id]) {
                toppingSalesMap[modResult.id] = { name: modResult.name, qty: 0, revenue: 0 };
              }
              toppingSalesMap[modResult.id].qty += qty;
              toppingSalesMap[modResult.id].revenue += modResult.revenue;
              lineTotal += modResult.revenue;
              if (!categorySalesMap["topping"]) categorySalesMap["topping"] = 0;
              categorySalesMap["topping"] += modResult.revenue;
            });
```

- [ ] **Step 3: Fix KPI totalRevenue to always use line-level computation**

Replace lines 167-194 (the KPI calculation block) with line-level revenue for both filtered and unfiltered cases:

```typescript
  let totalRevenue = 0;
  let totalOrders = 0;

  validLines.forEach((line: any) => {
    const lineRevenue = computeLineRevenue({
      qty: Number(line.qty || 0),
      unit_price: Number(line.unit_price || 0),
      line_discount: Number(line.line_discount || 0),
      modifiers_json: line.modifiers_json || "",
    });
    totalRevenue += lineRevenue.lineTotal;
  });
  const uniqueOrderIds = new Set(validLines.map((l: any) => l.order_id));
  totalOrders = uniqueOrderIds.size;
```

- [ ] **Step 4: Fix chart data to use line-level revenue for both filtered and unfiltered**

Replace the chart data computation (lines ~218-260) to always compute from lines:

```typescript
  validLines.forEach((line: any) => {
    if (!line.created_at) return;
    const d = new Date(line.created_at);
    const dateStr = d.toLocaleDateString("en-GB");
    const monthKey = `${d.getMonth() + 1}/${d.getFullYear()}`;

    const lineRevenue = computeLineRevenue({
      qty: Number(line.qty || 0),
      unit_price: Number(line.unit_price || 0),
      line_discount: Number(line.line_discount || 0),
      modifiers_json: line.modifiers_json || "",
    });
    const amount = lineRevenue.lineTotal;

    if (salesByDate[dateStr] !== undefined) salesByDate[dateStr] += amount;
    if (salesByMonth[monthKey] !== undefined) salesByMonth[monthKey] += amount;
    salesByDayOfWeek[d.getDay()] += amount;
    salesByHour[d.getHours()] += amount;
  });
```

This removes the `if (categoryId) ... else` branching - always compute from lines.

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/admin/reports/sales/page.tsx
git commit -m "fix: use shared computeLineRevenue in Sales report for consistent revenue"
```

---

### Task 7: Fix best sellers in Dashboard

Fix the admin dashboard to use `computeLineRevenue` for best sellers revenue, instead of `qty * price` without discounts.

**Files:**
- Modify: `app/admin/page.tsx:151-178`

- [ ] **Step 1: Add import**

Add at top of file:
```typescript
import { computeLineRevenue } from "@/lib/report-utils";
```

- [ ] **Step 2: Replace best sellers revenue calculation**

Replace lines 152-174 (the `productSales` computation) with:

```typescript
  const productSales: Record<string, { qty: number, revenue: number, name: string }> = {};

  orderLines.forEach((line: any) => {
    const order = currOrders.find((o: any) => o.id === line.order_id);
    if (!order) return;

    const key = `${line.product_id}_${line.variant_id}`;
    if (!productSales[key]) {
      const p = products.find((x: any) => x.id === line.product_id);
      const v = variants.find((x: any) => x.id === line.variant_id);
      const pName = p ? p.name : line.product_id;
      const vName = v ? v.name : '';
      productSales[key] = {
        name: vName ? `${pName} (${vName})` : pName,
        qty: 0,
        revenue: 0
      };
    }

    const qty = Number(line.qty || 0);
    const lineRevenue = computeLineRevenue({
      qty,
      unit_price: Number(line.unit_price || 0),
      line_discount: Number(line.line_discount || 0),
      modifiers_json: line.modifiers_json || "",
    });
    productSales[key].qty += qty;
    productSales[key].revenue += lineRevenue.lineTotal;
  });
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "fix: use shared computeLineRevenue for best sellers revenue in dashboard"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Run full build**

Run: `npx next build`
Expected: Build succeeds with 0 TypeScript errors.

- [ ] **Step 2: Start dev server and manually verify**

Run: `npx next dev`

Open each report and verify:
1. **P&L Report** (`/admin/reports/pnl`) - Revenue, COGS, Profit display correctly for current month
2. **Sales Report** (`/admin/reports/sales`) - Revenue matches P&L total revenue for same period
3. **Dashboard** (`/admin`) - Best sellers show revenue after discount

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address verification findings from report audit"
```
