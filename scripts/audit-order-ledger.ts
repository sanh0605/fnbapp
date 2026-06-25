import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmt(value: number): string {
  return Number(value.toFixed(6)).toString();
}

async function main() {
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [orders, lines, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const report = auditOrderLedger({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
  });

  console.log("=== ORDER LEDGER AUDIT (READ ONLY) ===");
  console.log(`Orders:             ${report.orderCount}`);
  console.log(`Lines:              ${report.lineCount}`);
  console.log(`Ledger rows:        ${report.ledgerRowCount}`);
  console.log(`Mismatches:         ${report.mismatches.length}`);
  console.log(`Orphan ledger rows: ${report.orphanLedgerRows.length}`);

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

  console.log("\nNo data was written.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
