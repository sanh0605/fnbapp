import { describe, expect, it } from "vitest";

import { buildVoidReversalRows } from "./void-order-reversal";

describe("buildVoidReversalRows", () => {
  it("reverses every checkout-derived ledger row, including implicit production", () => {
    let sequence = 0;
    const rows = buildVoidReversalRows({
      orderId: "order-1",
      orderEventId: "event-1",
      eventTime: "2026-07-24T10:00:00.000Z",
      createRowId: () => `reversal-${++sequence}`,
      ledgerRows: [
        {
          id: "production-consume",
          reference_id: "order-1",
          transaction_type: "PRODUCTION_CONSUME",
          item_reference: "ING-EGG",
          quantity_change: -1,
          unit_cost: 4_873,
          source: "IMPLICIT_PRODUCTION",
        },
        {
          id: "production-yield",
          reference_id: "order-1",
          transaction_type: "PRODUCTION_YIELD",
          item_reference: "BTP-EGG",
          quantity_change: 1,
          unit_cost: 4_873,
          source: "IMPLICIT_PRODUCTION",
        },
        {
          id: "sale-consume",
          reference_id: "order-1",
          transaction_type: "SALES_CONSUME",
          item_reference: "BTP-EGG",
          quantity_change: -1,
          unit_cost: 4_873,
          cost_at_sale: 4_873,
          source: "VARIANT_RECIPE",
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: "reversal-1",
        transaction_type: "EDIT_REVERSAL",
        item_reference: "ING-EGG",
        quantity_change: 1,
        source: "IMPLICIT_PRODUCTION",
      }),
      expect.objectContaining({
        id: "reversal-2",
        transaction_type: "EDIT_REVERSAL",
        item_reference: "BTP-EGG",
        quantity_change: -1,
        source: "IMPLICIT_PRODUCTION",
      }),
      expect.objectContaining({
        id: "reversal-3",
        transaction_type: "EDIT_REVERSAL",
        item_reference: "BTP-EGG",
        quantity_change: 1,
        cost_at_sale: 4_873,
        source: "VARIANT_RECIPE",
      }),
    ]);
  });

  it("ignores unrelated orders, primitive rows, and earlier reversal rows", () => {
    const rows = buildVoidReversalRows({
      orderId: "order-1",
      orderEventId: "event-1",
      eventTime: "2026-07-24T10:00:00.000Z",
      createRowId: () => "unused",
      ledgerRows: [
        { reference_id: "order-2", transaction_type: "SALES_CONSUME", item_reference: "ING-A", quantity_change: -1 },
        { reference_id: "order-1", transaction_type: "PO_RECEIPT", item_reference: "ING-A", quantity_change: 10 },
        { reference_id: "order-1", transaction_type: "STOCK_ADJUST", item_reference: "ING-A", quantity_change: 2 },
        { reference_id: "order-1", transaction_type: "EDIT_REVERSAL", item_reference: "ING-A", quantity_change: 1 },
      ],
    });

    expect(rows).toEqual([]);
  });
});
