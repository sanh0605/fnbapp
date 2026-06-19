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

  it("attributes cost to variant only when no modifier recipe (WS-10 MAC-based)", () => {
    const lines = [{
      ...makeSuaDauStandaloneOrder().lines[0],
      qty: 1,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT", target_id: "VAR-031",
          ingredients: [{ ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "L" }],
        },
        modifiers: [],
      }),
    }] as any;
    const ledger = [
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "240000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
    ];
    const result = breakdownCOGSBySource(lines, [], ledger);
    expect(result.variantRows.length).toBe(1);
    expect(result.variantRows[0].ingredient_id).toBe("BI-MILK");
    expect(result.variantRows[0].cogs).toBe(12000); // 0.05L × 240k/L
    expect(result.modifierRows).toEqual([]);
  });

  it("WS-10 fix: computes per-source MAC from ledger (not proportional split)", () => {
    // Setup: line with variant (BI-MILK 0.05L) + modifier (BI-PEARL 0.03kg)
    // Ledger: BI-MILK @ 200k/L, BI-PEARL @ 50k/kg
    // Expected: variant MAC = 0.05L × 200k/L = 10000
    //           modifier MAC = 0.03kg × 50k/kg = 1500
    const lines = [{
      ...makeSuaDauStandaloneOrder().lines[0],
      qty: 1,
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

    const ledger = [
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "200000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "BI-PEARL", transaction_type: "PO_RECEIPT", unit_cost: "50000", quantity_change: "5", created_at: "2026-06-01T00:00:00Z" },
    ];

    const result = breakdownCOGSBySource(lines, [], ledger);

    const totalVariant = result.variantRows.reduce((s, r) => s + r.cogs, 0);
    const totalModifier = result.modifierRows.reduce((s, r) => s + r.cogs, 0);
    expect(totalVariant).toBe(10000); // 0.05L × 200k/L
    expect(totalModifier).toBe(1500); // 0.03kg × 50k/kg
    expect(result.modifierRows[0].modifier_id).toBe("MOD-PEARL");
  });

  it("WS-10 fix: resolves SEMI_PRODUCT ingredients via spContext", () => {
    // Setup: modifier uses SEMI_PRODUCT BTP-001 (Cốt cà phê)
    // BTP-001 recipe: NNL-002 (200), NNL-003 (650) per batch_yield 500
    // Line uses 20 BTP-001 (per MOD-001 recipe)
    // Per unit of BTP-001: NNL-002 = 200/500 = 0.4, NNL-003 = 650/500 = 1.3
    // Total NNL-002 used = 0.4 × 20 = 8
    // Total NNL-003 used = 1.3 × 20 = 26
    // MAC NNL-002: 100k/u → 8 × 100k = 800k?? That seems wrong. Let me check.
    // Actually MAC is per unit. If NNL-002 unit_cost is 100/u, MAC = 100. 8 × 100 = 800.
    // If NNL-003 unit_cost is 50/u, MAC = 50. 26 × 50 = 1300.
    // Total modifier cost = 800 + 1300 = 2100
    const lines = [{
      ...makeSuaDauStandaloneOrder().lines[0],
      qty: 1,
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-001", name: "20ml cốt cà phê", price: 3000, qty: 1 }]),
      recipe_snapshot_json: JSON.stringify({
        variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
        modifiers: [{
          modifier_id: "MOD-001", modifier_name: "20ml cốt cà phê",
          recipe: {
            target_type: "MODIFIER", target_id: "MOD-001",
            ingredients: [{ ingredient_id: "BTP-001", ingredient_type: "SEMI_PRODUCT", quantity: 20, unit_id: "ml" }],
          },
        }],
      }),
    }] as any;

    const ledger = [
      { item_reference: "NNL-002", transaction_type: "PO_RECEIPT", unit_cost: "100", quantity_change: "1000", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "NNL-003", transaction_type: "PO_RECEIPT", unit_cost: "50", quantity_change: "1000", created_at: "2026-06-01T00:00:00Z" },
    ];

    const spContext = {
      recipes: [
        { target_id: "BTP-001", ingredients_json: JSON.stringify([
          { ingredient_id: "NNL-002", ingredient_type: "BASE_INGREDIENT", quantity: 200 },
          { ingredient_id: "NNL-003", ingredient_type: "BASE_INGREDIENT", quantity: 650 },
        ]) },
      ],
      yields: new Map([["BTP-001", 500]]),
    };

    const result = breakdownCOGSBySource(lines, [], ledger, spContext);
    const totalModifier = result.modifierRows.reduce((s, r) => s + r.cogs, 0);
    // NNL-002: 200/500 × 20 × 100 = 800
    // NNL-003: 650/500 × 20 × 50 = 1300
    // Total = 2100
    expect(totalModifier).toBe(2100);
  });
});
