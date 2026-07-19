export type PurchaseOrderRow = {
  id: string;
  po_no?: string;
  status: string;
};

export type PurchaseOrderLineRow = {
  purchase_order_id: string;
  quantity: number | string;
};

export type StockLedgerRow = {
  transaction_type: string;
  reference_id: string;
};

export type MismatchSample = {
  id: string;
  poNo: string;
  lineCount: number;
  expectedLedger: number;
  actualLedger: number;
};

export function groupLinesByPurchaseOrder(
  lines: readonly PurchaseOrderLineRow[],
): Map<string, PurchaseOrderLineRow[]> {
  const linesByPo = new Map<string, PurchaseOrderLineRow[]>();
  for (const line of lines) {
    const rows = linesByPo.get(line.purchase_order_id) || [];
    rows.push(line);
    linesByPo.set(line.purchase_order_id, rows);
  }
  return linesByPo;
}

export function groupPoReceiptLedgerByPurchaseOrder(
  ledger: readonly StockLedgerRow[],
): Map<string, StockLedgerRow[]> {
  const ledgerByPo = new Map<string, StockLedgerRow[]>();
  for (const row of ledger) {
    if (row.transaction_type !== "PO_RECEIPT") continue;
    const rows = ledgerByPo.get(row.reference_id) || [];
    rows.push(row);
    ledgerByPo.set(row.reference_id, rows);
  }
  return ledgerByPo;
}

// Expected: 1 ledger entry per PO line that has quantity > 0.
export function countExpectedLedgerEntries(lines: readonly PurchaseOrderLineRow[]): number {
  return lines.filter(l => Number(l.quantity) > 0).length;
}

export function checkCompletedPoLedger(
  completedPos: readonly PurchaseOrderRow[],
  linesByPo: Map<string, PurchaseOrderLineRow[]>,
  ledgerByPo: Map<string, StockLedgerRow[]>,
): { missingLedger: number; ledgerLinesMismatch: number; mismatchSamples: MismatchSample[] } {
  let missingLedger = 0;
  let ledgerLinesMismatch = 0;
  const mismatchSamples: MismatchSample[] = [];

  for (const po of completedPos) {
    const lines = linesByPo.get(po.id) || [];
    const ledgerRows = ledgerByPo.get(po.id) || [];
    if (ledgerRows.length === 0) {
      missingLedger++;
      continue;
    }
    const expectedLedgerCount = countExpectedLedgerEntries(lines);
    if (ledgerRows.length !== expectedLedgerCount) {
      ledgerLinesMismatch++;
      if (mismatchSamples.length < 5) {
        mismatchSamples.push({
          id: po.id,
          poNo: po.po_no || "",
          lineCount: lines.length,
          expectedLedger: expectedLedgerCount,
          actualLedger: ledgerRows.length,
        });
      }
    }
  }

  return { missingLedger, ledgerLinesMismatch, mismatchSamples };
}
