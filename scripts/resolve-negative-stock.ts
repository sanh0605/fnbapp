import * as dotenv from "dotenv";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import {
  planNegativeStockResolution,
  type NegativeStockDiagnosis,
  type LedgerRow,
} from "../lib/negative-stock-resolution";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const DIAGNOSIS_PATH = "docs/audits/2026-06-26-negative-stock-diagnosis.json";

function fmtQty(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const diagnosis = JSON.parse(readFileSync(DIAGNOSIS_PATH, "utf8")) as NegativeStockDiagnosis;
  const { findAllNoCache, insertMany } = await import("../lib/sheets_db");
  const ledger = await findAllNoCache("Stock_Ledger") as LedgerRow[];

  const plan = planNegativeStockResolution({
    diagnosis,
    ledger,
    now: new Date().toISOString(),
    idSeed: crypto.randomUUID().slice(0, 8),
  });

  console.log(`=== RESOLVE NEGATIVE STOCK (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`Diagnosis:       ${DIAGNOSIS_PATH}`);
  console.log(`Reference:       ${plan.referenceId}`);
  console.log(`Changes needed:  ${plan.changesNeeded}`);
  console.log(`Rows to insert:  ${plan.rowsToInsert.length}`);

  for (const row of plan.rowsToInsert) {
    const diagnosisItem = diagnosis.items.find(item => item.itemId === row.item_reference);
    console.log([
      row.item_reference,
      diagnosisItem?.itemName || row.item_reference,
      `type=${row.transaction_type}`,
      `qty=+${fmtQty(Number(row.quantity_change || 0))} ${diagnosisItem?.unitName || ""}`,
      `unit_cost=${row.unit_cost || 0}`,
      `old_balance=${fmtQty(diagnosisItem?.balance || 0)}`,
    ].join(" | "));
  }

  if (plan.skipped.length > 0) {
    console.log("\nSkipped:");
    for (const row of plan.skipped) {
      console.log(`${row.itemId} | ${row.reason}`);
    }
  }

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply after Claude/user approval.");
    return;
  }

  if (plan.rowsToInsert.length === 0) {
    console.log("\n0 changes needed. No data was written.");
    return;
  }

  await insertMany("Stock_Ledger", plan.rowsToInsert);
  console.log(`\nInserted ${plan.rowsToInsert.length} Stock_Ledger rows.`);
}

main().catch((error: unknown) => {
  console.error("FATAL:", error);
  process.exit(1);
});
