import { describe, expect, it } from "vitest";

import { auditStockAdjustmentLedgerLinks } from "./stock-adjustment-audit";

describe("auditStockAdjustmentLedgerLinks", () => {
  it("separates missing, duplicate, and mismatched approved ledger effects", () => {
    const result = auditStockAdjustmentLedgerLinks(
      [
        { id: "A1", status: "APPROVED", item_reference: "ING-1", difference: -1 },
        { id: "A2", status: "APPROVED", item_reference: "ING-2", difference: 2 },
        { id: "A3", status: "APPROVED", item_reference: "ING-3", difference: 3 },
        { id: "P1", status: "PENDING", item_reference: "ING-4", difference: 4 },
      ],
      [
        { reference_id: "A2", transaction_type: "STOCK_ADJUST", item_reference: "ING-X", quantity_change: 2 },
        { reference_id: "A3", transaction_type: "STOCK_ADJUST", item_reference: "ING-3", quantity_change: 3 },
        { reference_id: "A3", transaction_type: "STOCK_ADJUST", item_reference: "ING-3", quantity_change: 3 },
      ],
    );

    expect(result).toEqual({
      approvedCount: 3,
      missingLedgerIds: ["A1"],
      duplicateLedgerIds: ["A3"],
      mismatchedLedgerIds: ["A2"],
    });
  });
});
