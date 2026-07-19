import { describe, expect, it } from "vitest";
import {
  checkCompletedPoLedger,
  countExpectedLedgerEntries,
  groupLinesByPurchaseOrder,
  groupPoReceiptLedgerByPurchaseOrder,
} from "./audit-po-save-ledger-core";

describe("audit-po-save-ledger core", () => {
  it("groups purchase order lines by purchase_order_id (the real schema column)", () => {
    const linesByPo = groupLinesByPurchaseOrder([
      { purchase_order_id: "PO-001", quantity: 5 },
      { purchase_order_id: "PO-001", quantity: 3 },
      { purchase_order_id: "PO-002", quantity: 2 },
    ]);
    expect(linesByPo.get("PO-001")).toHaveLength(2);
    expect(linesByPo.get("PO-002")).toHaveLength(1);
  });

  it("only groups PO_RECEIPT ledger rows, keyed by reference_id", () => {
    const ledgerByPo = groupPoReceiptLedgerByPurchaseOrder([
      { transaction_type: "PO_RECEIPT", reference_id: "PO-001" },
      { transaction_type: "SALES_CONSUME", reference_id: "PO-001" },
      { transaction_type: "PO_RECEIPT", reference_id: "PO-002" },
    ]);
    expect(ledgerByPo.get("PO-001")).toHaveLength(1);
    expect(ledgerByPo.get("PO-002")).toHaveLength(1);
  });

  it("counts only lines with a positive quantity as expected ledger entries", () => {
    expect(countExpectedLedgerEntries([
      { purchase_order_id: "PO-001", quantity: 5 },
      { purchase_order_id: "PO-001", quantity: 0 },
      { purchase_order_id: "PO-001", quantity: -1 },
      { purchase_order_id: "PO-001", quantity: "3" },
    ])).toBe(2);
  });

  it("does not flag a completed PO whose ledger count matches its line count (the regression this fixes)", () => {
    const completedPos = [{ id: "PO-001", po_no: "PO-001", status: "COMPLETED" }];
    const linesByPo = groupLinesByPurchaseOrder([
      { purchase_order_id: "PO-001", quantity: 5 },
      { purchase_order_id: "PO-001", quantity: 3 },
    ]);
    const ledgerByPo = groupPoReceiptLedgerByPurchaseOrder([
      { transaction_type: "PO_RECEIPT", reference_id: "PO-001" },
      { transaction_type: "PO_RECEIPT", reference_id: "PO-001" },
    ]);
    const result = checkCompletedPoLedger(completedPos, linesByPo, ledgerByPo);
    expect(result.missingLedger).toBe(0);
    expect(result.ledgerLinesMismatch).toBe(0);
  });

  it("still flags a completed PO with zero ledger rows as missing", () => {
    const completedPos = [{ id: "PO-002", po_no: "PO-002", status: "COMPLETED" }];
    const linesByPo = groupLinesByPurchaseOrder([{ purchase_order_id: "PO-002", quantity: 1 }]);
    const ledgerByPo = groupPoReceiptLedgerByPurchaseOrder([]);
    const result = checkCompletedPoLedger(completedPos, linesByPo, ledgerByPo);
    expect(result.missingLedger).toBe(1);
    expect(result.ledgerLinesMismatch).toBe(0);
  });

  it("still flags a genuine count mismatch and includes it in the sample", () => {
    const completedPos = [{ id: "PO-003", po_no: "PO-003", status: "COMPLETED" }];
    const linesByPo = groupLinesByPurchaseOrder([
      { purchase_order_id: "PO-003", quantity: 1 },
      { purchase_order_id: "PO-003", quantity: 1 },
    ]);
    const ledgerByPo = groupPoReceiptLedgerByPurchaseOrder([
      { transaction_type: "PO_RECEIPT", reference_id: "PO-003" },
    ]);
    const result = checkCompletedPoLedger(completedPos, linesByPo, ledgerByPo);
    expect(result.missingLedger).toBe(0);
    expect(result.ledgerLinesMismatch).toBe(1);
    expect(result.mismatchSamples).toEqual([
      { id: "PO-003", poNo: "PO-003", lineCount: 2, expectedLedger: 2, actualLedger: 1 },
    ]);
  });
});
