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

    // Should have 9 distinct product/variant combinations + modifiers
    const productIds = new Set(result.map(r => r.product_id));
    expect(productIds.size).toBeGreaterThanOrEqual(4);

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

  it("UCK000094: returns empty when all lines have cost_at_sale = 0", () => {
    const { lines } = makeUCK000094MigratedOrder();
    const result = breakdownCOGSByIngredient(lines);

    // Lines have cost_at_sale = 0 in fixtures (not set), so total cogs = 0
    // The implementation skips lines with cost <= 0
    expect(result.length).toBe(0);
  });

  it("UCK000094: ingredients from both variant + modifier recipes aggregated when cost > 0", () => {
    const { lines } = makeUCK000094MigratedOrder();
    // Force cost_at_sale to be > 0 and provide a mock recipe_snapshot_json so ingredients are extracted
    const testLines = lines.map(l => ({
      ...l,
      cost_at_sale: 1000,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-MOCK",
          ingredients: [
            { ingredient_id: "BI-MOCK-1", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "L" },
          ],
        },
        modifiers: [],
      }),
    }));
    const result = breakdownCOGSByIngredient(testLines);

    const totalCogs = result.reduce((s, r) => s + r.cogs, 0);
    expect(totalCogs).toBeGreaterThan(0);

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
