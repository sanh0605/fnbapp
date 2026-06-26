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

function isMismatch(value: number): boolean {
  return Math.abs(Math.round(value)) > 1;
}

async function main() {
  const { getPnLDataV2 } = await import("../app/admin/reports/actions");

  const report = await getPnLDataV2({});
  const productRowsCogs = report.productProfitAnalysis.reduce((sum, row) => sum + row.cogs, 0);
  const ingredientRowsCogs = report.cogsDetails.reduce((sum, row) => sum + row.cogs, 0);
  const productDelta = productRowsCogs - report.totalCOGS;
  const ingredientDelta = ingredientRowsCogs - report.totalCOGS;

  console.log("=== P&L MAC CONSISTENCY AUDIT (READ ONLY) ===");
  console.log(`Orders:                 ${report.orderCount}`);
  console.log(`Total COGS:             ${fmtMoney(report.totalCOGS)}`);
  console.log(`Product/topping COGS:   ${fmtMoney(productRowsCogs)} | delta ${fmtDelta(productDelta)}`);
  console.log(`Ingredient COGS:        ${fmtMoney(ingredientRowsCogs)} | delta ${fmtDelta(ingredientDelta)}`);
  console.log(`Product rows:           ${report.productProfitAnalysis.length}`);
  console.log(`Ingredient rows:        ${report.cogsDetails.length}`);

  if (isMismatch(productDelta) || isMismatch(ingredientDelta)) {
    console.log("\nMismatch detected.");
    process.exitCode = 1;
    return;
  }

  console.log("\nNo P&L MAC consistency mismatches detected.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
