import { describe, expect, it } from "vitest";
import { auditPurchaseOrderHeaderLines } from "./po-header-lines-audit";

describe("auditPurchaseOrderHeaderLines", () => {
  it("reports no mismatch when the header subtotal equals the summed line subtotals", () => {
    const result = auditPurchaseOrderHeaderLines(
      [{ id: "PO-1", subtotal_amount: 102000, status: "COMPLETED", transaction_date: "2026-06-25" }],
      [{ purchase_order_id: "PO-1", subtotal: 102000 }],
    );
    expect(result.mismatchCount).toBe(0);
    expect(result.orderCount).toBe(1);
  });

  it("flags a header total with no lines to support the extra amount", () => {
    const result = auditPurchaseOrderHeaderLines(
      [{ id: "PO-037", subtotal_amount: 3571000, status: "COMPLETED", transaction_date: "2026-06-25" }],
      [{ purchase_order_id: "PO-037", subtotal: 102000 }],
    );
    expect(result.mismatchCount).toBe(1);
    expect(result.mismatches[0]).toMatchObject({
      po_id: "PO-037",
      header_subtotal: 3571000,
      lines_subtotal: 102000,
      delta: 3469000,
      line_count: 1,
      status: "COMPLETED",
      transaction_date: "2026-06-25",
    });
  });

  it("matches lines using either the po_id or purchase_order_id column", () => {
    const result = auditPurchaseOrderHeaderLines(
      [{ id: "PO-2", subtotal_amount: 500, status: "COMPLETED", transaction_date: "2026-06-01" }],
      [{ po_id: "PO-2", subtotal: 500 }],
    );
    expect(result.mismatchCount).toBe(0);
  });

  it("counts an order whose lines were entirely lost as a mismatch with line_count 0", () => {
    const result = auditPurchaseOrderHeaderLines(
      [{ id: "PO-3", subtotal_amount: 100000, status: "COMPLETED", transaction_date: "2026-06-02" }],
      [],
    );
    expect(result.mismatchCount).toBe(1);
    expect(result.mismatches[0]).toMatchObject({ po_id: "PO-3", header_subtotal: 100000, lines_subtotal: 0, line_count: 0 });
  });

  it("treats a delta within tolerance as no mismatch", () => {
    const result = auditPurchaseOrderHeaderLines(
      [{ id: "PO-4", subtotal_amount: 1000.0000001, status: "COMPLETED", transaction_date: "2026-06-03" }],
      [{ purchase_order_id: "PO-4", subtotal: 1000 }],
      0.000001,
    );
    expect(result.mismatchCount).toBe(0);
  });

  it("ignores lines that reference no known purchase order", () => {
    const result = auditPurchaseOrderHeaderLines(
      [{ id: "PO-5", subtotal_amount: 200, status: "COMPLETED", transaction_date: "2026-06-04" }],
      [
        { purchase_order_id: "PO-5", subtotal: 200 },
        { purchase_order_id: "PO-ORPHAN", subtotal: 999 },
      ],
    );
    expect(result.orderCount).toBe(1);
    expect(result.mismatchCount).toBe(0);
  });
});
