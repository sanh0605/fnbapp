import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

import { buildPurchaseReceipt } from "../lib/purchase-ledger-rebuild";

type PlannedReceipt = {
  id: string;
  transaction_type: "PO_RECEIPT";
  reference_id: string;
  item_reference: string;
  quantity_change: string;
  unit_cost: string;
  created_at: string;
};

function parseCsvArg(name: string): Set<string> {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  if (!arg) return new Set();
  return new Set(arg.slice(prefix.length).split(",").map(value => value.trim()).filter(Boolean));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const scopedPoIds = parseCsvArg("po");
  const scopedItemIds = parseCsvArg("item");

  const { findAllNoCache, insertMany, removeMany } = await import("../lib/sheets_db");
  console.log(`Loading tables to ${apply ? "apply" : "dry-run"} PO ledger reprocess...`);

  const [poHeaders, poLines, purchasedItems, conversions, ledger] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("UOM_Conversions"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const ledgerToInsert: PlannedReceipt[] = [];
  const ledgerIdsToRemove = new Set<string>();
  const skipped: string[] = [];
  let processedLines = 0;

  for (const po of poHeaders as any[]) {
    if (po.status !== "COMPLETED") continue;
    if (scopedPoIds.size > 0 && !scopedPoIds.has(po.id)) continue;

    const effectiveDate = po.transaction_date || po.created_at;
    const lines = (poLines as any[]).filter(line => {
      if (line.po_id !== po.id) return false;
      if (scopedItemIds.size > 0 && !scopedItemIds.has(line.purchased_item_id)) return false;
      return true;
    });
    if (lines.length === 0) continue;

    for (const line of lines) {
      const item = (purchasedItems as any[]).find(p => p.id === line.purchased_item_id);
      if (!item) {
        skipped.push(`${po.id}/${line.id}: missing purchased item ${line.purchased_item_id}`);
        continue;
      }

      try {
        const receipt = buildPurchaseReceipt({
          po,
          line,
          item,
          conversions: conversions as any[],
        });
        const oldEntries = (ledger as any[]).filter(entry =>
          entry.reference_id === po.id &&
          entry.transaction_type === "PO_RECEIPT" &&
          entry.item_reference === receipt.item_reference,
        );
        oldEntries.forEach(entry => ledgerIdsToRemove.add(entry.id));
        ledgerToInsert.push({
          id: `STK-GEN-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          transaction_type: "PO_RECEIPT",
          reference_id: po.id,
          item_reference: receipt.item_reference,
          quantity_change: String(receipt.quantity_change),
          unit_cost: String(receipt.unit_cost),
          created_at: effectiveDate,
        });
        processedLines++;
      } catch (error: any) {
        skipped.push(`${po.id}/${line.id}: ${error?.message || String(error)}`);
      }
    }
  }

  console.log("\n=== PO LEDGER REPROCESS PLAN ===");
  console.log(`Mode:              ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Processed lines:   ${processedLines}`);
  console.log(`Ledger removals:   ${ledgerIdsToRemove.size}`);
  console.log(`Ledger inserts:    ${ledgerToInsert.length}`);
  console.log(`Skipped lines:     ${skipped.length}`);
  if (scopedPoIds.size > 0) console.log(`PO scope:          ${[...scopedPoIds].join(", ")}`);
  if (scopedItemIds.size > 0) console.log(`Item scope:        ${[...scopedItemIds].join(", ")}`);

  if (skipped.length > 0) {
    console.log("\nSkipped:");
    skipped.slice(0, 50).forEach((line, index) => console.log(`${index + 1}. ${line}`));
  }

  console.log("\nSample inserts:");
  ledgerToInsert.slice(0, 20).forEach((entry, index) => {
    console.log(
      `${index + 1}. po=${entry.reference_id} item=${entry.item_reference} qty=${entry.quantity_change} unit_cost=${entry.unit_cost}`,
    );
  });

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply to write this plan.");
    return;
  }
  if (skipped.length > 0) {
    throw new Error("Refusing to apply while skipped lines exist.");
  }

  if (ledgerIdsToRemove.size > 0) {
    await removeMany("Stock_Ledger", [...ledgerIdsToRemove]);
  }
  if (ledgerToInsert.length > 0) {
    await insertMany("Stock_Ledger", ledgerToInsert);
  }
  console.log("\nPO Stock_Ledger rows reprocessed successfully.");
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
