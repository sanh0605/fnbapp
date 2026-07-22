import { describe, expect, it } from "vitest";
import {
  buildTrustedPrimitiveLedger,
  replayFullHistory,
  type RawLine,
  type RawOrder,
  type RawRecipe,
  type RawSemiProduct,
  type SimLedgerRow,
} from "./full-history-recompute";

function lineRecipeJson(ingredientId: string, ingredientType: "BASE_INGREDIENT" | "SEMI_PRODUCT", quantity: number): string {
  return JSON.stringify({
    variant: {
      target_type: "PRODUCT_VARIANT",
      target_id: "variant-1",
      ingredients: [{ ingredient_id: ingredientId, ingredient_type: ingredientType, quantity, unit_id: "g" }],
    },
    modifiers: [],
  });
}

function recipeRow(targetId: string, ingredients: Array<{ id: string; type: "BASE_INGREDIENT" | "SEMI_PRODUCT"; qty: number }>, opts?: { startDate?: string }): RawRecipe {
  return {
    target_type: "SEMI_PRODUCT",
    target_id: targetId,
    status: "ACTIVE",
    start_date: opts?.startDate || "2026-01-01T00:00:00Z",
    end_date: null,
    created_at: opts?.startDate || "2026-01-01T00:00:00Z",
    ingredients_json: JSON.stringify(
      ingredients.map(i => ({ ingredient_id: i.id, ingredient_type: i.type, quantity: i.qty, unit_id: "g" })),
    ),
  };
}

describe("replayFullHistory", () => {
  it("draws from a real Production Order's yield instead of re-exploding to raw ingredients (no double counting)", () => {
    const semiProducts: RawSemiProduct[] = [{ id: "BTP-001", batch_yield: 100 }];
    const recipes: RawRecipe[] = [recipeRow("BTP-001", [{ id: "ING-001", type: "BASE_INGREDIENT", qty: 50 }])];

    const trustedPrimitives: SimLedgerRow[] = [
      { id: "prod-consume-1", reference_id: "PROD-1", item_reference: "ING-001", transaction_type: "PRODUCTION_CONSUME", quantity_change: -50, unit_cost: 0, created_at: "2026-02-01T00:00:00Z" },
      { id: "prod-yield-1", reference_id: "PROD-1", item_reference: "BTP-001", transaction_type: "PRODUCTION_YIELD", quantity_change: 100, unit_cost: 0, created_at: "2026-02-01T00:00:00Z" },
    ];

    const orders: RawOrder[] = [{ id: "ord-1", order_no: "A001", status: "COMPLETED", created_at: "2026-02-02T00:00:00Z" }];
    const lines: RawLine[] = [{ id: "line-1", order_id: "ord-1", qty: 1, cost_at_sale: 0, recipe_snapshot_json: lineRecipeJson("BTP-001", "SEMI_PRODUCT", 80) }];

    const result = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives });

    expect(result.errors).toEqual([]);
    expect(result.lineResults).toHaveLength(1);
    const rows = result.lineResults[0].consumption_rows;
    // Only the semi-product itself is consumed (80ml drawn from the 100ml
    // real batch) -- ING-001 must NOT appear again here, since it was
    // already debited by the real Production Order.
    expect(rows).toEqual([{ item_reference: "BTP-001", quantity: 80, source: "VARIANT_RECIPE" }]);
    expect(rows.some(r => r.item_reference === "ING-001")).toBe(false);
  });

  it("fully explodes to raw ingredients when there is no production history (pure shortfall)", () => {
    const semiProducts: RawSemiProduct[] = [{ id: "BTP-002", batch_yield: 50 }];
    const recipes: RawRecipe[] = [recipeRow("BTP-002", [{ id: "ING-002", type: "BASE_INGREDIENT", qty: 10 }])];

    const orders: RawOrder[] = [{ id: "ord-2", order_no: "A002", status: "COMPLETED", created_at: "2026-02-02T00:00:00Z" }];
    const lines: RawLine[] = [{ id: "line-2", order_id: "ord-2", qty: 1, cost_at_sale: 0, recipe_snapshot_json: lineRecipeJson("BTP-002", "SEMI_PRODUCT", 30) }];

    const result = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives: [] });

    expect(result.errors).toEqual([]);
    const rows = result.lineResults[0].consumption_rows;
    // 30ml needed, 0 available -> full shortfall -> (10/50)*30 = 6g of ING-002.
    expect(rows).toHaveLength(1);
    expect(rows[0].item_reference).toBe("ING-002");
    expect(rows[0].quantity).toBeCloseTo(6);
  });

  it("partial shortfall: draws available balance from a real batch, explodes only the remainder (owner's own worked example)", () => {
    const semiProducts: RawSemiProduct[] = [{ id: "BTP-003", batch_yield: 100 }];
    const recipes: RawRecipe[] = [recipeRow("BTP-003", [{ id: "ING-003", type: "BASE_INGREDIENT", qty: 40 }])];

    const trustedPrimitives: SimLedgerRow[] = [
      { id: "y1", reference_id: "PROD-3", item_reference: "BTP-003", transaction_type: "PRODUCTION_YIELD", quantity_change: 30, unit_cost: 0, created_at: "2026-02-01T00:00:00Z" },
    ];
    const orders: RawOrder[] = [{ id: "ord-3", order_no: "A003", status: "COMPLETED", created_at: "2026-02-02T00:00:00Z" }];
    const lines: RawLine[] = [{ id: "line-3", order_id: "ord-3", qty: 1, cost_at_sale: 0, recipe_snapshot_json: lineRecipeJson("BTP-003", "SEMI_PRODUCT", 50) }];

    const result = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives });

    const rows = result.lineResults[0].consumption_rows;
    // 50 needed, 30 available -> 30 drawn from balance + shortfall 20 -> (40/100)*20 = 8g raw.
    const semiRow = rows.find(r => r.item_reference === "BTP-003");
    const rawRow = rows.find(r => r.item_reference === "ING-003");
    expect(semiRow?.quantity).toBe(30);
    expect(rawRow?.quantity).toBeCloseTo(8);

    // The computed forward ledger must show a PRODUCTION_YIELD crediting the
    // 20ml just-in-time production, so a LATER order sees an accurate balance.
    const implicitYield = result.computedLedger.find(r => r.transaction_type === "PRODUCTION_YIELD" && r.reference_id === "ord-3");
    expect(implicitYield?.quantity_change).toBeCloseTo(20);
  });

  it("uses the recipe effective at the order's own timestamp, not a later revision", () => {
    const semiProducts: RawSemiProduct[] = [{ id: "BTP-004", batch_yield: 10 }];
    const recipes: RawRecipe[] = [
      recipeRow("BTP-004", [{ id: "ING-OLD", type: "BASE_INGREDIENT", qty: 5 }], { startDate: "2026-01-01T00:00:00Z" }),
      recipeRow("BTP-004", [{ id: "ING-NEW", type: "BASE_INGREDIENT", qty: 5 }], { startDate: "2026-03-01T00:00:00Z" }),
    ];

    const orders: RawOrder[] = [{ id: "ord-4", order_no: "A004", status: "COMPLETED", created_at: "2026-02-01T00:00:00Z" }];
    const lines: RawLine[] = [{ id: "line-4", order_id: "ord-4", qty: 1, cost_at_sale: 0, recipe_snapshot_json: lineRecipeJson("BTP-004", "SEMI_PRODUCT", 10) }];

    const result = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives: [] });
    const rows = result.lineResults[0].consumption_rows;
    expect(rows.some(r => r.item_reference === "ING-OLD")).toBe(true);
    expect(rows.some(r => r.item_reference === "ING-NEW")).toBe(false);
  });

  it("excludes superseded orders, only replaying the live final version of an edit chain", () => {
    const orders: RawOrder[] = [
      { id: "ord-5-old", order_no: "A005", status: "SUPERSEDED", superseded_by: "ord-5-new", created_at: "2026-02-01T00:00:00Z" },
      { id: "ord-5-new", order_no: "A005", status: "COMPLETED", created_at: "2026-02-01T00:05:00Z" },
    ];
    const lines: RawLine[] = [
      { id: "line-5-old", order_id: "ord-5-old", qty: 1, cost_at_sale: 0, recipe_snapshot_json: lineRecipeJson("ING-005", "BASE_INGREDIENT", 5) },
      { id: "line-5-new", order_id: "ord-5-new", qty: 1, cost_at_sale: 0, recipe_snapshot_json: lineRecipeJson("ING-005", "BASE_INGREDIENT", 7) },
    ];

    const result = replayFullHistory({ orders, lines, recipes: [], semiProducts: [], trustedPrimitives: [] });
    expect(result.lineResults).toHaveLength(1);
    expect(result.lineResults[0].order_id).toBe("ord-5-new");
    expect(result.lineResults[0].consumption_rows[0].quantity).toBe(7);
  });

  it("replays purchase receipts in chronological (created_at) order regardless of array insertion order", () => {
    const orders: RawOrder[] = [{ id: "ord-6", order_no: "A006", status: "COMPLETED", created_at: "2026-03-01T00:00:00Z" }];
    const lines: RawLine[] = [{ id: "line-6", order_id: "ord-6", qty: 1, cost_at_sale: 0, recipe_snapshot_json: lineRecipeJson("ING-006", "BASE_INGREDIENT", 10) }];

    // Inserted out of chronological order on purpose.
    const trustedPrimitives: SimLedgerRow[] = [
      { id: "po-2", reference_id: "PO-2", item_reference: "ING-006", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 20, created_at: "2026-02-15T00:00:00Z" },
      { id: "po-1", reference_id: "PO-1", item_reference: "ING-006", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 10, created_at: "2026-02-01T00:00:00Z" },
    ];

    const result = replayFullHistory({ orders, lines, recipes: [], semiProducts: [], trustedPrimitives });
    // MAC after both receipts (100@10 + 100@20) / 200 = 15 per unit, so 10 units = 150.
    expect(result.lineResults[0].computed_cost_at_sale).toBe(150);
  });
});

describe("buildTrustedPrimitiveLedger", () => {
  it("re-derives PO_RECEIPT from purchase orders using the existing landed-cost logic, not a stored copy", () => {
    const { rows, skippedPoReceipts } = buildTrustedPrimitiveLedger({
      purchaseOrders: [{
        id: "PO-1", status: "COMPLETED", transaction_date: "2026-01-15T00:00:00Z",
        subtotal_amount: 100000, shipping_fee: 10000, tax_amount: 0, voucher_amount: 0, discount_amount: 0,
      }],
      purchaseOrderLines: [{ id: "pol-1", purchase_order_id: "PO-1", purchased_item_id: "PI-1", quantity: 100, subtotal: 100000, conversion_id: "conv-1" }],
      purchasedItems: [{ id: "PI-1", base_ingredient_id: "ING-007" }],
      conversions: [{ id: "conv-1", purchased_item_id: "PI-1", purchased_unit: "kg", conversion_rate: 1000 }],
      rawStockLedger: [],
    });

    expect(skippedPoReceipts).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].item_reference).toBe("ING-007");
    expect(rows[0].transaction_type).toBe("PO_RECEIPT");
    expect(rows[0].quantity_change).toBe(100000); // 100 * 1000 conversion rate
    expect(rows[0].created_at).toBe("2026-01-15T00:00:00Z");
  });

  it("trusts PRODUCTION_CONSUME/PRODUCTION_YIELD/STOCK_ADJUST from the raw ledger, never SALES_CONSUME-family rows", () => {
    const { rows } = buildTrustedPrimitiveLedger({
      purchaseOrders: [],
      purchaseOrderLines: [],
      purchasedItems: [],
      conversions: [],
      rawStockLedger: [
        { id: "1", item_reference: "ING-008", transaction_type: "PRODUCTION_CONSUME", quantity_change: -10, unit_cost: 0, created_at: "2026-01-01T00:00:00Z" },
        { id: "2", item_reference: "BTP-008", transaction_type: "PRODUCTION_YIELD", quantity_change: 5, unit_cost: 0, created_at: "2026-01-01T00:00:00Z" },
        { id: "3", item_reference: "ING-009", transaction_type: "STOCK_ADJUST", quantity_change: 2, unit_cost: 0, created_at: "2026-01-01T00:00:00Z" },
        { id: "4", item_reference: "ING-010", transaction_type: "SALES_CONSUME", quantity_change: -1, unit_cost: 0, created_at: "2026-01-01T00:00:00Z" },
        { id: "5", item_reference: "ING-011", transaction_type: "RECLASSIFICATION_REVERSAL", quantity_change: 1, unit_cost: 0, created_at: "2026-01-01T00:00:00Z" },
      ],
    });

    const types = rows.map(r => r.transaction_type).sort();
    expect(types).toEqual(["PRODUCTION_CONSUME", "PRODUCTION_YIELD", "STOCK_ADJUST"]);
  });
});
