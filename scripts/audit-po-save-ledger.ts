import * as dotenv from "dotenv";
import {
  checkCompletedPoLedger,
  groupLinesByPurchaseOrder,
  groupPoReceiptLedgerByPurchaseOrder,
  type PurchaseOrderLineRow,
  type PurchaseOrderRow,
  type StockLedgerRow,
} from "./audit-po-save-ledger-core";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 2.3 — Audit PO save behavior:
 *   1. DRAFT POs should NOT write to Stock_Ledger.
 *   2. COMPLETED POs should write ledger ONCE per line.
 *   3. Updates to COMPLETED POs should not create duplicate ledger entries.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [purchaseOrders, poLines, ledger] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const linesByPo = groupLinesByPurchaseOrder(poLines as PurchaseOrderLineRow[]);
  const ledgerByPo = groupPoReceiptLedgerByPurchaseOrder(ledger as StockLedgerRow[]);

  const allPos = purchaseOrders as PurchaseOrderRow[];
  const draftPos = allPos.filter(po => po.status === "DRAFT");
  const completedPos = allPos.filter(po => po.status === "COMPLETED");
  const cancelledPos = allPos.filter(po => po.status === "CANCELLED" || po.status === "VOIDED");

  console.log("=== PO SAVE LEDGER AUDIT ===");
  console.log(`Total POs:        ${allPos.length}`);
  console.log(`  DRAFT:          ${draftPos.length}`);
  console.log(`  COMPLETED:      ${completedPos.length}`);
  console.log(`  CANCELLED/etc:  ${cancelledPos.length}`);

  let draftWithLedger = 0;
  for (const po of draftPos) {
    const ledgerRows = ledgerByPo.get(po.id) || [];
    if (ledgerRows.length > 0) draftWithLedger++;
  }
  console.log(`\nDRAFT POs with ledger (should be 0):              ${draftWithLedger}`);

  const { missingLedger, ledgerLinesMismatch, mismatchSamples } = checkCompletedPoLedger(
    completedPos,
    linesByPo,
    ledgerByPo,
  );
  console.log(`COMPLETED POs missing ledger (should be 0):      ${missingLedger}`);
  console.log(`COMPLETED POs with ledger/line count mismatch:   ${ledgerLinesMismatch}`);

  let cancelledWithLedger = 0;
  for (const po of cancelledPos) {
    const ledgerRows = ledgerByPo.get(po.id) || [];
    if (ledgerRows.length > 0) cancelledWithLedger++;
  }
  console.log(`CANCELLED POs with ledger:                       ${cancelledWithLedger}`);

  if (mismatchSamples.length > 0) {
    console.log("\nSample mismatches:");
    for (const sample of mismatchSamples) {
      console.log(
        `  ${sample.id} (${sample.poNo}) | lines=${sample.lineCount} `
          + `expected_ledger=${sample.expectedLedger} actual_ledger=${sample.actualLedger}`,
      );
    }
  }

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
