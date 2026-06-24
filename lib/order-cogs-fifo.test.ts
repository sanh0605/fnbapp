import { describe, expect, it } from "vitest";
import { FIFOTracker } from "@/lib/fifo-tracker";
import { computeLineCostFIFO } from "@/lib/order-cogs-fifo";

describe("computeLineCostFIFO", () => {
  it("multiplies modifier recipe cost by line qty and modifier qty", () => {
    const tracker = new FIFOTracker();
    tracker.init([
      {
        id: "po-1",
        item_reference: "BI-PEARL",
        transaction_type: "PO_RECEIPT",
        quantity_change: 100,
        unit_cost: 10,
        created_at: "2026-06-01T00:00:00Z",
      },
    ]);

    const lineRecipe = {
      variant: { target_type: "PRODUCT_VARIANT" as const, target_id: "VAR-1", ingredients: [] },
      modifiers: [{
        modifier_id: "MOD-PEARL",
        modifier_name: "Pearl",
        modifier_qty: 2,
        recipe: {
          target_type: "MODIFIER" as const,
          target_id: "MOD-PEARL",
          ingredients: [
            { ingredient_id: "BI-PEARL", ingredient_type: "BASE_INGREDIENT" as const, quantity: 3, unit_id: "g" },
          ],
        },
      }],
    };

    expect(computeLineCostFIFO(lineRecipe, tracker, 4)).toBe(240);
  });
});
