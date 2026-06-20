# WS-7 Report Accuracy Fix Implementation Plan

> **For Antigravity (implementer):** Fix workstream after WS-6 выявил bugs in PnL report. Cadence: batch execution. Lower risk than WS-5 (V2 already has backups; we're improving data quality, not migrating from scratch).

**Goal:** Fix 3 bugs surfaced post-WS-6:
1. **Drink revenue wrong** (Cà phê đá shows 7.435đ/cup instead of 15k-18k). Root cause: migration heuristic trusted V1 buggy `total_amount` instead of V1 mathematically-correct values.
2. **Topping COGS = 0**. Root cause: PnL report hardcodes `cogs: 0` for topping rows + V1 `unit_cost = 0` for many ledger entries propagated to migration.
3. **Phantom `manual_order_discount`** created from V1 bugs (360k of fake order-level discount on Cà phê đá orders alone).

**Architecture:**
- **Migration heuristic v2 (corrected):** Use V1 intended math, not stored total_amount:
  - `gross_total` = V1 subtotal (legacy field was the gross)
  - `promo_discount_total` = sum(V1 line.line_discount) — the promo portion
  - `manual_item_discount_total` = sum(max(V1 line.line_manual_discount, line.discount_amount)) — avoid double-count
  - `manual_order_discount` = V1 discount_amount (the original order-level field, not solved residual)
  - `net_total` = gross − promo − manual_item − manual_order (computed; do NOT trust V1 total_amount)
- **MAC recompute at migration time:** For each line, compute `cost_at_sale` via `computeLineCostAtSale` (WS-2 helper) using V1 PO_RECEIPT history. Bypasses V1 `unit_cost = 0` legacy data quality issue.
- **Topping COGS in PnL:** Extend `breakdownCOGSByIngredient` (or add new helper) to split by source — variant-recipe ingredients vs modifier-recipe ingredients. PnL topping rows get sum of modifier-source cogs.
- **Re-migrate strategy:** Reset only migrated V2 rows (filter by `pos_snapshot_json.v1_id` present), keep new live orders placed after WS-5 migration (e.g., PHD000568). Re-run migration with corrected heuristics.

**Tech Stack:** Same as WS-5. No new deps.

**Parent spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md` — section 7.2 needs amendment: net_total is now COMPUTED, not taken from V1 stored total_amount.

**Dependencies:** WS-1 through WS-6 merged. V1 backups in place (`Orders_BACKUP_PRE_WS5_2026-06-19` etc.).

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `lib/migrate-v1-to-v2-v2.ts` | Corrected `reconstructOrderV2` using intended-math heuristic. Keeps old function name but exports as `reconstructOrderV2_Corrected` to avoid breaking imports. |
| `lib/migrate-v1-to-v2-v2.test.ts` | Tests with golden cases: UCK000094, Cà phê đá pattern, combo cases |
| `lib/report-v2-allocators-v2.ts` | `breakdownCOGSBySource(lines)` — split COGS by variant vs modifier source |
| `scripts/reset-migrated-v2-orders.ts` | Selective reset: delete only V2 rows with `pos_snapshot_json.v1_id` (migrated). Keep live new orders. |
| `scripts/re-migrate-v1-to-v2.ts` | Wrapper: reset migrated → re-migrate with corrected helpers |
| `scripts/verify-pnl-patterns.ts` | Verification: drink revenue ends in 5k/0k for promo items, topping COGS > 0 |

### Files to modify

| Path | Change |
|---|---|
| `lib/migrate-v1-to-v2.ts` | Replace `reconstructOrderV2` with corrected version. Keep `classifyV1Discounts` for diagnostics. |
| `lib/report-v2-allocators.ts` | Add `breakdownCOGSBySource`. Keep `breakdownCOGSByIngredient` for backward compat. |
| `app/actions/reports-v2.ts` | In `getPnLDataV2`, replace hardcoded `cogs: 0` for toppings with sum from `breakdownCOGSBySource` modifier portion. |
| `scripts/migrate-orders-to-v2.ts` | Use corrected helpers + recompute cost_at_sale via `computeLineCostAtSale`. |

### Files NOT touched

- `lib/order-math.ts`, `lib/order-types.ts`, `lib/order-cogs.ts` — WS-1/2/3 foundation is correct
- `lib/order-cart.ts`, `lib/order-edit-cart.ts` — write paths unaffected (only migration + report read affected)
- `lib/sheets-db-v2.ts`, `lib/sheets-db-v2-edit.ts` — write helpers correct

---

## Task 1: Corrected migration helpers

**Files:**
- Modify: `lib/migrate-v1-to-v2.ts`

Replace `reconstructOrderV2` with version that uses V1 intended math instead of stored total_amount.

- [ ] **Step 1: Update `reconstructOrderV2` in `lib/migrate-v1-to-v2.ts`**

Find the existing `reconstructOrderV2` function. Replace its money-computation section (after building V2 lines) with:

```typescript
  // ----- Compute totals from V1 intended math -----
  // CRITICAL FIX (WS-7): do NOT trust V1 total_amount — it had bugs.
  // Use intended math: subtotal - sum(discounts).

  const grossTotal = v2Lines.reduce((s, l) => s + l.gross_line_total, 0);
  const promoTotal = v2Lines.reduce((s, l) => s + l.promo_discount, 0);
  const manualItemTotal = v2Lines.reduce((s, l) => s + l.manual_item_discount, 0);

  // manual_order_discount comes from V1 discount_amount directly
  // (NOT solved as residual — residual approach created phantom discounts
  // when V1 total_amount had bugs).
  const manualOrderDiscount = Math.max(0, Math.round(Number(v1Order.discount_amount || 0)));

  // Computed net — this is the mathematically correct value
  const computedNetTotal = grossTotal - promoTotal - manualItemTotal - manualOrderDiscount;

  // Sanity check: compare to V1 stored total_amount
  const v1StoredTotal = Number(v1Order.total_amount || 0);
  const storedVsComputed = computedNetTotal - v1StoredTotal;
  if (Math.abs(storedVsComputed) > 1) {
    heuristicNotes.push(
      `V1 stored total_amount (${v1StoredTotal}) differs from computed (${computedNetTotal}) by ${storedVsComputed}đ. ` +
      `Using computed value (V1 total_amount had known bugs in some orders).`
    );
  }

  const netTotal = computedNetTotal;
```

Keep the rest of the function (status mapping, line building, event creation, invariant check) unchanged.

Update the classification block at end of function:
```typescript
    classification: {
      gross_total: grossTotal,
      promo_discount_total: promoTotal,
      manual_item_discount_total: manualItemTotal,
      manual_order_discount: manualOrderDiscount,
      net_total: netTotal,
      residual: storedVsComputed, // now means "stored - computed" drift, NOT solved residual
      heuristic_notes: heuristicNotes,
    },
```

- [ ] **Step 2: Update existing tests to reflect new heuristic**

In `lib/migrate-v1-to-v2.test.ts`, find the test "UCK000094 pattern: 5k discrepancy absorbed as manual_order_discount". Replace with:

```typescript
it("UCK000094 pattern: V1 total_amount bug ignored, computed net used instead", () => {
  const v1: V1Order = {
    id: "ORD-uck", order_no: "UCK000094", brand_id: "BR-002", status: "COMPLETED",
    total_amount: "156000", // LEGACY BUG: should be 161000
    subtotal: "266000",     // V1 subtotal is correct
    discount_amount: "0",   // No order-level discount
    discount_type: "VND",
    applied_promotion_id: "PRM-003",
    applied_promotion_snapshot_json: "",
    method: "Chuyen khoan", staff_name: "tuyen2612", created_at: "2026-06-12T12:21:26Z",
  };
  const lines: V1Line[] = [{
    id: "OL-uck-sua-dau", order_id: "ORD-uck",
    product_id: "PROD-024", variant_id: "VAR-031",
    qty: "1", unit_price: "35000", line_discount: "10000",
    discount_type: "VND", modifiers_json: "[]", created_at: "2026-06-12T12:21:26Z",
  }];
  const result = reconstructOrderV2(v1, lines, [], REF);

  // WS-7 fix: use V1 intended math, NOT stored total_amount
  expect(result.order.gross_total).toBe(35000);
  expect(result.order.promo_discount_total).toBe(10000);
  expect(result.order.manual_item_discount_total).toBe(0);
  expect(result.order.manual_order_discount).toBe(0); // V1 discount_amount = 0
  expect(result.order.net_total).toBe(25000); // computed: 35-10-0-0 = 25k
  // Note: NOT 156000 (V1 buggy value) or 161000 (user's earlier "correct" guess for full order)
  expect(result.classification.residual).toBe(-131000); // stored - computed
  expect(result.classification.heuristic_notes.length).toBeGreaterThan(0);
  expect(result.invariantPassed).toBe(true);
});

it("manual_order_discount from V1 discount_amount (not solved residual)", () => {
  // Order: gross 100k, V1 says order discount 20k → manual_order = 20k
  const v1: V1Order = {
    id: "ORD-disc", order_no: "DISC001", brand_id: "BR-002", status: "COMPLETED",
    total_amount: "80000", // gross 100 - discount 20 = 80 (V1 total correct here)
    subtotal: "100000",
    discount_amount: "20000",
    discount_type: "VND",
    applied_promotion_id: "", applied_promotion_snapshot_json: "",
    method: "Tien mat", staff_name: "Test", created_at: "2026-06-12T00:00:00Z",
  };
  const lines: V1Line[] = [{
    id: "OL-disc", order_id: "ORD-disc",
    product_id: "PROD-024", variant_id: "VAR-031",
    qty: "2", unit_price: "35000", line_discount: "30000", // 70k gross, 30k line discount
    discount_type: "VND", modifiers_json: "[]", created_at: "2026-06-12T00:00:00Z",
  }];
  // gross = 70k, line_discount = 30k, manual_order = 20k
  // net = 70 - 30 - 0 - 20 = 20k
  const result = reconstructOrderV2(v1, lines, [], REF);
  expect(result.order.manual_order_discount).toBe(20000);
  expect(result.order.net_total).toBe(20000);
});
```

- [ ] **Step 3: Run tests**

Run: `rtk npm test -- migrate-v1-to-v2.test.ts`
Expected: All tests pass with new heuristic.

- [ ] **Step 4: Commit**

```bash
rtk git add lib/migrate-v1-to-v2.ts lib/migrate-v1-to-v2.test.ts
rtk git commit -m "fix(orders-v2): use V1 intended math, not stored total_amount

WS-7 step 1: corrects migration heuristic that trusted V1 total_amount.
V1 had known bugs (UCK000094 5k discrepancy, others). Now uses:
- manual_order_discount = V1 discount_amount (direct)
- net_total = computed (gross - promo - manual_item - manual_order)
- Stored vs computed drift documented in heuristic_notes

Eliminates phantom 360k manual_order_discount on Cà phê đá orders.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: MAC recompute during migration

**Files:**
- Modify: `scripts/migrate-orders-to-v2.ts`

After building V2 lines, recompute `cost_at_sale` via `computeLineCostAtSale` using V1 PO_RECEIPT history. Replaces the order-level proportional distribution that propagated V1's `unit_cost = 0` data quality issue.

- [ ] **Step 1: Update `scripts/migrate-orders-to-v2.ts`**

In the order-processing loop (around line 180-200), find the existing cost computation block:
```typescript
// Compute per-line cost_at_sale (distribute order ledger cost by line gross proportion)
const orderLedger = v1Ledger.filter((l: any) =>
  l.reference_id === v1Order.id && l.transaction_type === "SALES_CONSUME",
);
const orderLedgerCost = orderLedger.reduce((s: number, e: any) =>
  s + (Number(e.unit_cost) || 0) * Math.abs(Number(e.quantity_change) || 0), 0);
const totalGross = result.lines.reduce((s: number, l: any) => s + l.gross_line_total, 0);
for (const line of result.lines) {
  line.cost_at_sale = totalGross > 0
    ? Math.round(orderLedgerCost * (line.gross_line_total / totalGross))
    : 0;
}
```

Replace with:

```typescript
// WS-7 fix: recompute cost_at_sale via MAC from PO_RECEIPT history.
// V1 Stock_Ledger had unit_cost = 0 for many entries (data quality issue),
// so we cannot trust V1's stored unit_cost. Instead, recompute MAC for each
// line using its recipe snapshot and historical PO_RECEIPT entries.
const { computeLineCostAtSale } = require("../lib/order-cogs");
const { parseLineRecipeSnapshot } = require("../lib/order-types");

for (const line of result.lines) {
  const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
  line.cost_at_sale = computeLineCostAtSale(lineRecipe, v1Ledger, Number(line.qty), v1Order.created_at);
}
```

Add necessary imports at top of file:
```typescript
const { computeLineCostAtSale } = require("../lib/order-cogs");
const { parseLineRecipeSnapshot } = require("../lib/order-types");
```

- [ ] **Step 2: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep migrate-orders`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/migrate-orders-to-v2.ts
rtk git commit -m "fix(orders-v2): recompute MAC cost during migration

WS-7 step 2: replaces order-level proportional cost distribution
(which inherited V1 unit_cost=0 data quality issue) with per-line MAC
computation via computeLineCostAtSale. Uses historical PO_RECEIPT
entries, not V1 stored unit_cost.

Toppings with recipes will now get proper cost attribution.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Topping COGS breakdown in PnL

**Files:**
- Modify: `lib/report-v2-allocators.ts`
- Modify: `lib/report-v2-allocators.test.ts`
- Modify: `app/actions/reports-v2.ts`

Add `breakdownCOGSBySource` that distinguishes variant-source ingredients from modifier-source ingredients. PnL report uses modifier-source COGS for topping rows.

- [ ] **Step 1: Add `breakdownCOGSBySource` to `lib/report-v2-allocators.ts`**

Append:

```typescript
export interface ModifierCOGSRow {
  modifier_id: string;
  modifier_name: string;
  cogs: number;
  qty_consumed: number;
}

/**
 * Break down COGS by source: variant recipe ingredients vs modifier recipe ingredients.
 * Used by PnL report to attribute COGS to toppings (modifiers), not just drinks (variants).
 *
 * Sum of all `cogs` across both arrays = sum of line.cost_at_sale.
 */
export function breakdownCOGSBySource(
  lines: OrderLineV2[],
): { variantRows: IngredientCOGSRow[]; modifierRows: ModifierCOGSRow[] } {
  const variantMap = new Map<string, { cogs: number; qty: number }>();
  const modifierMap = new Map<string, { cogs: number; qty: number; name: string }>();

  for (const line of lines) {
    if (line.cost_at_sale <= 0) continue;
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);

    // Compute total ingredient qty for this line (variant + modifiers)
    const variantQty = lineRecipe.variant.ingredients.reduce((s, i) => s + i.quantity * line.qty, 0);
    const modifierQty = lineRecipe.modifiers.reduce((s, m) =>
      s + m.recipe.ingredients.reduce((ms, i) => ms + i.quantity * line.qty, 0), 0);
    const totalQty = variantQty + modifierQty;
    if (totalQty <= 0) continue;

    // Allocate line.cost_at_sale proportionally
    const variantShare = variantQty / totalQty;
    const modifierShare = modifierQty / totalQty;
    const variantCogs = Math.round(line.cost_at_sale * variantShare);
    const modifierCogs = Math.round(line.cost_at_sale * modifierShare);

    // Variant ingredient-level breakdown (for ingredient PnL section)
    for (const ing of lineRecipe.variant.ingredients) {
      const ingQty = ing.quantity * line.qty;
      const ingShare = variantQty > 0 ? ingQty / variantQty : 0;
      if (!variantMap.has(ing.ingredient_id)) {
        variantMap.set(ing.ingredient_id, { cogs: 0, qty: 0 });
      }
      const row = variantMap.get(ing.ingredient_id)!;
      row.cogs += Math.round(variantCogs * ingShare);
      row.qty += ingQty;
    }

    // Modifier-level breakdown (for topping PnL section)
    for (const modEntry of lineRecipe.modifiers) {
      if (!modifierMap.has(modEntry.modifier_id)) {
        modifierMap.set(modEntry.modifier_id, {
          cogs: 0, qty: 0, name: modEntry.modifier_name,
        });
      }
      const modRow = modifierMap.get(modEntry.modifier_id)!;
      const modIngQty = modEntry.recipe.ingredients.reduce((s, i) => s + i.quantity * line.qty, 0);
      const modShare = modifierQty > 0 ? modIngQty / modifierQty : 0;
      modRow.cogs += Math.round(modifierCogs * modShare);
      modRow.qty += line.qty * Number(
        JSON.parse(line.modifiers_snapshot_json || "[]").find((m: any) => m.id === modEntry.modifier_id)?.qty || 1
      );
    }
  }

  return {
    variantRows: Array.from(variantMap.entries()).map(([id, v]) => ({
      ingredient_id: id, cogs: v.cogs, qty_consumed: v.qty,
    })),
    modifierRows: Array.from(modifierMap.entries()).map(([id, m]) => ({
      modifier_id: id, modifier_name: m.name, cogs: m.cogs, qty_consumed: m.qty,
    })),
  };
}
```

Add necessary import at top:
```typescript
import { parseLineRecipeSnapshot } from "@/lib/order-types";
```

- [ ] **Step 2: Add tests for `breakdownCOGSBySource`**

Append to `lib/report-v2-allocators.test.ts`:

```typescript
import { breakdownCOGSBySource } from "@/lib/report-v2-allocators";

describe("breakdownCOGSBySource", () => {
  it("returns empty for empty input", () => {
    const result = breakdownCOGSBySource([]);
    expect(result.variantRows).toEqual([]);
    expect(result.modifierRows).toEqual([]);
  });

  it("attributes cost to variant only when no modifier recipe", () => {
    const lines = [{
      ...makeSuaDauStandaloneOrder().lines[0],
      cost_at_sale: 12000,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT", target_id: "VAR-031",
          ingredients: [{ ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "L" }],
        },
        modifiers: [],
      }),
    }] as any;
    const result = breakdownCOGSBySource(lines);
    expect(result.variantRows.length).toBe(1);
    expect(result.variantRows[0].ingredient_id).toBe("BI-MILK");
    expect(result.variantRows[0].cogs).toBe(12000);
    expect(result.modifierRows).toEqual([]);
  });

  it("splits cost between variant and modifier when both have ingredients", () => {
    const lines = [{
      ...makeSuaDauStandaloneOrder().lines[0],
      cost_at_sale: 10000,
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-PEARL", name: "Trân châu", price: 5000, qty: 1 }]),
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT", target_id: "VAR-031",
          ingredients: [{ ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "L" }],
        },
        modifiers: [{
          modifier_id: "MOD-PEARL", modifier_name: "Trân châu",
          recipe: {
            target_type: "MODIFIER", target_id: "MOD-PEARL",
            ingredients: [{ ingredient_id: "BI-PEARL", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "KG" }],
          },
        }],
      }),
    }] as any;
    const result = breakdownCOGSBySource(lines);
    // variant: 0.05L, modifier: 0.03kg → 50/50 split (by quantity)
    // cost_at_sale 10k split: variant 5k, modifier 5k
    const totalVariant = result.variantRows.reduce((s, r) => s + r.cogs, 0);
    const totalModifier = result.modifierRows.reduce((s, r) => s + r.cogs, 0);
    expect(totalVariant + totalModifier).toBe(10000);
    expect(result.modifierRows.length).toBe(1);
    expect(result.modifierRows[0].modifier_id).toBe("MOD-PEARL");
    expect(result.modifierRows[0].cogs).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Update `getPnLDataV2` to use `breakdownCOGSBySource` for topping COGS**

In `app/actions/reports-v2.ts`, find the topping rows section:
```typescript
const toppingRows = productRows
  .filter(r => r.product_id.startsWith("MOD:"))
  .map(r => ({
    // ...
    cogs: 0, // modifier COGS not separately tracked at line level
    // ...
  }));
```

Replace with:
```typescript
// WS-7 fix: compute topping COGS from modifier-source ingredients
const cogsBySource = breakdownCOGSBySource(typedLines);
const toppingCogsById = new Map(
  cogsBySource.modifierRows.map(r => [r.modifier_id, r.cogs]),
);

const toppingRows = productRows
  .filter(r => r.product_id.startsWith("MOD:"))
  .map(r => {
    const modifierId = r.product_id.replace("MOD:", "");
    const cogs = toppingCogsById.get(modifierId) || 0;
    const grossProfit = r.revenue - cogs;
    const marginPct = r.revenue > 0 ? (grossProfit / r.revenue) * 100 : 0;
    return {
      product_id: r.product_id,
      product_name: r.product_name,
      variant_id: "",
      size_name: "",
      qty: r.qty,
      revenue: r.revenue,
      cogs,
      grossProfit,
      marginPct,
    };
  });
```

Add import:
```typescript
import { breakdownCOGSBySource } from "@/lib/report-v2-allocators";
```

- [ ] **Step 4: Run tests**

Run: `rtk npm test`
Expected: All tests pass (existing + new breakdownCOGSBySource tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/report-v2-allocators.ts lib/report-v2-allocators.test.ts app/actions/reports-v2.ts
rtk git commit -m "fix(orders-v2): topping COGS from modifier recipe ingredients

WS-7 step 3: replaces hardcoded cogs:0 for toppings with proper
attribution via breakdownCOGSBySource. Splits each line.cost_at_sale
between variant recipe (drink COGS) and modifier recipes (topping COGS)
proportional to ingredient quantities. PnL topping rows now show
realistic COGS + margins.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Selective reset + re-migration scripts

**Files:**
- Create: `scripts/reset-migrated-v2-orders.ts`
- Create: `scripts/re-migrate-v1-to-v2.ts`

Selective reset deletes only migrated rows (keeps live new orders). Re-migration wraps reset + corrected migration.

- [ ] **Step 1: Create `scripts/reset-migrated-v2-orders.ts`**

```typescript
/**
 * Selective V2 reset: delete only orders migrated from V1 (those with
 * pos_snapshot_json.v1_id set). Keep live V2 orders placed after WS-5.
 *
 * Run: npx tsx scripts/reset-migrated-v2-orders.ts --live
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache, removeMany } = require("../lib/sheets_db");

async function main() {
  const isLive = process.argv.includes("--live");

  console.log(`\n=== Selective V2 Reset (${isLive ? "LIVE" : "DRY-RUN"}) ===\n`);

  const [orders, lines, events, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Order_Events"),
    findAllNoCache("Stock_Ledger"),
  ]);

  // Find migrated orders (have v1_id in pos_snapshot_json)
  const migratedOrders = (orders as any[]).filter(o => {
    try {
      const snap = JSON.parse(o.pos_snapshot_json || "{}");
      return !!snap.v1_id;
    } catch { return false; }
  });

  const liveOrders = (orders as any[]).filter(o => !migratedOrders.includes(o));
  console.log(`Total V2 orders: ${orders.length}`);
  console.log(`  Migrated (will delete): ${migratedOrders.length}`);
  console.log(`  Live (will keep):       ${liveOrders.length}`);

  if (migratedOrders.length === 0) {
    console.log("\nNothing to reset.");
    return;
  }

  const migratedOrderIds = new Set(migratedOrders.map(o => o.id));
  const migratedLines = (lines as any[]).filter(l => migratedOrderIds.has(l.order_id));
  const migratedEvents = (events as any[]).filter(e => migratedOrderIds.has(e.order_id));
  const migratedEventIds = new Set(migratedEvents.map(e => e.id));
  const migratedLedger = (ledger as any[]).filter(l =>
    migratedOrderIds.has(l.reference_id) || migratedEventIds.has(l.order_event_id),
  );

  console.log(`\nRows to delete:`);
  console.log(`  Orders_V2:     ${migratedOrders.length}`);
  console.log(`  Order_Lines_V2: ${migratedLines.length}`);
  console.log(`  Order_Events:   ${migratedEvents.length}`);
  console.log(`  Stock_Ledger:   ${migratedLedger.length}`);

  if (!isLive) {
    console.log("\nDry-run complete. Use --live to delete.");
    return;
  }

  if (migratedLedger.length > 0) {
    await removeMany("Stock_Ledger", migratedLedger.map(l => l.id));
    console.log(`  Deleted ${migratedLedger.length} ledger rows`);
  }
  if (migratedEvents.length > 0) {
    await removeMany("Order_Events", migratedEvents.map(e => e.id));
    console.log(`  Deleted ${migratedEvents.length} event rows`);
  }
  if (migratedLines.length > 0) {
    await removeMany("Order_Lines_V2", migratedLines.map(l => l.id));
    console.log(`  Deleted ${migratedLines.length} line rows`);
  }
  await removeMany("Orders_V2", migratedOrders.map(o => o.id));
  console.log(`  Deleted ${migratedOrders.length} order rows`);

  console.log(`\nReset complete. Live V2 orders preserved.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
```

- [ ] **Step 2: Create `scripts/re-migrate-v1-to-v2.ts`**

```typescript
/**
 * Re-migration wrapper: reset migrated V2 orders → re-migrate with WS-7 corrected helpers.
 *
 * Run: npx tsx scripts/re-migrate-v1-to-v2.ts --live
 *
 * Pre-conditions:
 *   - WS-7 Tasks 1-3 merged (corrected helpers + MAC recompute + topping COGS)
 *   - V1 backups still in place (Orders_BACKUP_PRE_WS5_2026-06-19 etc.)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { execSync } = require("child_process");

async function main() {
  const isLive = process.argv.includes("--live");
  if (!isLive) {
    console.log("DRY-RUN mode. This script only supports --live (reset + migrate).");
    console.log("To preview reset: npx tsx scripts/reset-migrated-v2-orders.ts");
    console.log("To preview migration: npx tsx scripts/migrate-orders-to-v2.ts --dry-run");
    return;
  }

  console.log("\n=== WS-7 Re-Migration (LIVE) ===\n");

  console.log("Step 1: Selective reset of migrated V2 orders...");
  execSync("npx tsx scripts/reset-migrated-v2-orders.ts --live", { stdio: "inherit" });

  console.log("\nStep 2: Re-migrate with corrected helpers...");
  execSync("npx tsx scripts/migrate-orders-to-v2.ts --live", { stdio: "inherit" });

  console.log("\n=== Re-migration complete ===");
  console.log("Next: run scripts/verify-pnl-patterns.ts to verify fixes.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
```

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/reset-migrated-v2-orders.ts scripts/re-migrate-v1-to-v2.ts
rtk git commit -m "feat(orders-v2): WS-7 selective reset + re-migration scripts

WS-7 step 4:
- reset-migrated-v2-orders.ts: deletes only V2 orders with v1_id set
  (migrated from V1). Preserves live V2 orders placed after WS-5.
- re-migrate-v1-to-v2.ts: wrapper that runs reset → migrate in sequence
  with WS-7 corrected helpers.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: PnL pattern verification script

**Files:**
- Create: `scripts/verify-pnl-patterns.ts**

Verifies the 3 bug fixes via pattern checks (drink revenue ending in 5k/0k, topping COGS > 0).

- [ ] **Step 1: Create `scripts/verify-pnl-patterns.ts`**

```typescript
/**
 * Verify WS-7 bug fixes via pattern checks.
 *
 * Run: npx tsx scripts/verify-pnl-patterns.ts
 *
 * Expected after WS-7:
 *   1. Cà phê đá revenue per cup ends in 5k or 0k (15k or 18k price)
 *   2. Trà sữa truyền thống revenue per cup ends in 5k or 0k
 *   3. Yogurt việt quất revenue per cup ends in 5k or 0k
 *   4. Topping COGS > 0 for at least some toppings
 *   5. No order has manual_order_discount > 30% of gross (suspicious)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { getPnLDataV2 } = require("../app/actions/reports-v2");

async function main() {
  console.log("\n=== WS-7 PnL Pattern Verification ===\n");

  const pnl = await getPnLDataV2({
    startDate: "2026-06-01T00:00:00+07:00",
    endDate: "2026-06-19T23:59:59+07:00",
  });

  console.log(`Orders: ${pnl.orderCount}, Revenue: ${pnl.totalRevenue}đ, COGS: ${pnl.totalCOGS}đ\n`);

  let allPassed = true;

  // Check 1: drink revenue per cup should end in 5k or 0k (15k/18k/25k prices)
  console.log("--- Drink revenue per-cup check ---");
  const drinkRows = pnl.productProfitAnalysis.filter(p => !p.product_id.startsWith("MOD:"));
  for (const row of drinkRows.slice(0, 10)) {
    if (row.qty === 0) continue;
    const perCup = row.revenue / row.qty;
    const last3Digits = Math.round(perCup) % 1000;
    const endsIn5kOr0k = last3Digits === 0 || last3Digits === 500;
    const status = endsIn5kOr0k ? "✓" : "✗";
    if (!endsIn5kOr0k) allPassed = false;
    console.log(`  ${status} ${row.product_name}: ${Math.round(perCup)}đ/cup (qty ${row.qty})`);
  }

  // Check 2: Topping COGS > 0
  console.log("\n--- Topping COGS check ---");
  const toppingRows = pnl.productProfitAnalysis.filter(p => p.product_id.startsWith("MOD:"));
  for (const row of toppingRows) {
    const hasCogs = row.cogs > 0;
    const status = hasCogs ? "✓" : "✗";
    if (!hasCogs) allPassed = false;
    console.log(`  ${status} ${row.product_name}: revenue ${row.revenue}, cogs ${row.cogs}, margin ${row.marginPct.toFixed(1)}%`);
  }

  // Check 3: No order has suspiciously large manual_order_discount
  console.log("\n--- Suspicious manual_order_discount check ---");
  const orders = await findAllNoCache("Orders_V2");
  const filteredOrders = orders.filter((o: any) =>
    o.status === "COMPLETED" && !o.superseded_by && o.created_at,
  );
  const suspicious = filteredOrders.filter((o: any) => {
    const gross = Number(o.gross_total || 0);
    const orderDiscount = Number(o.manual_order_discount || 0);
    return gross > 0 && orderDiscount / gross > 0.30;
  });
  if (suspicious.length > 0) {
    console.log(`  ✗ Found ${suspicious.length} orders with manual_order_discount > 30% of gross (suspicious)`);
    suspicious.slice(0, 5).forEach((o: any) => {
      const ratio = ((Number(o.manual_order_discount) / Number(o.gross_total)) * 100).toFixed(1);
      console.log(`    ${o.order_no}: gross ${o.gross_total}, manual_order ${o.manual_order_discount} (${ratio}%)`);
    });
    allPassed = false;
  } else {
    console.log(`  ✓ No orders with manual_order_discount > 30% of gross`);
  }

  console.log(`\n=== ${allPassed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"} ===`);
  if (!allPassed) process.exit(1);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
```

- [ ] **Step 2: Commit**

```bash
rtk git add scripts/verify-pnl-patterns.ts
rtk git commit -m "test(orders-v2): WS-7 PnL pattern verification script

WS-7 step 5: verifies the 3 bug fixes via business-rule patterns:
- Drink revenue per cup ends in 5k/0k (15k promo, 18k regular, 25k Sữa Dâu)
- Topping COGS > 0 (was hardcoded 0 in WS-4)
- No order has manual_order_discount > 30% of gross (catches phantom
  discounts from old migration heuristic)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Execute re-migration (User-authorized)

**Operator step** — Claude executes after User confirms WS-7 Tasks 1-5 merged.

- [ ] **Step 1: Confirm pre-conditions**

- WS-7 Tasks 1-5 merged
- V1 backups still exist (`Orders_BACKUP_PRE_WS5_2026-06-19` etc.) — verify
- User has signed off (no production traffic for 5 min)

- [ ] **Step 2: Dry-run reset**

Run: `npx tsx scripts/reset-migrated-v2-orders.ts`
Expected: Reports counts of migrated vs live orders. No changes made.

- [ ] **Step 3: Dry-run migration**

Run: `npx tsx scripts/migrate-orders-to-v2.ts --dry-run`
Expected: Processes 751 orders, 0 invariant failures, 0 errors.

- [ ] **Step 4: Live re-migration**

Run: `npx tsx scripts/re-migrate-v1-to-v2.ts --live`
Expected: Reset completes, then re-migration writes 751 orders with corrected heuristics + MAC cost.

- [ ] **Step 5: Verify**

Run: `npx tsx scripts/verify-pnl-patterns.ts`
Expected: ALL CHECKS PASSED.

Run: `npx tsx scripts/test-pnl-v2.ts`
Expected: PnL PASSED with cleaner numbers.

- [ ] **Step 6: Document in tracking**

No code commit for this task — operational execution only. Add note to DEVELOPMENT-TRACKING.md:

```markdown
## 2026-06-19 — WS-7 Re-Migration Executed

- Operator: Claude (User-authorized)
- Selective reset: 751 migrated V2 orders deleted, 1 live order (PHD000568) preserved
- Re-migration: 751 orders re-migrated with corrected heuristics (intended math) + MAC recompute
- Pattern verification: ALL CHECKS PASSED
  - Drink revenue per cup ends in 5k/0k
  - Topping COGS > 0
  - No phantom manual_order_discount > 30%
```

---

## Task 7: Final verification + tracking update

- [ ] **Step 1: Run full test suite**

Run: `rtk npm test`
Expected: All tests pass. Count: 107 + new WS-7 tests (~5) = ~112.

- [ ] **Step 2: TypeScript check**

Run: `rtk tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Coverage**

Run: `rtk npm run test:coverage`
Expected: maintain ≥95% on tracked files.

- [ ] **Step 4: Browser smoke test**

In browser:
- `/admin/reports/pnl` — verify Cà phê đá shows ~15k-18k/cup, not 7k
- `/admin/reports/pnl` — verify topping rows show COGS > 0 and margin < 100%
- `/admin/reports/sales` — verify best sellers show realistic numbers
- `/admin` dashboard — verify trend badges show reasonable percentages

- [ ] **Step 5: Update DEVELOPMENT-TRACKING.md**

Append WS-7 section with:
- Root cause analysis of 3 bugs
- Files created/modified
- Verification gate results
- Commits table (use actual hashes)
- Final state: V2 reports now accurate

- [ ] **Step 6: Final commit**

```bash
rtk git add DEVELOPMENT-TRACKING.md
rtk git commit -m "docs(tracking): WS-7 report accuracy fix complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review

**Bug coverage check:**
- ✓ Bug 1 (drink revenue wrong) → Task 1 (corrected heuristic) + Task 6 (re-migrate)
- ✓ Bug 2 (topping COGS = 0) → Task 2 (MAC recompute) + Task 3 (breakdownCOGSBySource)
- ✓ Bug 3 (phantom manual_order_discount) → Task 1 (use V1 discount_amount directly)
- ✓ Verification via patterns → Task 5
- ✓ User-authorized re-migration → Task 6

**Placeholder scan:** No placeholders. Code blocks complete.

**Type consistency:**
- `ModifierCOGSRow` — new type in Task 3
- Reuses: `parseLineRecipeSnapshot` (WS-3), `computeLineCostAtSale` (WS-2)
- Reuses: `OrderLineV2` (WS-1)

**Known risks:**
- R1: Re-migration touches production data again → mitigated by V1 backups + selective reset (keeps live orders)
- R2: New heuristic might compute different net_total than V1 stored (for orders where V1 was actually correct) → acceptable; computed value is mathematically consistent
- R3: MAC recompute uses V1 PO_RECEIPT data which may have its own quality issues → if PO_RECEIPT missing, cost_at_sale falls back to 0 (acceptable, same as before)

---

## Handoff

**WS-7 fixes the bugs WS-6 surfaced. After Task 7, V2 reports should be financially accurate:**
- Drink revenue per cup ends in 5k/0k (matches 15k promo / 18k regular / 25k Sữa Dâu)
- Topping COGS > 0 (real attribution from modifier recipes)
- No phantom manual_order_discount > 30% of gross

**Operational note:** Tasks 1-5 are safe to merge anytime. Task 6 (re-migration) requires User sign-off + brief traffic pause. Task 7 verifies.

**This concludes the V2 rebuild.** After WS-7, the system is production-accurate for financial reporting. No further workstreams planned unless new bugs surface.
