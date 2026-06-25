import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

function printRows<T>(title: string, rows: T[], render: (row: T, index: number) => string): void {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("  Không có.");
    return;
  }
  rows.forEach((row, index) => console.log(render(row, index)));
}

async function main() {
  const { auditCogsDrift } = await import("../lib/cogs-drift-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  console.log("Loading COGS audit data...");
  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  const report = auditCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });

  console.log("\n=== COGS DRIFT AUDIT (READ ONLY) ===");
  console.log("NOTE: FIFO là informational audit only sau MAC migration (Phase 5A).");
  console.log("      MAC là primary COGS contract — chạy scripts/audit-mac-cogs-drift.ts để verify primary.");
  console.log("      Mismatches FIFO bên dưới KHÔNG phải bug nếu MAC drift = 0.\n");
  console.log(`Eligible orders:       ${report.eligibleOrderCount}`);
  console.log(`Eligible lines:        ${report.eligibleLineCount}`);
  console.log(`Mismatched orders:     ${report.mismatchedOrderCount}`);
  console.log(`Mismatched lines:      ${report.mismatchedLineCount}`);
  console.log(`Stored COGS:           ${formatVnd(report.totalStoredCogs)}`);
  console.log(`Expected FIFO COGS:    ${formatVnd(report.totalExpectedCogs)}`);
  console.log(`Delta:                 ${formatVnd(report.totalDelta)}`);

  printRows("Top mismatched orders", report.orderMismatches.slice(0, 20), (row, index) =>
    [
      `${index + 1}. ${row.order_no || row.order_id}`,
      `created=${row.created_at}`,
      `lines=${row.line_count}`,
      `bad_lines=${row.mismatched_line_count}`,
      `stored=${formatVnd(row.stored_cogs)}`,
      `fifo=${formatVnd(row.expected_cogs)}`,
      `delta=${formatVnd(row.delta)}`,
    ].join(" | "),
  );

  printRows("Top mismatched lines", report.lineMismatches.slice(0, 30), (row, index) =>
    [
      `${index + 1}. ${row.order_no || row.order_id}`,
      `line=${row.line_id}`,
      `product=${row.product_id}`,
      `variant=${row.variant_id}`,
      `qty=${row.qty}`,
      `stored=${formatVnd(row.stored_cost)}`,
      `fifo=${formatVnd(row.expected_cost)}`,
      `delta=${formatVnd(row.delta)}`,
    ].join(" | "),
  );

  printRows("Warnings", report.warnings.slice(0, 20), (warning, index) =>
    `${index + 1}. ${warning.type} | line=${warning.line_id || ""} | order=${warning.order_id || ""} | ${warning.message}`,
  );

  console.log("\nNo data was written.");
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
