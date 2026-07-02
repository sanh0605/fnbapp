import * as dotenv from "dotenv";
import { buildInventoryBalances } from "../lib/inventory-consumption";
import { getMacUnitCost } from "../lib/mac-cogs";
import { getPosInventoryState } from "../lib/pos-inventory-state";
import { findAllNoCache } from "../lib/sheets_db";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main(): Promise<void> {
  const asOf = new Date().toISOString();
  const ledger = await findAllNoCache("Stock_Ledger") as any[];
  const expectedBalances = buildInventoryBalances(ledger, asOf);
  const actual = await getPosInventoryState(asOf);
  const itemReferences = new Set([
    ...expectedBalances.keys(),
    ...actual.balances.keys(),
    ...actual.macUnitCosts.keys(),
  ]);

  const mismatches: Array<{
    itemReference: string;
    field: "balance" | "macUnitCost";
    expected: number;
    actual: number;
  }> = [];

  for (const itemReference of itemReferences) {
    compare(
      mismatches,
      itemReference,
      "balance",
      expectedBalances.get(itemReference) || 0,
      actual.balances.get(itemReference) || 0,
    );
    compare(
      mismatches,
      itemReference,
      "macUnitCost",
      getMacUnitCost(ledger, itemReference, asOf),
      actual.macUnitCosts.get(itemReference) || 0,
    );
  }

  console.log("=== POS INVENTORY STATE AUDIT (READ ONLY) ===");
  console.log(`As of: ${asOf}`);
  console.log(`Ledger rows: ${ledger.length}`);
  console.log(`Items checked: ${itemReferences.size}`);
  console.log(`Mismatches: ${mismatches.length}`);
  for (const mismatch of mismatches.slice(0, 20)) {
    console.log(
      `${mismatch.itemReference} ${mismatch.field}: ` +
      `expected=${mismatch.expected} actual=${mismatch.actual}`,
    );
  }
  console.log("No operational data was written.");

  if (mismatches.length > 0) process.exitCode = 1;
}

function compare(
  mismatches: Array<{
    itemReference: string;
    field: "balance" | "macUnitCost";
    expected: number;
    actual: number;
  }>,
  itemReference: string,
  field: "balance" | "macUnitCost",
  expected: number,
  actual: number,
): void {
  if (Math.abs(expected - actual) <= 0.000001) return;
  mismatches.push({ itemReference, field, expected, actual });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
