import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmt(value: number): string {
  return Number(value.toFixed(6)).toString();
}

async function main() {
  const { auditInventoryBalances } = await import("../lib/inventory-balance-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [ledger, balances] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Inventory_Balances"),
  ]) as any[][];

  const result = auditInventoryBalances(ledger, balances);

  console.log("=== INVENTORY BALANCE DRIFT AUDIT (READ ONLY) ===");
  console.log(`Items compared:     ${result.itemCount}`);
  console.log(`Mismatches:         ${result.mismatchCount}`);

  for (const row of result.mismatches.slice(0, 20)) {
    console.log([
      row.item_reference,
      `reason=${row.reason}`,
      `expected=${fmt(row.expected)}`,
      `actual=${fmt(row.actual)}`,
      `delta=${fmt(row.delta)}`,
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
