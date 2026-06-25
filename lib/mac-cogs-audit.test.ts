import { describe, expect, it } from "vitest";
import { auditMacCogsDrift } from "@/lib/mac-cogs-audit";

const recipeSnapshot = {
  variant: {
    ingredients: [
      { ingredient_id: "ING-A", ingredient_type: "BASE_INGREDIENT", quantity: 2, unit_id: "g" },
    ],
  },
  modifiers: [],
};

describe("auditMacCogsDrift", () => {
  it("recomputes active order line COGS with MAC and classifies migrated drift", () => {
    const report = auditMacCogsDrift({
      orders: [
        { id: "ord-1", order_no: "PHD000001", status: "COMPLETED", created_at: "2026-06-02T00:00:00Z" },
      ],
      lines: [
        {
          id: "ol-migrated-1",
          order_id: "ord-1",
          product_id: "PROD-1",
          variant_id: "VAR-1",
          qty: 3,
          cost_at_sale: 10,
          recipe_snapshot_json: JSON.stringify(recipeSnapshot),
        },
      ],
      ledger: [
        { item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 5, created_at: "2026-06-01T00:00:00Z" },
      ],
      recipes: [],
      semiProducts: [],
    });

    expect(report.eligibleOrderCount).toBe(1);
    expect(report.eligibleLineCount).toBe(1);
    expect(report.mismatchedLineCount).toBe(1);
    expect(report.totalExpectedCogs).toBe(30);
    expect(report.lineMismatches[0]).toMatchObject({
      line_id: "ol-migrated-1",
      stored_cost: 10,
      expected_cost: 30,
      delta: 20,
      classification: "MIGRATED_LINE",
      has_btp_shortfall: false,
    });
  });

  it("flags BTP shortfall mismatches separately", () => {
    const report = auditMacCogsDrift({
      orders: [
        { id: "ord-1", order_no: "PHD000001", status: "COMPLETED", created_at: "2026-06-02T00:00:00Z" },
      ],
      lines: [
        {
          id: "ol-1",
          order_id: "ord-1",
          product_id: "PROD-1",
          variant_id: "VAR-1",
          qty: 1,
          cost_at_sale: 0,
          recipe_snapshot_json: JSON.stringify({
            variant: {
              ingredients: [
                { ingredient_id: "BTP-1", ingredient_type: "SEMI_PRODUCT", quantity: 20, unit_id: "ml" },
              ],
            },
            modifiers: [],
          }),
        },
      ],
      ledger: [
        { item_reference: "BTP-1", transaction_type: "PRODUCTION_YIELD", quantity_change: 10, unit_cost: 5, created_at: "2026-06-01T00:00:00Z" },
        { item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 2, created_at: "2026-06-01T00:00:00Z" },
      ],
      recipes: [
        {
          target_id: "BTP-1",
          target_type: "SEMI_PRODUCT",
          ingredients_json: JSON.stringify([
            { ingredient_id: "ING-A", ingredient_type: "BASE_INGREDIENT", quantity: 100, unit_id: "g" },
          ]),
        },
      ],
      semiProducts: [{ id: "BTP-1", batch_yield: 100 }],
    });

    expect(report.lineMismatches[0]).toMatchObject({
      expected_cost: 70,
      classification: "BTP_SHORTFALL",
      has_btp_shortfall: true,
    });
    expect(report.classificationCounts).toEqual({ BTP_SHORTFALL: 1 });
  });
});
