import { describe, expect, it } from "vitest";
import { auditCogsDrift } from "@/lib/cogs-drift-audit";

describe("auditCogsDrift", () => {
  it("reports line and order mismatches between stored COGS and FIFO COGS", () => {
    const orders = [
      {
        id: "ORD-1",
        order_no: "UCK000001",
        status: "COMPLETED",
        superseded_by: "",
        created_at: "2026-06-10T10:00:00Z",
      },
    ];
    const lines = [
      {
        id: "LINE-1",
        order_id: "ORD-1",
        product_id: "PROD-1",
        variant_id: "VAR-1",
        qty: "1",
        cost_at_sale: "50",
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-1",
            ingredients: [
              {
                ingredient_type: "BASE_INGREDIENT",
                ingredient_id: "BI-MILK",
                quantity: 1,
              },
            ],
          },
          modifiers: [],
        }),
      },
    ];
    const ledger = [
      {
        id: "PO-1",
        item_reference: "BI-MILK",
        transaction_type: "PO_RECEIPT",
        unit_cost: "100",
        quantity_change: "10",
        created_at: "2026-06-01T00:00:00Z",
      },
    ];

    const report = auditCogsDrift({
      orders,
      lines,
      ledger,
      recipes: [],
      semiProducts: [],
    });

    expect(report.eligibleOrderCount).toBe(1);
    expect(report.eligibleLineCount).toBe(1);
    expect(report.mismatchedLineCount).toBe(1);
    expect(report.mismatchedOrderCount).toBe(1);
    expect(report.totalStoredCogs).toBe(50);
    expect(report.totalExpectedCogs).toBe(100);
    expect(report.orderMismatches[0]).toMatchObject({
      order_id: "ORD-1",
      order_no: "UCK000001",
      stored_cogs: 50,
      expected_cogs: 100,
      delta: 50,
      mismatched_line_count: 1,
    });
    expect(report.lineMismatches[0]).toMatchObject({
      line_id: "LINE-1",
      order_id: "ORD-1",
      order_no: "UCK000001",
      stored_cost: 50,
      expected_cost: 100,
      delta: 50,
    });
  });
});
