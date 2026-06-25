import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmtMoney(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")} VND`;
}

function fmtDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmtMoney(value)}`;
}

async function main() {
  const { auditMacCogsDrift } = await import("../lib/mac-cogs-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  const report = auditMacCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });

  console.log("=== MAC COGS DRIFT AUDIT (READ ONLY) ===");
  console.log(`Eligible orders:       ${report.eligibleOrderCount}`);
  console.log(`Eligible lines:        ${report.eligibleLineCount}`);
  console.log(`Mismatched lines:      ${report.mismatchedLineCount}`);
  console.log(`Stored COGS:           ${fmtMoney(report.totalStoredCogs)}`);
  console.log(`Expected MAC COGS:     ${fmtMoney(report.totalExpectedCogs)}`);
  console.log(`Delta:                 ${fmtDelta(report.totalDelta)}`);
  console.log(`Classification counts: ${JSON.stringify(report.classificationCounts)}`);

  if (report.lineMismatches.length > 0) {
    console.log("\nTop mismatched lines");
    for (const row of report.lineMismatches.slice(0, 30)) {
      console.log([
        row.order_no,
        `line=${row.line_id}`,
        `class=${row.classification}`,
        `product=${row.product_id}`,
        `variant=${row.variant_id}`,
        `qty=${row.qty}`,
        `stored=${fmtMoney(row.stored_cost)}`,
        `mac=${fmtMoney(row.expected_cost)}`,
        `delta=${fmtDelta(row.delta)}`,
      ].join(" | "));
    }
  }

  if (report.warnings.length > 0) {
    console.log("\nWarnings");
    for (const warning of report.warnings.slice(0, 20)) {
      console.log(`${warning.type} | line=${warning.line_id || ""} | order=${warning.order_id || ""} | ${warning.message}`);
    }
  }

  console.log("\nNo data was written.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
