import { describe, expect, it } from "vitest";

import { buildVoidShortfallRepairPlan } from "./void-order-ledger-repair";

describe("buildVoidShortfallRepairPlan", () => {
  it("plans a complete derived-ledger replacement for only the named orders", () => {
    const plans = buildVoidShortfallRepairPlan({
      targetOrderNos: ["PHD001128", "PHD001132"],
      orders: [
        { id: "voided-order", order_no: "PHD001128" },
        { id: "completed-order", order_no: "PHD001132" },
        { id: "unrelated-order", order_no: "PHD001999" },
      ],
      rawLedger: [
        { reference_id: "voided-order", transaction_type: "PRODUCTION_CONSUME" },
        { reference_id: "voided-order", transaction_type: "PRODUCTION_YIELD" },
        { reference_id: "voided-order", transaction_type: "SALES_CONSUME" },
        { reference_id: "voided-order", transaction_type: "PO_RECEIPT" },
        { reference_id: "completed-order", transaction_type: "SALES_CONSUME" },
      ],
      computedLedger: [
        {
          reference_id: "completed-order",
          item_reference: "ING-EGG",
          transaction_type: "PRODUCTION_CONSUME",
          quantity_change: -2,
          unit_cost: 4_873,
          created_at: "2026-07-24T10:00:00.000Z",
        },
        {
          reference_id: "unrelated-order",
          item_reference: "ING-X",
          transaction_type: "SALES_CONSUME",
          quantity_change: -1,
          unit_cost: 100,
          created_at: "2026-07-24T11:00:00.000Z",
        },
      ],
    });

    expect(plans).toEqual([
      {
        orderId: "voided-order",
        orderNo: "PHD001128",
        expectedDeleteCount: 3,
        insertRows: [],
      },
      {
        orderId: "completed-order",
        orderNo: "PHD001132",
        expectedDeleteCount: 1,
        insertRows: [{
          item_reference: "ING-EGG",
          transaction_type: "PRODUCTION_CONSUME",
          quantity_change: -2,
          unit_cost: 4_873,
          created_at: "2026-07-24T10:00:00.000Z",
        }],
      },
    ]);
  });

  it("refuses an ambiguous or missing target order", () => {
    expect(() => buildVoidShortfallRepairPlan({
      targetOrderNos: ["PHD001128"],
      orders: [],
      rawLedger: [],
      computedLedger: [],
    })).toThrow("Expected exactly one order PHD001128");

    expect(() => buildVoidShortfallRepairPlan({
      targetOrderNos: ["PHD001128"],
      orders: [
        { id: "one", order_no: "PHD001128" },
        { id: "two", order_no: "PHD001128" },
      ],
      rawLedger: [],
      computedLedger: [],
    })).toThrow("Expected exactly one order PHD001128");
  });
});
