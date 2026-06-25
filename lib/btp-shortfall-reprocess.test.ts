import { describe, expect, it } from "vitest";
import { planBtpShortfallReprocess } from "@/lib/btp-shortfall-reprocess";

describe("planBtpShortfallReprocess", () => {
  it("reverses old direct semi-product sales and adds split shortfall consumption", () => {
    const plan = planBtpShortfallReprocess({
      cutoffAt: "2026-06-25T07:31:08.402Z",
      orders: [{ id: "ord-1", order_no: "O1", status: "COMPLETED", created_at: "2026-06-25T08:00:00Z" }],
      lines: [{
        id: "line-1",
        order_id: "ord-1",
        qty: 1,
        recipe_snapshot_json: JSON.stringify({
          variant: {
            ingredients: [{ ingredient_id: "BTP-COFFEE", ingredient_type: "SEMI_PRODUCT", quantity: 20 }],
          },
          modifiers: [],
        }),
      }],
      ledger: [
        { id: "adj-1", transaction_type: "STOCK_ADJUST", reference_id: "ADJ", item_reference: "BTP-COFFEE", quantity_change: 10, created_at: "2026-06-25T07:31:08.402Z" },
        { id: "old-1", transaction_type: "SALES_CONSUME", reference_id: "ord-1", item_reference: "BTP-COFFEE", quantity_change: -20, created_at: "2026-06-25T08:00:00Z", source: "" },
      ],
      recipes: [{
        target_id: "BTP-COFFEE",
        target_type: "SEMI_PRODUCT",
        ingredients_json: JSON.stringify([{ ingredient_id: "ING-BEAN", ingredient_type: "BASE_INGREDIENT", quantity: 100 }]),
      }],
      semiProducts: [{ id: "BTP-COFFEE", batch_yield: 100 }],
    });

    expect(plan.ordersToReprocess).toBe(1);
    expect(plan.rowsToInsert).toEqual([
      expect.objectContaining({
        transaction_type: "EDIT_REVERSAL",
        reference_id: "ord-1",
        item_reference: "BTP-COFFEE",
        quantity_change: 20,
      }),
      expect.objectContaining({
        transaction_type: "SALES_CONSUME",
        reference_id: "ord-1",
        item_reference: "BTP-COFFEE",
        quantity_change: -10,
        source: "VARIANT_RECIPE",
      }),
      expect.objectContaining({
        transaction_type: "SALES_CONSUME",
        reference_id: "ord-1",
        item_reference: "ING-BEAN",
        quantity_change: -10,
        source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE",
      }),
    ]);
  });

  it("skips orders that already have a reprocess marker", () => {
    const plan = planBtpShortfallReprocess({
      cutoffAt: "2026-06-25T07:31:08.402Z",
      orders: [{ id: "ord-1", status: "COMPLETED", created_at: "2026-06-25T08:00:00Z" }],
      lines: [{ id: "line-1", order_id: "ord-1", qty: 1, recipe_snapshot_json: "{}" }],
      ledger: [{
        id: "done",
        transaction_type: "EDIT_REVERSAL",
        reference_id: "ord-1",
        item_reference: "BTP-COFFEE",
        quantity_change: 20,
        created_at: "2026-06-25T08:00:00Z",
        order_event_id: "BTP-SHORTFALL-REPROCESS-ord-1",
      }],
      recipes: [],
      semiProducts: [],
    });

    expect(plan.ordersToReprocess).toBe(0);
    expect(plan.rowsToInsert).toEqual([]);
  });
});
