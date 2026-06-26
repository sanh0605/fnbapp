import * as dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { diagnoseNegativeStock } from "../lib/negative-stock-resolution";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const TARGET_ITEM_IDS = ["BTP-008", "BTP-003", "BTP-010", "BTP-002", "BTP-011", "ING-015"];
const OUTPUT_PATH = "docs/audits/2026-06-26-negative-stock-diagnosis.json";

function fmtQty(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [ledger, baseIngredients, semiProducts, units] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Units"),
  ]);

  const diagnosis = diagnoseNegativeStock({
    targetItemIds: TARGET_ITEM_IDS,
    ledger: ledger as any[],
    baseIngredients: baseIngredients as any[],
    semiProducts: semiProducts as any[],
    units: units as any[],
  });

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(diagnosis, null, 2)}\n`, "utf8");

  const byClassification = new Map<string, number>();
  for (const item of diagnosis.items) {
    byClassification.set(item.classification, (byClassification.get(item.classification) || 0) + 1);
  }

  console.log("=== NEGATIVE STOCK DIAGNOSIS (READ ONLY) ===");
  console.log(`Target items:       ${TARGET_ITEM_IDS.length}`);
  console.log(`Negative items:     ${diagnosis.items.length}`);
  console.log(`Output:             ${OUTPUT_PATH}`);
  console.log(`Classifications:    ${JSON.stringify(Object.fromEntries(byClassification.entries()))}`);

  for (const item of diagnosis.items) {
    console.log([
      item.itemId,
      item.itemName,
      item.itemType,
      `balance=${fmtQty(item.balance)} ${item.unitName}`,
      `classification=${item.classification}`,
      `action=${item.suggestedAction}`,
      `qty=${fmtQty(item.proposedQuantity)}`,
      `unit_cost=${item.latestKnownUnitCost}`,
    ].join(" | "));
  }

  console.log("\nNo data was written.");
}

main().catch((error: unknown) => {
  console.error("FATAL:", error);
  process.exit(1);
});
