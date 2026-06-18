import { describe, it, expect } from "vitest";
import { computeLineCostAtSale } from "@/lib/order-cogs";
import type { RecipeSnapshot } from "@/lib/order-types";

const recipe: RecipeSnapshot = {
  target_type: "PRODUCT_VARIANT",
  target_id: "VAR-031",
  ingredients: [
    { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "UNIT-LITER" },
    { ingredient_id: "BI-STRAWBERRY", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "UNIT-KG" },
  ],
};

describe("computeLineCostAtSale", () => {
  it("returns 0 when recipe has no ingredients", () => {
    const empty: RecipeSnapshot = { target_type: "PRODUCT_VARIANT", target_id: "V1", ingredients: [] };
    expect(computeLineCostAtSale(empty, [], 1)).toBe(0);
  });

  it("returns 0 when ledger has no PO_RECEIPT entries", () => {
    expect(computeLineCostAtSale(recipe, [], 1)).toBe(0);
  });

  it("computes MAC = total_cost / total_qty across all PO_RECEIPT entries per ingredient", () => {
    // 2 PO_RECEIPTs for BI-MILK: 10L @ 20k/L, 5L @ 30k/L
    //   MAC = (10*20 + 5*30) / (10+5) = 350/15 = 23.333k/L
    //   Consume 0.05 L × qty 1 → 1167đ
    // 1 PO_RECEIPT for BI-STRAWBERRY: 2kg @ 100k/kg
    //   MAC = 100k/kg
    //   Consume 0.03 kg × qty 1 → 3000đ
    //   Total: 1167 + 3000 = 4167đ
    const ledger = [
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "20000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "30000", quantity_change: "5", created_at: "2026-06-05T00:00:00Z" },
      { item_reference: "BI-STRAWBERRY", transaction_type: "PO_RECEIPT", unit_cost: "100000", quantity_change: "2", created_at: "2026-06-01T00:00:00Z" },
    ];
    const cost = computeLineCostAtSale(recipe, ledger, 1);
    expect(cost).toBe(4167);
  });

  it("scales linearly with line qty", () => {
    const ledger = [
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "20000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
    ];
    // 0.05 L × 20k/L × qty 2 = 2000đ
    const single: RecipeSnapshot = {
      target_type: "PRODUCT_VARIANT",
      target_id: "V1",
      ingredients: [
        { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "L" },
      ],
    };
    expect(computeLineCostAtSale(single, ledger, 2)).toBe(2000);
  });

  it("ignores non-PO_RECEIPT entries (sales, adjustments)", () => {
    const ledger = [
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "20000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "BI-MILK", transaction_type: "SALES_CONSUME", unit_cost: "20000", quantity_change: "-2", created_at: "2026-06-02T00:00:00Z" },
    ];
    const single: RecipeSnapshot = {
      target_type: "PRODUCT_VARIANT",
      target_id: "V1",
      ingredients: [
        { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "L" },
      ],
    };
    // MAC ignores SALES_CONSUME → still 20k/L × 1 = 20000
    expect(computeLineCostAtSale(single, ledger, 1)).toBe(20000);
  });

  it("ignores PO_RECEIPT entries after the sale time", () => {
    const ledger = [
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "20000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
      { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "50000", quantity_change: "10", created_at: "2026-06-10T00:00:00Z" }, // future
    ];
    const single: RecipeSnapshot = {
      target_type: "PRODUCT_VARIANT",
      target_id: "V1",
      ingredients: [
        { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "L" },
      ],
    };
    // Sale at 2026-06-05: only first PO counts → 20k/L
    expect(computeLineCostAtSale(single, ledger, 1, "2026-06-05T00:00:00Z")).toBe(20000);
  });
});
