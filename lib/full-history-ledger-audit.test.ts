import { describe, expect, it } from "vitest";
import { auditFullHistoryOrderLedger } from "./full-history-ledger-audit";

describe("auditFullHistoryOrderLedger", () => {
  it("reports zero mismatches when recorded derived rows match the replay", () => {
    const report = auditFullHistoryOrderLedger({
      orders: [{ id: "order-1", order_no: "PHD001", status: "COMPLETED" }],
      computedLedger: [
        { reference_id: "order-1", item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -3 },
        { reference_id: "order-1", item_reference: "ING-B", transaction_type: "PRODUCTION_CONSUME", quantity_change: -2 },
      ],
      recordedLedger: [
        { id: "row-1", reference_id: "order-1", item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -3 },
        { id: "row-2", reference_id: "order-1", item_reference: "ING-B", transaction_type: "PRODUCTION_CONSUME", quantity_change: -2 },
      ],
    });

    expect(report.mismatches).toEqual([]);
    expect(report.orphanLedgerRows).toEqual([]);
  });

  it("reports a stale recorded quantity against the replay result", () => {
    const report = auditFullHistoryOrderLedger({
      orders: [{ id: "order-1", order_no: "PHD001", status: "COMPLETED" }],
      computedLedger: [
        { reference_id: "order-1", item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -3 },
      ],
      recordedLedger: [
        { reference_id: "order-1", item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -2 },
      ],
    });

    expect(report.mismatches).toEqual([expect.objectContaining({
      order_id: "order-1",
      item_reference: "ING-A",
      expected_quantity: -3,
      actual_quantity: -2,
      delta: 1,
    })]);
  });

  it("accepts a superseded order whose recorded consume and reversal net to zero", () => {
    const report = auditFullHistoryOrderLedger({
      orders: [{ id: "order-old", order_no: "PHD000", status: "SUPERSEDED" }],
      computedLedger: [],
      recordedLedger: [
        { reference_id: "order-old", item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -3 },
        { reference_id: "order-old", item_reference: "ING-A", transaction_type: "EDIT_REVERSAL", quantity_change: 3 },
      ],
    });

    expect(report.mismatches).toEqual([]);
  });

  it("reports only order-derived rows with an unknown reference as orphans", () => {
    const report = auditFullHistoryOrderLedger({
      orders: [],
      computedLedger: [],
      recordedLedger: [
        { id: "sale", reference_id: "missing-order", item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1 },
        { id: "receipt", reference_id: "PO-1", item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: 10 },
      ],
    });

    expect(report.orphanLedgerRows).toEqual([expect.objectContaining({ id: "sale" })]);
  });

  it("ignores sub-centiunit storage rounding residue by default", () => {
    const report = auditFullHistoryOrderLedger({
      orders: [{ id: "order-1", status: "COMPLETED" }],
      computedLedger: [
        { reference_id: "order-1", item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -10.123456 },
      ],
      recordedLedger: [
        { reference_id: "order-1", item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -10.123459 },
      ],
    });

    expect(report.mismatches).toEqual([]);
  });
});
