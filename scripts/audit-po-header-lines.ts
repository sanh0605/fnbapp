import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmt(value: number): string {
  return Number(value.toFixed(2)).toLocaleString("vi-VN");
}

async function main() {
  const { auditPurchaseOrderHeaderLines } = await import("../lib/po-header-lines-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [orders, lines] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
  ]) as any[][];

  const result = auditPurchaseOrderHeaderLines(orders, lines);

  console.log("=== PO HEADER vs LINES SUBTOTAL AUDIT (READ ONLY) ===");
  console.log(`Purchase orders compared: ${result.orderCount}`);
  console.log(`Mismatches:               ${result.mismatchCount}`);

  const totalDelta = result.mismatches.reduce((sum, row) => sum + row.delta, 0);
  console.log(`Total delta (VND):        ${fmt(totalDelta)}`);

  for (const row of result.mismatches) {
    console.log([
      row.po_id,
      `status=${row.status}`,
      `date=${row.transaction_date}`,
      `header=${fmt(row.header_subtotal)}`,
      `lines=${fmt(row.lines_subtotal)}`,
      `delta=${fmt(row.delta)}`,
      `line_count=${row.line_count}`,
    ].join(" | "));
  }

  console.log("\nNo data was written.");
  if (result.mismatchCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
