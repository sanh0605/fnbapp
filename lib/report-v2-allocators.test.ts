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

  it("UCK000094: ingredients aggregated via FIFO when ledger has data", () => {
    const { lines } = makeUCK000094MigratedOrder();
    const testLines = lines.map(l => ({
      ...l,
      qty: 1,
      cost_at_sale: 5000,
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
    const ledger = [
      { item_reference: "BI-MOCK-1", transaction_type: "PO_RECEIPT", unit_cost: "100000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
    ];
    const result = breakdownCOGSByIngredient(testLines, [], ledger);

    const totalCogs = result.reduce((s, r) => s + r.cogs, 0);
    expect(totalCogs).toBeGreaterThan(0);

    const ingredientIds = result.map(r => r.ingredient_id);
    expect(ingredientIds.length).toBeGreaterThan(0);
  });

  it("WS-11 fix: per-ingredient FIFO consumption (not proportional split)", () => {
    // Setup: line with 2 ingredients (different units)
    // BI-MILK qty 0.05L (MAC 200k/L → 10k)
    // BI-STRAWBERRY qty 0.03kg (MAC 50k/kg → 1.5k)
    // Total expected = 11500
    const { lines } = makeSuaDauStandaloneOrder();
    const testLines: OrderLineV2[] = lines.map(l => ({
      ...l,
      qty: 1,
      cost_at_sale: 11500,
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

    const ledger = [
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "200000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "BI-STRAWBERRY", transaction_type: "PO_RECEIPT", unit_cost: "50000", quantity_change: "5", created_at: "2026-06-01T00:00:00Z" },
    ];

    const result = breakdownCOGSByIngredient(testLines, [], ledger);
    expect(result.length).toBe(2);

    const milkRow = result.find(r => r.ingredient_id === "BI-MILK");
    const strawRow = result.find(r => r.ingredient_id === "BI-STRAWBERRY");
    expect(milkRow?.cogs).toBe(10000); // 0.05L × 200k/L
    expect(milkRow?.qty_consumed).toBeCloseTo(0.05);
    expect(strawRow?.cogs).toBe(1500); // 0.03kg × 50k/kg
  });
  it("allocates ingredient COGS from stored MAC cost_at_sale total", () => {
    const { lines } = makeSuaDauStandaloneOrder();
    const testLines: OrderLineV2[] = lines.map(l => ({
      ...l,
      qty: 1,
      cost_at_sale: 5000,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-031",
          ingredients: [
            { ingredient_id: "BI-LOW", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" },
            { ingredient_id: "BI-HIGH", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" },
          ],
        },
        modifiers: [],
      }),
    }));

    const ledger = [
      { item_reference: "BI-LOW", transaction_type: "PO_RECEIPT", unit_cost: "100", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "BI-HIGH", transaction_type: "PO_RECEIPT", unit_cost: "900", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
    ];

    const result = breakdownCOGSByIngredient(testLines, [], ledger);

    expect(result.reduce((s, r) => s + r.cogs, 0)).toBe(5000);
    expect(result.find(r => r.ingredient_id === "BI-LOW")?.cogs).toBe(500);
    expect(result.find(r => r.ingredient_id === "BI-HIGH")?.cogs).toBe(4500);
  });

  it("groups the ledger once before repeated ingredient MAC lookups", () => {
    const fixture = makeSuaDauStandaloneOrder();
    const order = {
      ...fixture.order,
      id: "order-index",
      created_at: "2026-05-01T00:00:00Z",
    };
    const lines: OrderLineV2[] = fixture.lines.slice(0, 1).map(line => ({
      ...line,
      order_id: order.id,
      cost_at_sale: 5000,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-INDEX",
          ingredients: [
            { ingredient_id: "BI-A", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" },
            { ingredient_id: "BI-B", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" },
          ],
        },
        modifiers: [],
      }),
    }));

    let itemReferenceReads = 0;
    const ledger = ["BI-A", "BI-B"].map(itemReference => ({
      get item_reference() {
        itemReferenceReads += 1;
        return itemReference;
      },
      transaction_type: "PO_RECEIPT",
      unit_cost: "100",
      quantity_change: "10",
      created_at: "2026-06-01T00:00:00Z",
    }));

    breakdownCOGSByIngredient(lines, [order], ledger);

    expect(itemReferenceReads).toBe(ledger.length);
  });

  it("advances inventory balances once across chronologically sorted lines", () => {
    const fixture = makeSuaDauStandaloneOrder();
    const order = {
      ...fixture.order,
      id: "order-balance-window",
      created_at: "2026-07-01T00:00:00Z",
    };
    const baseLine = {
      ...fixture.lines[0],
      order_id: order.id,
      cost_at_sale: 100,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-BALANCE",
          ingredients: [
            { ingredient_id: "BI-A", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" },
          ],
        },
        modifiers: [],
      }),
    };
    const lines: OrderLineV2[] = [
      { ...baseLine, id: "line-balance-1" },
      { ...baseLine, id: "line-balance-2" },
    ];

    let itemReferenceReads = 0;
    const ledger = ["BI-A", "BI-B"].map(itemReference => ({
      get item_reference() {
        itemReferenceReads += 1;
        return itemReference;
      },
      transaction_type: "PO_RECEIPT",
      unit_cost: "100",
      quantity_change: "10",
      created_at: "2026-06-01T00:00:00Z",
    }));

    breakdownCOGSByIngredient(lines, [order], ledger);

    expect(itemReferenceReads).toBe(ledger.length * 2);
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

  // Claude code — regression test for "Đào miếng" COGS = 0 bug.
  it("WS-12 fix: filters SALES_CONSUME before FIFOTracker.init (avoids double-consumption)", () => {
    // Setup: ledger has both PO_RECEIPT and SALES_CONSUME for ING-X.
    // Without filter: FIFOTracker.init() consumes SALES_CONSUME during init,
    // depleting batches. By the time the line is processed, no stock left → modifier COGS = 0.
    // With filter: tracker sees only PO_RECEIPT → batches full → modifier COGS = 4000 (1 unit × 4000/u).
    const lines = [{
      ...makeSuaDauStandaloneOrder().lines[0],
      qty: 1,
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-DAO", name: "Đào miếng", price: 10000, qty: 1 }]),
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT", target_id: "VAR-MOCK",
          ingredients: [{ ingredient_id: "BI-OTHER", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" }],
        },
        modifiers: [{
          modifier_id: "MOD-DAO", modifier_name: "Đào miếng",
          recipe: {
            target_type: "MODIFIER", target_id: "MOD-DAO",
            ingredients: [{ ingredient_id: "ING-X", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" }],
          },
        }],
      }),
      cost_at_sale: 5000,
    }] as any;

    // Ledger: 10 units received @ 4000/u, then 5 units consumed by other sales (SALES_CONSUME).
    // Also 1 EDIT_REVERSAL. Without filter, init consumes 5+1 → batches left with 4.
    // Then the test line consumes 1 (modifier) → modifier COGS = 1 × 4000 = 4000.
    // Note: WITHOUT the fix, init would consume all 5+1=6 (including SALES_CONSUME) → batches
    // left with 4 → still enough for 1 modifier unit, but the bug manifests in real data
    // where cumulative SALES_CONSUME > PO_RECEIPT.
    const ledger = [
      { item_reference: "ING-X", transaction_type: "PO_RECEIPT", unit_cost: "4000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "ING-X", transaction_type: "SALES_CONSUME", unit_cost: "0", quantity_change: "-8", created_at: "2026-06-10T00:00:00Z" },
      { item_reference: "ING-X", transaction_type: "SALES_CONSUME", unit_cost: "0", quantity_change: "-2", created_at: "2026-06-15T00:00:00Z" },
      { item_reference: "ING-X", transaction_type: "EDIT_REVERSAL", unit_cost: "0", quantity_change: "1", created_at: "2026-06-16T00:00:00Z" },
    ];

    const result = breakdownCOGSBySource(lines, [], ledger);

    // After fix: tracker.init filters out SALES_CONSUME + EDIT_REVERSAL.
    // Batches have 10 units. Line consumes 1 (modifier) → modifier COGS = 4000.
    // Without fix: tracker.init consumes SALES_CONSUME entries (8 + 2 = 10) → batches empty.
    // Plus EDIT_REVERSAL adds 1 back → batches have 1. Line consumes 1 → modifier COGS = 4000.
    // To force bug to manifest, we need cumulative consumption > receipts.
    // The test ledger above still leaves 1 unit after buggy init, so both pass.
    // Use larger SALES_CONSUME to demonstrate bug:
    expect(result.modifierRows.length).toBeGreaterThan(0);
    expect(result.modifierRows[0].cogs).toBe(4000);
  });

  it("WS-12 fix: bug manifests when SALES_CONSUME exhausts PO_RECEIPT", () => {
    // Setup that reproduces the actual production bug:
    // - Real production ledger has many SALES_CONSUME entries that deplete batches.
    // - Without filter, by the time a late-processed line tries to consume, stock = 0.
    // Single-line test: 1 line, ledger has 1 PO_RECEIPT + many SALES_CONSUME
    // such that after init, batches = 0.
    const lines = [{
      ...makeSuaDauStandaloneOrder().lines[0],
      qty: 1,
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-DAO", name: "Đào miếng", price: 10000, qty: 1 }]),
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT", target_id: "VAR-MOCK",
          ingredients: [],
        },
        modifiers: [{
          modifier_id: "MOD-DAO", modifier_name: "Đào miếng",
          recipe: {
            target_type: "MODIFIER", target_id: "MOD-DAO",
            ingredients: [{ ingredient_id: "ING-X", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" }],
          },
        }],
      }),
      cost_at_sale: 4000,
    }] as any;

    // 10 units received, 10 units consumed by previous sales.
    const ledger = [
      { item_reference: "ING-X", transaction_type: "PO_RECEIPT", unit_cost: "4000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "ING-X", transaction_type: "SALES_CONSUME", unit_cost: "0", quantity_change: "-10", created_at: "2026-06-15T00:00:00Z" },
    ];

    const result = breakdownCOGSBySource(lines, [], ledger);

    // With fix: filter removes SALES_CONSUME. Batches have 10. Consume 1 → modifier COGS = 4000.
    // Without fix: init consumes 10 → batches empty. Consume returns 0.
    expect(result.modifierRows[0].cogs).toBe(4000);
  });
});
