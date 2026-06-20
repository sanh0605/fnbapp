# WS-4 Reports V2 Implementation Plan

> **For Antigravity (implementer):** Bite-sized TDD plan. Cadence: batch execution like WS-2/WS-3. Commit after each task, no review between, stop after Task 7. If a task fails tests, STOP and report.

**Goal:** Migrate PnL and Sales reports from V1 (`Orders`/`Order_Lines` + buggy `computeLineRevenue`) to V2 (`Orders_V2`/`Order_Lines_V2` + stored money fields). Use stored `net_line_total` and `cost_at_sale` directly — no recompute at read time. Add reconciliation script that compares V1 vs V2 totals for the overlap period to catch migration drift.

**Architecture:**
- **Reports sum stored values.** `totalRevenue = sum(order.net_total)`. `totalCOGS = sum(line.cost_at_sale)`. No MAC recompute, no `order_discount_ratio` multiplier, no `findRecipeAtTime`. The write path already pinned these at sale time (WS-2/WS-3); reports just trust them.
- **Per-product breakdown** uses `allocateLineRevenue` (WS-1) — single-ratio allocation across variant + modifiers. Replaces `computeLineRevenue` which mixed additive + multiplicative application.
- **Per-ingredient COGS breakdown** uses `parseLineRecipeSnapshot` (WS-3) to walk variant + modifier recipes snapshotted at sale time. No live recipe lookup, no time-travel bugs.
- **Latest versions only.** Reports filter `status=COMPLETED AND superseded_by=""`. SUPERSEDED + VOIDED rows are excluded. This is what `getOrdersV2` already does.
- **Stock report unchanged.** `getRealtimeStock` sums all `quantity_change` entries in `Stock_Ledger`. EDIT_REVERSAL entries (positive) naturally cancel prior SALES_CONSUME (negative) — self-balancing. V1 + V2 mix works without code change.
- **Reconciliation script** compares V1 totals vs V2 totals for any user-chosen date range. Designed to run after WS-5 migration to catch drift > 1đ per order.

**Tech Stack:** Next.js 14 server actions, existing `lib/sheets_db.ts`, `lib/order-math.ts` (allocateLineRevenue), `lib/order-types.ts` (parseLineRecipeSnapshot), `lib/order-cogs.ts` (computeLineCostAtSale — used in reconciliation only).

**Parent spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md` — section 6.4 (reports use stored values).

**Dependencies (already merged):** WS-1 (math), WS-2 (write path + snapshots), WS-3 (edit path + recipe snapshot shape).

---

## Critical Business Note

**Before WS-5 migration runs, V2 sheets only contain orders placed after WS-2 cutover (2026-06-19+).** Reports will show "no data" for any historical date range until WS-5 migrates V1 → V2.

Plan handles this by:
1. PnL/Sales pages display a banner when V2 returns 0 orders for the selected range, explaining migration status.
2. Reconciliation script works in both pre- and post-migration states (compares whatever exists in each sheet).

After WS-5 cutover, V2 has all historical data and reports work normally.

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `lib/report-v2-allocators.ts` | Pure functions: `breakdownRevenueByProduct`, `breakdownCOGSByIngredient`. Wrap `allocateLineRevenue` + `parseLineRecipeSnapshot` for report-shaped outputs. |
| `lib/report-v2-allocators.test.ts` | Unit tests for both break-down functions |
| `app/actions/reports-v2.ts` | `getPnLDataV2(filters)`, `getSalesDataV2(filters)` — read V2, aggregate, return report-ready shape |
| `app/actions/reports-v2.test.ts` | Unit tests with mocked sheets |
| `scripts/reconcile-v1-v2.ts` | Compare V1 vs V2 totals for a date range; flag orders with drift > 1đ |
| `scripts/test-pnl-v2.ts` | Smoke test: create order via V2, verify PnL shows it correctly |

### Files to modify

| Path | Change |
|---|---|
| `app/admin/reports/pnl/page.tsx` | Call `getPnLDataV2` instead of `getPnLData`; add migration-status banner |
| `app/admin/reports/sales/page.tsx` | Read V2 directly (or call `getSalesDataV2`); add migration-status banner |

### Files NOT touched in WS-4

- `app/actions/stock.ts` (`getRealtimeStock`) — self-balancing ledger already handles V2
- `app/admin/reports/stock/page.tsx` — uses `getRealtimeStock`, no change needed
- `app/actions/reports.ts` (legacy `getPnLData`) — kept for reconciliation; archived in WS-5
- `lib/report-utils.ts` (legacy `computeLineRevenue`) — kept for reconciliation; archived in WS-5
- `app/actions/pos.ts`, `order-edit.ts`, `orders.ts` — archived in WS-5

---

## Task 1: Report allocators (`lib/report-v2-allocators.ts`)

**Files:**
- Create: `lib/report-v2-allocators.ts`
- Create: `lib/report-v2-allocators.test.ts`

Pure functions that take V2 orders + lines and produce report-shaped breakdowns. No I/O.

- [ ] **Step 1: Write failing tests**

Create `lib/report-v2-allocators.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { breakdownRevenueByProduct, breakdownCOGSByIngredient } from "@/lib/report-v2-allocators";
import { makeSuaDauStandaloneOrder, makeUCK000094MigratedOrder, makePHD000540MigratedOrder } from "@/lib/__tests__/fixtures";
import type { OrderV2, OrderLineV2 } from "@/lib/order-types";

describe("breakdownRevenueByProduct", () => {
  it("returns empty array for empty input", () => {
    const result = breakdownRevenueByProduct([], []);
    expect(result).toEqual([]);
  });

  it("single Sữa Dâu order: revenue 25000 attributed to Sữa Dâu product", () => {
    const { order, lines } = makeSuaDauStandaloneOrder();
    const result = breakdownRevenueByProduct([order], lines);

    expect(result.length).toBe(1);
    expect(result[0].product_id).toBe("PROD-024");
    expect(result[0].product_name).toBe("Sữa dâu sấy giòn");
    expect(result[0].qty).toBe(1);
    expect(result[0].revenue).toBe(25000);
  });

  it("UCK000094 9-line order: each product gets its proportional share", () => {
    const { order, lines } = makeUCK000094MigratedOrder();
    const result = breakdownRevenueByProduct([order], lines);

    // Should have 8 distinct products (Yogurt dâu appears twice but same product_id)
    const productIds = new Set(result.map(r => r.product_id));
    expect(productIds.size).toBe(8);

    // Total revenue across all products = order.net_total = 161000
    const totalRev = result.reduce((s, r) => s + r.revenue, 0);
    expect(totalRev).toBe(order.net_total);
  });

  it("modifier revenue tracked separately", () => {
    const { order, lines } = makeUCK000094MigratedOrder();
    const result = breakdownRevenueByProduct([order], lines);

    // Yogurt dâu has 1 topping (Trân châu trắng 5k). Check topping appears as separate row.
    const toppingRow = result.find(r => r.product_id.startsWith("MOD:"));
    expect(toppingRow).toBeDefined();
    expect(toppingRow!.product_name).toContain("Trân châu");
  });

  it("PHD000540 (customer paid 0): all revenue lines report 0", () => {
    const { order, lines } = makePHD000540MigratedOrder();
    const result = breakdownRevenueByProduct([order], lines);

    for (const row of result) {
      expect(row.revenue).toBeGreaterThanOrEqual(0);
    }
    const totalRev = result.reduce((s, r) => s + r.revenue, 0);
    expect(totalRev).toBe(0);
  });

  it("aggregates across multiple orders correctly", () => {
    const order1 = makeSuaDauStandaloneOrder();
    const order2 = makePHD000540MigratedOrder();
    const allOrders = [order1.order, order2.order];
    const allLines = [...order1.lines, ...order2.lines];

    const result = breakdownRevenueByProduct(allOrders, allLines);

    // Sữa Dâu from order1 has revenue 25000
    const suaDau = result.find(r => r.product_id === "PROD-024");
    expect(suaDau?.revenue).toBe(25000);
    expect(suaDau?.qty).toBe(1);
  });
});

describe("breakdownCOGSByIngredient", () => {
  it("returns empty array for empty input", () => {
    const result = breakdownCOGSByIngredient([]);
    expect(result).toEqual([]);
  });

  it("UCK000094: ingredients from both variant + modifier recipes aggregated", () => {
    const { lines } = makeUCK000094MigratedOrder();
    const result = breakdownCOGSByIngredient(lines);

    // Lines have cost_at_sale = 0 in fixtures (not set), so total cogs = 0
    const totalCogs = result.reduce((s, r) => s + r.cogs, 0);
    expect(totalCogs).toBe(0);

    // But ingredients list should be populated from recipe snapshots
    const ingredientIds = result.map(r => r.ingredient_id);
    expect(ingredientIds.length).toBeGreaterThan(0);
  });

  it("lines with cost_at_sale > 0 distribute cost across their ingredients", () => {
    const { lines } = makeSuaDauStandaloneOrder();
    // Manually set cost_at_sale for test
    const testLines: OrderLineV2[] = lines.map(l => ({
      ...l,
      cost_at_sale: 12000,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-031",
          ingredients: [
            { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "L" },
            { ingredient_id: "BI-STRAWBERRY", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "KG" },
          ],
        },
        modifiers: [],
      }),
    }));

    const result = breakdownCOGSByIngredient(testLines);
    expect(result.length).toBe(2); // BI-MILK + BI-STRAWBERRY

    const totalCogs = result.reduce((s, r) => s + r.cogs, 0);
    expect(totalCogs).toBe(12000); // matches line cost_at_sale
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npm test -- report-v2-allocators.test.ts`
Expected: All tests fail with module-not-found.

- [ ] **Step 3: Implement `lib/report-v2-allocators.ts`**

Create `lib/report-v2-allocators.ts`:

```typescript
/**
 * Report-shape aggregations over V2 orders + lines.
 *
 * Pure functions. Use stored net_line_total and cost_at_sale; do not recompute.
 * Per-product revenue uses allocateLineRevenue (WS-1) for variant/modifier split.
 * Per-ingredient COGS uses parseLineRecipeSnapshot (WS-3) for ingredient walk.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 6.4)
 */

import { allocateLineRevenue } from "@/lib/order-math";
import { parseLineRecipeSnapshot } from "@/lib/order-types";
import type { OrderV2, OrderLineV2, LineForAllocation } from "@/lib/order-types";

export interface ProductRevenueRow {
  product_id: string;
  product_name: string;
  variant_id: string;
  size_name: string;
  qty: number;
  revenue: number;
}

export interface IngredientCOGSRow {
  ingredient_id: string;
  cogs: number;
  qty_consumed: number;
}

/**
 * Break down revenue across products (and modifiers as pseudo-products).
 * Total of all `revenue` fields equals sum of order.net_total values.
 */
export function breakdownRevenueByProduct(
  orders: OrderV2[],
  lines: OrderLineV2[],
): ProductRevenueRow[] {
  const validOrderIds = new Set(orders.map(o => o.id));
  const map = new Map<string, ProductRevenueRow>();

  for (const line of lines) {
    if (!validOrderIds.has(line.order_id)) continue;

    const productSnap = JSON.parse(line.product_snapshot_json || "{}");
    const variantSnap = JSON.parse(line.variant_snapshot_json || "{}");
    const modifiers = JSON.parse(line.modifiers_snapshot_json || "[]");

    const lineForAlloc: LineForAllocation = {
      unit_price: line.unit_price,
      qty: line.qty,
      modifiers,
      gross_line_total: line.gross_line_total,
      promo_discount: line.promo_discount,
      manual_item_discount: line.manual_item_discount,
      order_discount_allocation: line.order_discount_allocation,
    };

    const alloc = allocateLineRevenue(lineForAlloc);

    // Variant row
    const variantKey = `${line.product_id}__${line.variant_id}`;
    if (!map.has(variantKey)) {
      map.set(variantKey, {
        product_id: line.product_id,
        product_name: productSnap.name || line.product_id,
        variant_id: line.variant_id,
        size_name: variantSnap.size_name || "",
        qty: 0,
        revenue: 0,
      });
    }
    const variantRow = map.get(variantKey)!;
    variantRow.qty += line.qty;
    variantRow.revenue += alloc.variantRevenue;

    // Modifier rows (each modifier is its own pseudo-product for revenue attribution)
    for (const mod of modifiers) {
      const modKey = `MOD:${mod.id}`;
      if (!map.has(modKey)) {
        map.set(modKey, {
          product_id: modKey,
          product_name: mod.name || mod.id,
          variant_id: "",
          size_name: "",
          qty: 0,
          revenue: 0,
        });
      }
      const modRow = map.get(modKey)!;
      modRow.qty += line.qty * Number(mod.qty || 1);
      modRow.revenue += alloc.modifierRevenue[mod.id] || 0;
    }
  }

  return Array.from(map.values()).filter(r => r.qty > 0 || r.revenue > 0);
}

/**
 * Break down COGS across raw ingredients (Base_Ingredients + Semi_Products).
 * Uses line.cost_at_sale (pinned at sale time) and splits proportionally
 * by ingredient quantity within the line's recipe snapshot.
 *
 * Total of all `cogs` fields equals sum of line.cost_at_sale values.
 */
export function breakdownCOGSByIngredient(lines: OrderLineV2[]): IngredientCOGSRow[] {
  const map = new Map<string, IngredientCOGSRow>();

  for (const line of lines) {
    if (line.cost_at_sale <= 0) continue;
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);

    // Collect all ingredients for this line with their quantities
    const allIngredients: Array<{ id: string; qty: number }> = [];
    for (const ing of lineRecipe.variant.ingredients) {
      allIngredients.push({ id: ing.ingredient_id, qty: ing.quantity * line.qty });
    }
    for (const modEntry of lineRecipe.modifiers) {
      for (const ing of modEntry.recipe.ingredients) {
        allIngredients.push({ id: ing.ingredient_id, qty: ing.quantity * line.qty });
      }
    }

    const totalQty = allIngredients.reduce((s, i) => s + i.qty, 0);
    if (totalQty <= 0) continue;

    for (const ing of allIngredients) {
      if (!map.has(ing.id)) {
        map.set(ing.id, { ingredient_id: ing.id, cogs: 0, qty_consumed: 0 });
      }
      const row = map.get(ing.id)!;
      const share = ing.qty / totalQty;
      row.cogs += Math.round(line.cost_at_sale * share);
      row.qty_consumed += ing.qty;
    }
  }

  return Array.from(map.values());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npm test -- report-v2-allocators.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/report-v2-allocators.ts lib/report-v2-allocators.test.ts
rtk git commit -m "feat(orders-v2): report allocators using stored V2 values

WS-4 step 1: pure functions breakdownRevenueByProduct and
breakdownCOGSByIngredient. Sum of revenue rows equals sum of
order.net_total. Sum of COGS rows equals sum of line.cost_at_sale.
No recompute, no time-travel, no order_discount_ratio multiplier.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: `getPnLDataV2` server action

**Files:**
- Create: `app/actions/reports-v2.ts`
- Create: `app/actions/reports-v2.test.ts`

Read V2 (latest versions only), filter by date/brand/staff/category, aggregate using Task 1 helpers.

- [ ] **Step 1: Write failing tests with mocks**

Create `app/actions/reports-v2.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: vi.fn(),
  findAll: vi.fn(),
}));

import { findAllNoCache, findAll } from "@/lib/sheets_db";
import { getPnLDataV2 } from "./reports-v2";
import { makeSuaDauStandaloneOrder, makeUCK000094MigratedOrder } from "@/lib/__tests__/fixtures";

describe("getPnLDataV2", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty result when no orders match filters", async () => {
    (findAllNoCache as any).mockResolvedValue([]);
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({ startDate: "2026-06-19", endDate: "2026-06-19" });

    expect(result.totalRevenue).toBe(0);
    expect(result.totalCOGS).toBe(0);
    expect(result.orderCount).toBe(0);
    expect(result.productProfitAnalysis).toEqual([]);
  });

  it("aggregates single Sữa Dâu order correctly", async () => {
    const suaDau = makeSuaDauStandaloneOrder();
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [suaDau.order];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});

    expect(result.orderCount).toBe(1);
    expect(result.totalRevenue).toBe(25000);
    expect(result.productProfitAnalysis.length).toBeGreaterThan(0);
    const suaDauRow = result.productProfitAnalysis.find(p => p.product_id === "PROD-024");
    expect(suaDauRow?.revenue).toBe(25000);
  });

  it("filters by date range", async () => {
    const order1 = makeSuaDauStandaloneOrder(); // created_at 2026-06-12
    const order2 = makeUCK000094MigratedOrder(); // created_at 2026-06-12
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order1.order, order2.order];
      if (sheet === "Order_Lines_V2") return [...order1.lines, ...order2.lines];
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    // Date range that excludes both orders
    const result = await getPnLDataV2({ startDate: "2026-01-01", endDate: "2026-01-31" });
    expect(result.orderCount).toBe(0);
  });

  it("filters by brandId", async () => {
    const suaDau = makeSuaDauStandaloneOrder(); // brand_id BR-002
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [suaDau.order];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({ brandId: "BR-999" }); // wrong brand
    expect(result.orderCount).toBe(0);
  });

  it("filters by categoryId (via product_snapshot)", async () => {
    const suaDau = makeSuaDauStandaloneOrder();
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [suaDau.order];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({ categoryId: "CAT-NONEXISTENT" });
    expect(result.orderCount).toBe(1); // order still counted
    expect(result.productProfitAnalysis.length).toBe(0); // but no products match
  });

  it("excludes SUPERSEDED orders", async () => {
    const suaDau = makeSuaDauStandaloneOrder();
    const superseded = { ...suaDau.order, status: "SUPERSEDED", superseded_by: "ord-v2-mock" };
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [superseded];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});
    expect(result.orderCount).toBe(0);
  });

  it("excludes VOIDED orders", async () => {
    const suaDau = makeSuaDauStandaloneOrder();
    const voided = { ...suaDau.order, status: "VOIDED" };
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [voided];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});
    expect(result.orderCount).toBe(0);
  });

  it("UCK000094: totalRevenue = 161000 (sum of line nets)", async () => {
    const uck = makeUCK000094MigratedOrder();
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [uck.order];
      if (sheet === "Order_Lines_V2") return uck.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});
    expect(result.totalRevenue).toBe(161000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npm test -- reports-v2.test.ts`
Expected: All tests fail.

- [ ] **Step 3: Implement `app/actions/reports-v2.ts`**

Create `app/actions/reports-v2.ts`:

```typescript
"use server";

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { ORDER_STATUS } from "@/lib/order-types";
import type { OrderV2, OrderLineV2 } from "@/lib/order-types";
import {
  breakdownRevenueByProduct,
  breakdownCOGSByIngredient,
  type ProductRevenueRow,
  type IngredientCOGSRow,
} from "@/lib/report-v2-allocators";

export interface PnLReportFilters {
  startDate?: string;
  endDate?: string;
  brandId?: string;
  staffName?: string;
  categoryId?: string;
}

export interface PnLReportResult {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  margin: number;
  orderCount: number;
  productProfitAnalysis: Array<{
    product_id: string;
    product_name: string;
    variant_id: string;
    size_name: string;
    qty: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    marginPct: number;
  }>;
  cogsDetails: Array<{
    ingredient_id: string;
    name: string;
    qty: number;
    unitName: string;
    cogs: number;
  }>;
  // Reconciliation indicator
  v2OrderCount: number;
  v1OrderCount?: number; // optional, set by reconciliation script
}

export async function getPnLDataV2(filters: PnLReportFilters = {}): Promise<PnLReportResult> {
  try {
    const [orders, orderLines, baseIngredients, semiProducts, units] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
      findAll("Units"),
    ]);

    const { startDate, endDate, brandId, staffName, categoryId } = filters;

    // 1. Filter orders: latest COMPLETED versions only
    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
      if (!o.created_at) return false;

      if (startDate && endDate) {
        const d = new Date(o.created_at);
        if (d < new Date(startDate) || d > new Date(endDate)) return false;
      }
      if (brandId && o.brand_id !== brandId) return false;
      if (staffName && o.created_by_name !== staffName) return false;

      return true;
    });

    const orderIds = new Set(filteredOrders.map(o => o.id));
    const filteredLines = (orderLines as any[]).filter(l => orderIds.has(l.order_id));

    // Coerce types
    const typedOrders: OrderV2[] = filteredOrders.map(coerceOrder);
    const typedLines: OrderLineV2[] = filteredLines.map(coerceLine);

    // 2. Total revenue = sum of order.net_total
    const totalRevenue = typedOrders.reduce((s, o) => s + o.net_total, 0);

    // 3. Total COGS = sum of line.cost_at_sale
    const totalCOGS = typedLines.reduce((s, l) => s + l.cost_at_sale, 0);

    // 4. Per-product revenue breakdown
    const productRows = breakdownRevenueByProduct(typedOrders, typedLines);

    // 5. Per-ingredient COGS breakdown
    const ingredientRows = breakdownCOGSByIngredient(typedLines);

    // 6. Build product profit analysis (join product revenue with product COGS)
    // Note: COGS is per-ingredient, not per-product. For per-product COGS we'd need
    // to attribute ingredients back to products. Use line-level cost_at_sale aggregated
    // by product_id as approximation.
    const cogsByProductId = new Map<string, number>();
    for (const line of typedLines) {
      const prev = cogsByProductId.get(line.product_id) || 0;
      cogsByProductId.set(line.product_id, prev + line.cost_at_sale);
    }

    const productProfitAnalysis = productRows
      .filter(r => !r.product_id.startsWith("MOD:"))
      .map(r => {
        const cogs = cogsByProductId.get(r.product_id) || 0;
        const grossProfit = r.revenue - cogs;
        const marginPct = r.revenue > 0 ? (grossProfit / r.revenue) * 100 : 0;
        return {
          product_id: r.product_id,
          product_name: r.product_name,
          variant_id: r.variant_id,
          size_name: r.size_name,
          qty: r.qty,
          revenue: r.revenue,
          cogs,
          grossProfit,
          marginPct,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit);

    // Add topping rows (modifiers as pseudo-products)
    const toppingRows = productRows
      .filter(r => r.product_id.startsWith("MOD:"))
      .map(r => ({
        product_id: r.product_id,
        product_name: r.product_name,
        variant_id: "",
        size_name: "",
        qty: r.qty,
        revenue: r.revenue,
        cogs: 0, // modifier COGS not separately tracked at line level
        grossProfit: r.revenue,
        marginPct: 100,
      }));

    // 7. COGS details with names + units
    const cogsDetails = ingredientRows
      .filter(r => r.cogs > 0)
      .map(r => {
        const bi = (baseIngredients as any[]).find(b => b.id === r.ingredient_id);
        const sp = (semiProducts as any[]).find(s => s.id === r.ingredient_id);
        const item = bi || sp;
        const unitId = item?.base_unit || "";
        const unitName = (units as any[]).find(u => u.id === unitId)?.name || unitId;
        return {
          ingredient_id: r.ingredient_id,
          name: item?.name || r.ingredient_id,
          qty: r.qty_consumed,
          unitName,
          cogs: r.cogs,
        };
      })
      .sort((a, b) => b.cogs - a.cogs);

    const grossProfit = totalRevenue - totalCOGS;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      margin,
      orderCount: typedOrders.length,
      productProfitAnalysis: [...productProfitAnalysis, ...toppingRows],
      cogsDetails,
      v2OrderCount: typedOrders.length,
    };
  } catch (err: any) {
    console.error("[getPnLDataV2]", err);
    return {
      totalRevenue: 0,
      totalCOGS: 0,
      grossProfit: 0,
      margin: 0,
      orderCount: 0,
      productProfitAnalysis: [],
      cogsDetails: [],
      v2OrderCount: 0,
    };
  }
}

// ============================================================
// Coercion helpers (sheet rows come back as strings)
// ============================================================

function coerceOrder(row: any): OrderV2 {
  return {
    ...row,
    version: Number(row.version) || 1,
    gross_total: Number(row.gross_total) || 0,
    promo_discount_total: Number(row.promo_discount_total) || 0,
    manual_item_discount_total: Number(row.manual_item_discount_total) || 0,
    manual_order_discount: Number(row.manual_order_discount) || 0,
    net_total: Number(row.net_total) || 0,
  } as OrderV2;
}

function coerceLine(row: any): OrderLineV2 {
  return {
    ...row,
    line_no: Number(row.line_no) || 0,
    qty: Number(row.qty) || 0,
    unit_price: Number(row.unit_price) || 0,
    gross_line_total: Number(row.gross_line_total) || 0,
    promo_discount: Number(row.promo_discount) || 0,
    manual_item_discount: Number(row.manual_item_discount) || 0,
    order_discount_allocation: Number(row.order_discount_allocation) || 0,
    net_line_total: Number(row.net_line_total) || 0,
    cost_at_sale: Number(row.cost_at_sale) || 0,
  } as OrderLineV2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npm test -- reports-v2.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add app/actions/reports-v2.ts app/actions/reports-v2.test.ts
rtk git commit -m "feat(orders-v2): getPnLDataV2 reads V2 with stored values

WS-4 step 2: PnL report server action. Reads Orders_V2 + Order_Lines_V2
(latest COMPLETED versions only). Sums stored net_total for revenue,
stored cost_at_sale for COGS. Per-product breakdown via WS-1
allocateLineRevenue. Per-ingredient COGS via WS-3 parseLineRecipeSnapshot.
No order_discount_ratio multiplier, no live recipe lookup.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: `getSalesDataV2` + Sales page migration

**Files:**
- Modify: `app/actions/reports-v2.ts` (add `getSalesDataV2`)
- Modify: `app/admin/reports/sales/page.tsx` (call V2)

Sales report needs: total revenue, total orders, avg/order, breakdowns by date/DOW/hour/month, best-sellers by product + size, best toppings.

- [ ] **Step 1: Add `getSalesDataV2` to `app/actions/reports-v2.ts`**

Append to `app/actions/reports-v2.ts`:

```typescript
// ============================================================
// Sales report
// ============================================================

export interface SalesReportResult {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  bestSellers: Array<{
    product_id: string;
    name: string;
    totalQty: number;
    totalRevenue: number;
    sizes: Record<string, number>;
  }>;
  bestToppings: Array<{
    modifier_id: string;
    name: string;
    qty: number;
    revenue: number;
  }>;
  uniqueSizes: string[];
  totalQtyBySize: Record<string, number>;
  totalQtyAll: number;
  salesByDate: Array<{ label: string; amount: number }>;
  salesByMonth: Array<{ label: string; amount: number }>;
  salesByDayOfWeek: Array<{ label: string; amount: number }>;
  salesByHour: Array<{ label: string; amount: number }>;
  salesByCategory: Array<{ label: string; amount: number }>;
}

export async function getSalesDataV2(filters: PnLReportFilters = {}): Promise<SalesReportResult> {
  try {
    const [orders, orderLines, categories] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAll("Product_Categories"),
    ]);

    const { startDate: startDateStr, endDate: endDateStr, brandId, staffName, categoryId } = filters;

    // Default date range: current month
    let startDate = startDateStr ? new Date(startDateStr) : (() => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    let endDate = endDateStr ? new Date(endDateStr) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Filter orders
    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      if (d < startDate || d > endDate) return false;
      if (brandId && o.brand_id !== brandId) return false;
      if (staffName && o.created_by_name !== staffName) return false;
      return true;
    });

    const orderIds = new Set(filteredOrders.map(o => o.id));
    const filteredLines = (orderLines as any[])
      .filter(l => orderIds.has(l.order_id))
      .map(coerceLine);

    const typedOrders = filteredOrders.map(coerceOrder);

    // Total revenue = sum of net_total (NOT sum of line revenue, to match customer-paid)
    const totalRevenue = typedOrders.reduce((s, o) => s + o.net_total, 0);
    const totalOrders = typedOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Per-product breakdown via Task 1 allocator
    const productRows = breakdownRevenueByProduct(typedOrders, filteredLines);

    // Best sellers (exclude modifier pseudo-products)
    const bestSellers = productRows
      .filter(r => !r.product_id.startsWith("MOD:"))
      .map(r => {
        // Re-attach category filter if specified
        if (categoryId) {
          const productSnap = filteredLines
            .find(l => l.product_id === r.product_id)?.product_snapshot_json;
          const parsed = productSnap ? JSON.parse(productSnap) : {};
          if (parsed.category_id !== categoryId) return null;
        }
        return {
          product_id: r.product_id,
          name: r.product_name,
          totalQty: r.qty,
          totalRevenue: r.revenue,
          sizes: r.size_name ? { [r.size_name]: r.qty } : {},
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.totalQty - a!.totalQty) as SalesReportResult["bestSellers"];

    // Aggregate sizes across variants of same product
    const merged = new Map<string, SalesReportResult["bestSellers"][number]>();
    for (const seller of bestSellers) {
      const existing = merged.get(seller.product_id);
      if (existing) {
        existing.totalQty += seller.totalQty;
        existing.totalRevenue += seller.totalRevenue;
        for (const [size, qty] of Object.entries(seller.sizes)) {
          existing.sizes[size] = (existing.sizes[size] || 0) + qty;
        }
      } else {
        merged.set(seller.product_id, { ...seller, sizes: { ...seller.sizes } });
      }
    }
    const mergedBestSellers = Array.from(merged.values()).sort((a, b) => b.totalQty - a.totalQty);

    const uniqueSizes = Array.from(new Set(mergedBestSellers.flatMap(s => Object.keys(s.sizes)))).sort();
    const totalQtyBySize: Record<string, number> = {};
    for (const size of uniqueSizes) {
      totalQtyBySize[size] = mergedBestSellers.reduce((s, item) => s + (item.sizes[size] || 0), 0);
    }
    const totalQtyAll = mergedBestSellers.reduce((s, item) => s + item.totalQty, 0);

    // Best toppings
    const bestToppings = productRows
      .filter(r => r.product_id.startsWith("MOD:"))
      .map(r => ({
        modifier_id: r.product_id.replace("MOD:", ""),
        name: r.product_name,
        qty: r.qty,
        revenue: r.revenue,
      }))
      .sort((a, b) => b.qty - a.qty);

    // Time series breakdowns (use order-level net_total distributed to date)
    const salesByDate: Record<string, number> = {};
    const salesByMonth: Record<string, number> = {};
    const salesByDayOfWeek: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const salesByHour: Record<number, number> = {};
    for (let i = 0; i < 24; i++) salesByHour[i] = 0;

    // Pre-fill date/month buckets
    let curr = new Date(startDate);
    while (curr <= endDate) {
      salesByDate[curr.toLocaleDateString("en-GB")] = 0;
      curr.setDate(curr.getDate() + 1);
    }
    let currMonth = new Date(startDate);
    currMonth.setDate(1);
    while (currMonth <= endDate) {
      salesByMonth[`${currMonth.getMonth() + 1}/${currMonth.getFullYear()}`] = 0;
      currMonth.setMonth(currMonth.getMonth() + 1);
    }

    for (const o of typedOrders) {
      if (!o.created_at) continue;
      const d = new Date(o.created_at);
      const dateStr = d.toLocaleDateString("en-GB");
      const monthKey = `${d.getMonth() + 1}/${d.getFullYear()}`;
      if (salesByDate[dateStr] !== undefined) salesByDate[dateStr] += o.net_total;
      if (salesByMonth[monthKey] !== undefined) salesByMonth[monthKey] += o.net_total;
      salesByDayOfWeek[d.getDay()] += o.net_total;
      salesByHour[d.getHours()] += o.net_total;
    }

    // Per-category breakdown
    const salesByCategoryMap: Record<string, number> = {};
    for (const line of filteredLines) {
      const productSnap = JSON.parse(line.product_snapshot_json || "{}");
      const catId = productSnap.category_id || "unknown";
      // Use net_line_total for category attribution
      salesByCategoryMap[catId] = (salesByCategoryMap[catId] || 0) + line.net_line_total;
    }

    const dowNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      bestSellers: mergedBestSellers,
      bestToppings,
      uniqueSizes,
      totalQtyBySize,
      totalQtyAll,
      salesByDate: Object.entries(salesByDate).map(([label, amount]) => ({ label: label.substring(0, 5), amount })),
      salesByMonth: Object.entries(salesByMonth).map(([label, amount]) => ({ label, amount })),
      salesByDayOfWeek: [1, 2, 3, 4, 5, 6, 0].map(dow => ({ label: dowNames[dow], amount: salesByDayOfWeek[dow] })),
      salesByHour: Object.entries(salesByHour).map(([hour, amount]) => ({ label: `${hour}h`, amount })),
      salesByCategory: Object.entries(salesByCategoryMap).map(([catId, amount]) => {
        const c = (categories as any[]).find(x => x.id === catId);
        return { label: c?.name || (catId === "topping" ? "Topping" : "Khác"), amount: Math.round(amount) };
      }),
    };
  } catch (err: any) {
    console.error("[getSalesDataV2]", err);
    return {
      totalRevenue: 0, totalOrders: 0, avgOrderValue: 0,
      bestSellers: [], bestToppings: [], uniqueSizes: [],
      totalQtyBySize: {}, totalQtyAll: 0,
      salesByDate: [], salesByMonth: [], salesByDayOfWeek: [], salesByHour: [], salesByCategory: [],
    };
  }
}
```

- [ ] **Step 2: Update `app/admin/reports/sales/page.tsx`**

Replace the file contents to call `getSalesDataV2`:

```typescript
import { getSalesDataV2 } from "@/app/actions/reports-v2";
import { findAll } from "@/lib/sheets_db";
import SalesFilter from "@/components/SalesFilter";
import SalesCharts from "@/components/SalesCharts";
import CategoryPieChart from "@/components/CategoryPieChart";

export const dynamic = 'force-dynamic';

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const startParam = Array.isArray(searchParams?.start) ? searchParams.start[0] : searchParams?.start;
  const endParam = Array.isArray(searchParams?.end) ? searchParams.end[0] : searchParams?.end;
  const brandId = Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : searchParams?.brandId;
  const staffName = Array.isArray(searchParams?.staffName) ? searchParams.staffName[0] : searchParams?.staffName;
  const categoryId = Array.isArray(searchParams?.categoryId) ? searchParams.categoryId[0] : searchParams?.categoryId;

  const [data, brands, users, categories] = await Promise.all([
    getSalesDataV2({
      startDate: startParam,
      endDate: endParam,
      brandId,
      staffName,
      categoryId,
    }),
    findAll("Brands"),
    findAll("Users"),
    findAll("Product_Categories"),
  ]);

  return (
    <div className="space-y-6">
      <SalesFilter
        brands={brands}
        users={users}
        categories={categories}
        title="Báo cáo Bán hàng (V2)"
        subtitle="Phân tích hiệu quả kinh doanh theo thời gian. Đọc từ Orders_V2."
      />

      {data.totalOrders === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Không có đơn hàng V2 trong khoảng thời gian này. Đơn vị V1 sẽ được chuyển sang V2 ở WS-5 migration.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Tổng Doanh Thu</div>
          <div className="text-3xl font-bold text-gray-900">{data.totalRevenue.toLocaleString("vi-VN")} đ</div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Tổng Số Đơn</div>
          <div className="text-3xl font-bold text-gray-900">{data.totalOrders} <span className="text-sm font-normal text-gray-500">đơn</span></div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Doanh Thu Trung Bình / Đơn</div>
          <div className="text-3xl font-bold text-gray-900">{Math.round(data.avgOrderValue).toLocaleString("vi-VN")} đ</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
        <SalesCharts
          salesByDate={data.salesByDate}
          salesByDayOfWeek={data.salesByDayOfWeek}
          salesByHour={data.salesByHour}
          salesByMonth={data.salesByMonth}
        />
        <div className="xl:col-span-1">
          <CategoryPieChart data={data.salesByCategory} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Chi tiết Sản lượng</h3>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
              Tổng: {data.totalQtyAll} ly
            </span>
          </div>
          <div className="overflow-x-auto max-h-[528px] overflow-y-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white text-gray-400 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-4 py-3">Món</th>
                  {data.uniqueSizes.map(size => (
                    <th key={size} className="px-4 py-3 text-right">Size {size}</th>
                  ))}
                  <th className="px-4 py-3 text-right text-gray-700">Tổng SL</th>
                  <th className="px-4 py-3 text-right text-gray-700">Tổng Thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.bestSellers.length === 0 ? (
                  <tr><td colSpan={data.uniqueSizes.length + 3} className="text-center py-8 text-gray-400">Không có giao dịch</td></tr>
                ) : (
                  data.bestSellers.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                      {data.uniqueSizes.map(size => (
                        <td key={size} className="px-4 py-3 text-right font-medium text-gray-500">
                          {item.sizes[size] ? item.sizes[size] : '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{item.totalQty}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{Math.round(item.totalRevenue).toLocaleString("vi-VN")} đ</td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.bestSellers.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0 z-10 font-bold text-gray-900 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                  <tr>
                    <td className="px-4 py-3">Tổng cộng</td>
                    {data.uniqueSizes.map(size => (
                      <td key={size} className="px-4 py-3 text-right">
                        {data.totalQtyBySize[size] > 0 ? data.totalQtyBySize[size].toLocaleString("vi-VN") : "-"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">{data.totalQtyAll.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3 text-right text-green-700">{Math.round(data.totalRevenue).toLocaleString("vi-VN")} đ</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="xl:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Top Topping Bán Chạy</h3>
          </div>
          <div className="overflow-x-auto max-h-[528px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-gray-400 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-4 py-3">Topping</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                  <th className="px-4 py-3 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.bestToppings.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-gray-400">Không có topping nào</td></tr>
                ) : (
                  data.bestToppings.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-600">{item.qty}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{Math.round(item.revenue).toLocaleString("vi-VN")} đ</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep -E "reports-v2|sales/page"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
rtk git add app/actions/reports-v2.ts app/admin/reports/sales/page.tsx
rtk git commit -m "feat(orders-v2): getSalesDataV2 + sales page migration

WS-4 step 3: Sales report reads V2 only. Order-level net_total
attributed to date/DOW/hour for charts. Per-product breakdown via
breakdownRevenueByProduct. Banner shown when 0 orders in range
(pre-WS-5-migration state).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: PnL page migration

**Files:**
- Modify: `app/admin/reports/pnl/page.tsx`

Replace `getPnLData` call with `getPnLDataV2`. Adjust field names to V2 shape. Add migration-status banner.

- [ ] **Step 1: Update `app/admin/reports/pnl/page.tsx`**

Open the file and replace its contents with:

```typescript
import { getPnLDataV2 } from "@/app/actions/reports-v2";
import { findAll } from "@/lib/sheets_db";
import SalesFilter from "@/components/SalesFilter";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const defaultStartDate = new Date();
  defaultStartDate.setDate(1);
  defaultStartDate.setHours(0, 0, 0, 0);

  const defaultEndDate = new Date();
  defaultEndDate.setHours(23, 59, 59, 999);

  const startParam = Array.isArray(searchParams?.start) ? searchParams.start[0] : (searchParams?.start || defaultStartDate.toISOString());
  const endParam = Array.isArray(searchParams?.end) ? searchParams.end[0] : (searchParams?.end || defaultEndDate.toISOString());
  const brandId = Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : searchParams?.brandId;
  const staffName = Array.isArray(searchParams?.staffName) ? searchParams.staffName[0] : searchParams?.staffName;
  const categoryId = Array.isArray(searchParams?.categoryId) ? searchParams.categoryId[0] : searchParams?.categoryId;

  const filters = {
    startDate: startParam,
    endDate: endParam,
    brandId,
    staffName,
    categoryId,
  };

  const [data, brands, users, categories] = await Promise.all([
    getPnLDataV2(filters),
    findAll("Brands"),
    findAll("Users"),
    findAll("Product_Categories"),
  ]);

  return (
    <div className="space-y-6">
      <SalesFilter
        brands={brands}
        users={users}
        categories={categories}
        title="Báo cáo Lãi Lỗ (P&L) — V2"
        subtitle="Tổng hợp Doanh thu và Giá vốn từ Orders_V2. Cost pinned at sale time, không recompute."
      />

      {data.orderCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Không có đơn hàng V2 trong khoảng thời gian này. Đơn vị V1 sẽ được chuyển sang V2 ở WS-5 migration.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Tổng Doanh Thu</p>
              <h3 className="text-3xl font-black text-gray-900">{data.totalRevenue.toLocaleString('vi-VN')} đ</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl">💰</div>
          </div>
          <div className="text-sm font-medium text-gray-500">
            Từ <span className="text-gray-800 font-bold">{data.orderCount}</span> đơn hàng hoàn thành (V2)
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Giá Vốn (COGS)</p>
              <h3 className="text-3xl font-black text-red-600">{data.totalCOGS.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</h3>
            </div>
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-xl">📉</div>
          </div>
          <div className="text-sm font-medium text-gray-500">Chi phí nguyên vật liệu tiêu hao (pinned at sale time)</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-sm border border-emerald-500 p-6 flex flex-col justify-between text-white hover:shadow-lg hover:shadow-emerald-200 transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-emerald-100 uppercase tracking-wider mb-1">Lợi Nhuận Gộp</p>
              <h3 className="text-3xl font-black">{data.grossProfit.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</h3>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl">📈</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-emerald-100">Biên lợi nhuận gộp:</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-white text-emerald-700 shadow-sm">
              {data.margin.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Phân Tích Tỷ Trọng Giá Vốn Hàng Bán</h3>
          <p className="text-sm text-gray-500">Chi tiết chi phí tiêu hao của từng loại nguyên liệu gốc (từ recipe snapshots tại thời điểm bán).</p>
        </div>
        {data.cogsDetails.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-gray-500">Chưa có dữ liệu tiêu hao nguyên liệu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[484px] overflow-y-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4">Tên Nguyên Liệu</th>
                  <th className="px-6 py-4 text-right">Khối Lượng Tiêu Hao</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-900">Tổng Giá Vốn</th>
                  <th className="px-6 py-4 text-right">% Tỷ Trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.cogsDetails.map((item, idx) => {
                  const percentage = data.totalCOGS > 0 ? (item.cogs / data.totalCOGS) * 100 : 0;
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-800">{item.name}</td>
                      <td className="px-6 py-4 text-right text-orange-600 font-medium">
                        {item.qty.toLocaleString('vi-VN')} {item.unitName}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">
                        {item.cogs.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium text-gray-700">{percentage.toFixed(1)}%</span>
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Phân Tích Hiệu Quả Kinh Doanh Từng Món</h3>
          <p className="text-sm text-gray-500">Chi tiết doanh thu, giá vốn và biên lợi nhuận của từng món bán ra.</p>
        </div>
        {data.productProfitAnalysis.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-gray-500">Chưa có dữ liệu bán hàng.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[484px] overflow-y-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4">Tên Món</th>
                  <th className="px-6 py-4 text-center">Số Lượng Bán</th>
                  <th className="px-6 py-4 text-right">Doanh Thu</th>
                  <th className="px-6 py-4 text-right">Tổng Giá Vốn</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-900">Lợi Nhuận Gộp</th>
                  <th className="px-6 py-4 text-right">% Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.productProfitAnalysis.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 font-bold text-gray-800">{item.product_name}</td>
                    <td className="px-6 py-4 text-center text-blue-600 font-medium">{item.qty.toLocaleString('vi-VN')}</td>
                    <td className="px-6 py-4 text-right text-gray-700">{item.revenue.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</td>
                    <td className="px-6 py-4 text-right text-red-600">{item.cogs.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">{item.grossProfit.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded font-bold text-xs ${
                        item.marginPct >= 50 ? 'bg-emerald-100 text-emerald-700' :
                        item.marginPct >= 30 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "pnl/page"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
rtk git add app/admin/reports/pnl/page.tsx
rtk git commit -m "feat(orders-v2): PnL page migration to V2

WS-4 step 4: PnL report UI reads from getPnLDataV2. Banner shown
when 0 orders in range. Subtitle clarifies V2 source.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Reconciliation script (`scripts/reconcile-v1-v2.ts`)

**Files:**
- Create: `scripts/reconcile-v1-v2.ts`

Compares V1 totals vs V2 totals for a user-chosen date range. Designed to run after WS-5 migration to verify no data drift. Pre-migration: shows V1 has data, V2 doesn't (informative).

- [ ] **Step 1: Implement**

Create `scripts/reconcile-v1-v2.ts`:

```typescript
/**
 * Reconcile V1 vs V2 reports for a date range.
 *
 * Pre-WS-5-migration: V2 will likely have 0 orders, V1 will have many.
 * Post-WS-5-migration: V1 and V2 should match within ±1đ per order.
 *
 * Usage:
 *   npx tsx scripts/reconcile-v1-v2.ts                                # current month
 *   npx tsx scripts/reconcile-v1-v2.ts --start=2026-06-01 --end=2026-06-30
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache } = require("../lib/sheets_db");

function parseArgs(): { start: string; end: string } {
  const args = process.argv.slice(2);
  const get = (key: string): string | undefined => {
    const found = args.find(a => a.startsWith(`--${key}=`));
    return found ? found.split("=")[1] : undefined;
  };

  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    start: get("start") || defaultStart.toISOString(),
    end: get("end") || defaultEnd.toISOString(),
  };
}

async function main() {
  const { start, end } = parseArgs();
  console.log(`\n=== Reconciliation ${start} → ${end} ===\n`);

  const [v1Orders, v1Lines, v2Orders, v2Lines] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ]);

  // V1 filter
  const v1Filtered = (v1Orders as any[]).filter(o => {
    if (o.status !== "COMPLETED") return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= new Date(start) && d <= new Date(end);
  });

  // V2 filter (latest COMPLETED only)
  const v2Filtered = (v2Orders as any[]).filter(o => {
    if (o.status !== "COMPLETED") return false;
    if (o.superseded_by && o.superseded_by !== "") return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= new Date(start) && d <= new Date(end);
  });

  // V1 totals (legacy formula)
  let v1Revenue = 0;
  let v1LineDiscountSum = 0;
  const v1LineIds = new Set(v1Filtered.map(o => o.id));
  for (const line of v1Lines as any[]) {
    if (!v1LineIds.has(line.order_id)) continue;
    v1LineDiscountSum += Number(line.line_discount || 0) + Number(line.line_manual_discount || 0);
  }
  for (const o of v1Filtered) {
    v1Revenue += Number(o.total_amount || 0);
  }

  // V2 totals (stored values)
  const v2Revenue = v2Filtered.reduce((s, o) => s + Number(o.net_total || 0), 0);
  const v2LineIds = new Set(v2Filtered.map(o => o.id));
  let v2LineCOGS = 0;
  let v2PromoDiscount = 0;
  for (const line of v2Lines as any[]) {
    if (!v2LineIds.has(line.order_id)) continue;
    v2LineCOGS += Number(line.cost_at_sale || 0);
    v2PromoDiscount += Number(line.promo_discount || 0);
  }
  const v2GrossTotal = v2Filtered.reduce((s, o) => s + Number(o.gross_total || 0), 0);

  console.log("V1 (legacy):");
  console.log(`  Orders:           ${v1Filtered.length}`);
  console.log(`  Total revenue:    ${v1Revenue.toLocaleString("vi-VN")}đ`);
  console.log(`  Line discounts:   ${v1LineDiscountSum.toLocaleString("vi-VN")}đ`);
  console.log();
  console.log("V2 (new):");
  console.log(`  Orders:           ${v2Filtered.length}`);
  console.log(`  Gross total:      ${v2GrossTotal.toLocaleString("vi-VN")}đ`);
  console.log(`  Promo discounts:  ${v2PromoDiscount.toLocaleString("vi-VN")}đ`);
  console.log(`  Net revenue:      ${v2Revenue.toLocaleString("vi-VN")}đ`);
  console.log(`  COGS:             ${v2LineCOGS.toLocaleString("vi-VN")}đ`);
  console.log();

  if (v1Filtered.length === 0 && v2Filtered.length === 0) {
    console.log("Neither V1 nor V2 has orders in this range.");
  } else if (v2Filtered.length === 0) {
    console.log(`⚠ V2 has 0 orders. WS-5 migration has not run yet — V2 reports will show no data.`);
  } else if (v1Filtered.length === 0) {
    console.log(`ℹ V1 has 0 orders (legacy already archived?). V2 has ${v2Filtered.length}.`);
  } else {
    const drift = v1Revenue - v2Revenue;
    console.log(`Drift (V1 - V2): ${drift.toLocaleString("vi-VN")}đ`);
    if (Math.abs(drift) > v1Filtered.length) {
      console.log(`⚠ Drift exceeds ${v1Filtered.length}đ (1đ/order tolerance). Investigate before WS-5 cutover.`);
    } else {
      console.log(`✓ Drift within ${v1Filtered.length}đ tolerance. Migration OK.`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
```

- [ ] **Step 2: Run for current month (smoke)**

Run: `npx tsx scripts/reconcile-v1-v2.ts`
Expected: V1 has data, V2 has 0 orders (pre-WS-5-migration state). No errors.

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/reconcile-v1-v2.ts
rtk git commit -m "feat(orders-v2): V1 vs V2 reconciliation script

WS-4 step 5: compares V1 vs V2 report totals for a date range.
Pre-migration: shows V1 has data, V2 doesn't. Post-migration:
should match within ±1đ per order. Run before WS-5 cutover.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: PnL V2 smoke test script

**Files:**
- Create: `scripts/test-pnl-v2.ts`

End-to-end: create order via V2 → call getPnLDataV2 → verify revenue matches.

- [ ] **Step 1: Implement**

Create `scripts/test-pnl-v2.ts`:

```typescript
/**
 * Smoke test: create order via submitOrderV2 → call getPnLDataV2 → verify.
 *
 * Run: npx tsx scripts/test-pnl-v2.ts
 *
 * Verifies:
 *   1. getPnLDataV2 returns the created order in aggregation
 *   2. totalRevenue = sum of created orders' net_total
 *   3. Product profit analysis shows the correct product
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAll } = require("../lib/sheets_db");
const { submitOrderV2 } = require("../app/actions/pos-v2");
const { getPnLDataV2 } = require("../app/actions/reports-v2");

async function main() {
  console.log("Loading reference data...");
  const products = await findAll("Products");
  const variants = await findAll("Product_Variants");
  const suaDauProduct = products.find((p: any) => p.name?.includes("Sữa dâu"));
  const suaDauVariant = variants.find((v: any) => v.product_id === suaDauProduct.id);
  const brandId = suaDauProduct.brand_id || (await findAll("Brands"))[0].id;

  console.log("Creating order via V2...");
  const createRes = await submitOrderV2({
    brand_id: brandId,
    items: [{
      product_id: suaDauProduct.id,
      variant_id: suaDauVariant.id,
      qty: 1,
      modifiers: [],
      manual_item_discount: { value: 0, type: "VND" },
    }],
    payment_method: "CASH",
    actor: { id: "pnl-smoke", name: "PnL Smoke Test" },
  });

  if (!createRes.success) {
    console.error("Create failed:", createRes.error);
    process.exit(1);
  }
  console.log(`  Created: ${createRes.order_no}`);

  // Compute date range that includes today
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  console.log(`\nFetching PnL for today (${start} → ${end})...`);
  const pnl = await getPnLDataV2({ startDate: start, endDate: end });

  console.log("\n=== PnL V2 Result ===");
  console.log(`  Order count:      ${pnl.orderCount}`);
  console.log(`  Total revenue:    ${pnl.totalRevenue.toLocaleString("vi-VN")}đ`);
  console.log(`  Total COGS:       ${pnl.totalCOGS.toLocaleString("vi-VN")}đ`);
  console.log(`  Gross profit:     ${pnl.grossProfit.toLocaleString("vi-VN")}đ`);
  console.log(`  Margin:           ${pnl.margin.toFixed(2)}%`);
  console.log(`  Products in analysis: ${pnl.productProfitAnalysis.length}`);

  // Verify: created order should appear
  if (pnl.orderCount === 0) {
    console.log("\nFAIL: Order count is 0 — order was created but PnL didn't pick it up");
    process.exit(1);
  }

  // Verify: revenue should be >= 25000 (Sữa Dâu net)
  if (pnl.totalRevenue < 25000) {
    console.log(`\nFAIL: totalRevenue ${pnl.totalRevenue} < 25000`);
    process.exit(1);
  }

  // Verify: Sữa Dâu in productProfitAnalysis
  const suaDau = pnl.productProfitAnalysis.find((p: any) => p.product_id === suaDauProduct.id);
  if (!suaDau) {
    console.log(`\nFAIL: Sữa Dâu not in productProfitAnalysis`);
    process.exit(1);
  }
  console.log(`  Sữa Dâu revenue:  ${suaDau.revenue.toLocaleString("vi-VN")}đ (qty ${suaDau.qty})`);

  console.log("\nPASSED");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
```

- [ ] **Step 2: Run smoke test**

Run: `npx tsx scripts/test-pnl-v2.ts`
Expected: PASSED with all checks green.

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/test-pnl-v2.ts
rtk git commit -m "test(orders-v2): PnL V2 smoke test script

WS-4 step 6: end-to-end verification that getPnLDataV2 correctly
aggregates a V2-created order. Confirms order count, revenue, and
product profit analysis all reflect the new order.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Final verification + tracking update

- [ ] **Step 1: Run full test suite**

Run: `rtk npm test`
Expected: All previous + new tests pass. Target ~90+ tests total.

- [ ] **Step 2: TypeScript check**

Run: `rtk tsc --noEmit`
Expected: 0 errors in WS-4 files.

- [ ] **Step 3: Coverage**

Run: `rtk npm run test:coverage`
Expected: Add `report-v2-allocators.ts` to coverage include in vitest.config.ts. Target ≥ 90% on new file.

Update vitest.config.ts coverage include list:
```typescript
include: [
  // ... existing ...
  "lib/report-v2-allocators.ts",
],
```

- [ ] **Step 4: Run reconciliation script**

Run: `npx tsx scripts/reconcile-v1-v2.ts`
Expected: V1 has many orders, V2 has 0 (or few smoke-test orders). Pre-migration state confirmed.

- [ ] **Step 5: Run PnL smoke test**

Run: `npx tsx scripts/test-pnl-v2.ts`
Expected: PASSED.

- [ ] **Step 6: Manual browser verification**

Start dev server. In browser:
1. Open `/admin/reports/pnl` — verify page loads, shows banner "0 orders V2" (since pre-migration)
2. Open `/admin/reports/sales` — same banner expected
3. Open `/admin/reports/stock` — should still work unchanged (self-balancing ledger)
4. Place an order via POS — verify PnL/Sales now shows that order
5. Edit the order via admin — verify PnL still shows only latest version (not double-counted)
6. Void the order — verify PnL excludes it

- [ ] **Step 7: Update DEVELOPMENT-TRACKING.md**

Append new section for WS-4 with:
- Files created/modified
- Bug fixes (if any)
- Verification gate results
- Known gaps deferred to WS-5
- Commit history table (use actual hashes from `git log` — do NOT fabricate)

- [ ] **Step 8: Final commit**

```bash
rtk git add DEVELOPMENT-TRACKING.md vitest.config.ts
rtk git commit -m "docs(tracking): WS-4 reports V2 complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 9: Report to Claude**

Send:
- Final commit hash
- Test pass count + coverage
- Reconciliation script output
- PnL smoke test output
- Browser smoke test results
- Any issues encountered

---

## Self-Review

**Spec coverage check:**
- ✓ Reports sum stored values → Task 1 (`breakdownRevenueByProduct` uses `net_line_total`; Task 2 sums `net_total` + `cost_at_sale`)
- ✓ Per-product breakdown via `allocateLineRevenue` (WS-1) → Task 1
- ✓ Per-ingredient COGS via `parseLineRecipeSnapshot` (WS-3) → Task 1
- ✓ Latest versions only (status=COMPLETED AND superseded_by="") → Task 2 filter
- ✓ Stock report unchanged (self-balancing) → documented, no code change
- ✓ Reconciliation V1 vs V2 → Task 5
- ✓ Migration status banner → Tasks 3, 4 (banner shown when orderCount=0)
- ✓ Replaces `computeLineRevenue` usage → all migrated to `allocateLineRevenue`

**Placeholder scan:** No TBD/TODO/placeholder. All code blocks complete.

**Type consistency:**
- `PnLReportFilters`, `PnLReportResult`, `SalesReportResult` — defined in Task 2/3
- `ProductRevenueRow`, `IngredientCOGSRow` — defined in Task 1
- Reused: `OrderV2`, `OrderLineV2`, `LineForAllocation` from WS-1
- Reused: `allocateLineRevenue` from WS-1
- Reused: `parseLineRecipeSnapshot` from WS-3

**Known gaps deferred to WS-5:**
- V1 → V2 migration script (creates rows in V2 from V1 data using reconciliation rules in spec §7.2)
- Legacy code archival (`reports.ts`, `report-utils.ts`, `pos.ts`, `order-edit.ts`, `orders.ts`)
- V1 sheets rename to `_LEGACY`

**Risks:**
- R1: Pre-migration reports show "no data" — annoying but expected. Banner explains.
- R2: COGS per-product approximation uses `line.cost_at_sale` aggregated by `product_id`. Not split by ingredient within product. Acceptable for V1; can refine in WS-6.
- R3: Reconciliation script depends on V1 still existing. After WS-5 archives V1, script won't have V1 side.

---

## Handoff

**WS-4 is the final core workstream. Reports now show V2 data exclusively. Until WS-5 migration runs, reports show only post-cutover orders.**

**Critical business note for User:**
- After WS-4 ships, P&L and Sales reports will be **EMPTY** for any historical date range.
- This is expected — V2 sheets only have orders from WS-2 forward.
- WS-5 migration will fill V2 with historical V1 data, at which point reports work normally.
- During the gap, the reconciliation script shows what V1 reports vs V2 reports.

**Next plan: WS-5 (Migration + Cutover).** Claude will draft. Will define:
- V1 → V2 migration script following spec §7.2 rules
- Dry-run mode for safety
- Cutover runbook
- Legacy code archival
- Final V1 → V2 reconciliation gate
