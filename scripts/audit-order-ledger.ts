import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmt(value: number): string {
  return Number(value.toFixed(6)).toString();
}

async function main() {
  const { auditFullHistoryOrderLedger } = await import("../lib/historical/full-history-ledger-audit");
  const { buildTrustedPrimitiveLedger, replayFullHistory } = await import("../lib/historical/full-history-recompute");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [
    orders,
    lines,
    ledger,
    recipes,
    semiProducts,
    purchaseOrders,
    purchaseOrderLines,
    purchasedItems,
    conversions,
  ] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("UOM_Conversions"),
  ]) as any[][];

  const { rows: trustedPrimitives, skippedPoReceipts } = buildTrustedPrimitiveLedger({
    purchaseOrders,
    purchaseOrderLines,
    purchasedItems,
    conversions,
    rawStockLedger: ledger,
  });
  const replay = replayFullHistory({
    orders,
    lines,
    recipes,
    semiProducts,
    trustedPrimitives,
  });
  const report = auditFullHistoryOrderLedger({
    orders,
    computedLedger: replay.computedLedger,
    recordedLedger: ledger,
  });

  console.log("=== FULL-HISTORY ORDER LEDGER AUDIT (READ ONLY) ===");
  console.log(`Orders:               ${report.orderCount}`);
  console.log(`Lines replayed:        ${replay.lineResults.length}`);
  console.log(`Computed ledger rows:  ${report.computedLedgerRowCount}`);
  console.log(`Recorded ledger rows:  ${report.recordedLedgerRowCount}`);
  console.log(`Replay errors:         ${replay.errors.length}`);
  console.log(`Skipped PO receipts:   ${skippedPoReceipts.length}`);
  console.log(`Quantity mismatches:   ${report.mismatches.length}`);
  console.log(`Orphan derived rows:   ${report.orphanLedgerRows.length}`);

  for (const row of report.mismatches.slice(0, 50)) {
    console.log([
      row.order_no || row.order_id,
      `status=${row.status}`,
      `item=${row.item_reference}`,
      `expected=${fmt(row.expected_quantity)}`,
      `actual=${fmt(row.actual_quantity)}`,
      `delta=${fmt(row.delta)}`,
    ].join(" | "));
  }

  if (report.orphanLedgerRows.length > 0) {
    console.log("\nTop orphan ledger rows:");
    for (const row of report.orphanLedgerRows.slice(0, 20)) {
      console.log(JSON.stringify(row));
    }
  }

  if (replay.errors.length > 0) {
    console.log("\nReplay errors:");
    for (const error of replay.errors.slice(0, 20)) console.log(error);
  }

  if (skippedPoReceipts.length > 0) {
    console.log("\nSkipped PO receipts:");
    for (const receipt of skippedPoReceipts.slice(0, 20)) console.log(receipt);
  }

  console.log("\nNo data was written.");
  if (
    replay.errors.length > 0 ||
    skippedPoReceipts.length > 0 ||
    report.mismatches.length > 0 ||
    report.orphanLedgerRows.length > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
