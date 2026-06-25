import * as dotenv from "dotenv";

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

  const poById = new Map<string, any>();
  for (const po of purchaseOrders as any[]) poById.set(po.id, po);

  const linesByPo = new Map<string, any[]>();
  for (const line of poLines as any[]) {
    const rows = linesByPo.get(line.po_id) || [];
    rows.push(line);
    linesByPo.set(line.po_id, rows);
  }

  const ledgerByPo = new Map<string, any[]>();
  for (const row of ledger as any[]) {
    if (row.transaction_type !== "PO_RECEIPT") continue;
    const rows = ledgerByPo.get(row.reference_id) || [];
    rows.push(row);
    ledgerByPo.set(row.reference_id, rows);
  }

  const allPos = purchaseOrders as any[];
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

  let completedMissingLedger = 0;
  let completedLedgerLinesMismatch = 0;
  for (const po of completedPos) {
    const lines = linesByPo.get(po.id) || [];
    const ledgerRows = ledgerByPo.get(po.id) || [];
    if (ledgerRows.length === 0) {
      completedMissingLedger++;
      continue;
    }
    // Expected: 1 ledger entry per PO line that has conversion + quantity > 0
    const expectedLedgerCount = lines.filter(l => Number(l.quantity) > 0).length;
    if (ledgerRows.length !== expectedLedgerCount) {
      completedLedgerLinesMismatch++;
    }
  }
  console.log(`COMPLETED POs missing ledger (should be 0):      ${completedMissingLedger}`);
  console.log(`COMPLETED POs with ledger/line count mismatch:   ${completedLedgerLinesMismatch}`);

  let cancelledWithLedger = 0;
  for (const po of cancelledPos) {
    const ledgerRows = ledgerByPo.get(po.id) || [];
    if (ledgerRows.length > 0) cancelledWithLedger++;
  }
  console.log(`CANCELLED POs with ledger:                       ${cancelledWithLedger}`);

  // Sample mismatches
  if (completedLedgerLinesMismatch > 0) {
    console.log("\nSample mismatches:");
    let shown = 0;
    for (const po of completedPos) {
      const lines = linesByPo.get(po.id) || [];
      const ledgerRows = ledgerByPo.get(po.id) || [];
      const expected = lines.filter(l => Number(l.qty) > 0).length;
      if (ledgerRows.length !== expected && shown < 5) {
        console.log(`  ${po.id} (${po.po_no || ""}) | lines=${lines.length} expected_ledger=${expected} actual_ledger=${ledgerRows.length}`);
        shown++;
      }
    }
  }

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
