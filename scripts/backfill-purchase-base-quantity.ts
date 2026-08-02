import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Task 2 (2026-08-02 issue-based-cogs plan A).
 *
 * Backfills purchase_order_lines.base_quantity for the 95 (of 137) lines
 * that carry 0. The conversion was applied correctly when each PO_RECEIPT
 * row was written to the stock ledger; only the write-back to the line was
 * skipped. Issue-based costing reads the line, so the line has to carry it.
 *
 * Writes base_quantity directly via a targeted update -- never through
 * savePurchaseOrderAtomic/buildPurchaseOrderWritePlan, which would delete
 * and re-insert that order's PO_RECEIPT ledger rows with new ids as a side
 * effect. This script changes exactly one column on exactly the rows named.
 *
 * Every computed value is checked against the PO_RECEIPT row(s) already in
 * the ledger for that (purchase_order_id, item_reference) pair before
 * anything is written. Grouped rather than matched 1:1 by line, because the
 * ledger does not guarantee a stable per-line ordering when a PO has more
 * than one line for the same item -- summing both sides of the same group
 * is equivalent and order-independent.
 *
 * Dry-run by default. --apply required to write.
 */

import { resolveConversion, getPurchasedItemId, type RawPurchaseOrderLine, type RawConversion } from "../lib/purchase-ledger-audit";
import { computeBaseQuantity } from "../lib/purchase-line-base-quantity";

type Line = RawPurchaseOrderLine & { base_quantity?: string | number };
type PurchasedItem = { id: string; base_ingredient_id?: string };
type LedgerEntry = {
  reference_id?: string;
  transaction_type?: string;
  item_reference?: string;
  quantity_change?: string | number;
};

function groupKey(poId: string, itemReference: string): string {
  return `${poId}::${itemReference}`;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, update } = await import("../lib/sheets_db");

  const [lines, conversions, purchasedItems, ledger] = await Promise.all([
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("UOM_Conversions"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("Stock_Ledger"),
  ]) as [Line[], RawConversion[], PurchasedItem[], LedgerEntry[]];

  const conversionMap = new Map(conversions.map(c => [c.id, c]));
  const itemMap = new Map(purchasedItems.map(i => [i.id, i]));

  const zeroLines = lines.filter(line => !(Number(line.base_quantity) > 0));
  const distinctItems = new Set(zeroLines.map(getPurchasedItemId));
  const withConversionId = zeroLines.filter(line => String(line.conversion_id || "").trim());
  const money = zeroLines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);

  console.log(`Lines with base_quantity = 0 : ${zeroLines.length}`);
  console.log(`Money on those lines          : ${money.toLocaleString("vi-VN")}đ`);
  console.log(`Distinct purchased items      : ${distinctItems.size}`);
  console.log(`Lines with a conversion_id    : ${withConversionId.length}`);

  type Resolved = { line: Line; itemReference: string; baseQuantity: number };
  const resolved: Resolved[] = [];
  const unresolved: string[] = [];

  for (const line of zeroLines) {
    const purchasedItemId = getPurchasedItemId(line);
    const item = itemMap.get(purchasedItemId);
    if (!item) {
      unresolved.push(`${line.id}: purchased item ${purchasedItemId} not found`);
      continue;
    }
    const conversion = resolveConversion(line, conversions, conversionMap);
    if (conversion.kind !== "resolved" && conversion.kind !== "safe_backfill") {
      unresolved.push(`${line.id}: conversion ${conversion.kind}`);
      continue;
    }
    try {
      const baseQuantity = computeBaseQuantity(line, conversion.conversion);
      const itemReference = item.base_ingredient_id || purchasedItemId;
      resolved.push({ line, itemReference, baseQuantity });
    } catch (error) {
      unresolved.push(`${line.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (unresolved.length > 0) {
    console.error(`\nABORT: ${unresolved.length} line(s) could not be resolved:`);
    unresolved.forEach(msg => console.error(`  ${msg}`));
    process.exit(1);
  }

  // Group both sides by (purchase_order_id, item_reference) and compare sums --
  // order-independent, matches how PO_RECEIPT rows accumulate for a PO/item.
  const expectedByGroup = new Map<string, number>();
  for (const { line, itemReference, baseQuantity } of resolved) {
    const key = groupKey(line.purchase_order_id || "", itemReference);
    expectedByGroup.set(key, (expectedByGroup.get(key) || 0) + baseQuantity);
  }

  const actualByGroup = new Map<string, number>();
  for (const entry of ledger) {
    if (entry.transaction_type !== "PO_RECEIPT") continue;
    const key = groupKey(entry.reference_id || "", entry.item_reference || "");
    if (!expectedByGroup.has(key)) continue;
    actualByGroup.set(key, (actualByGroup.get(key) || 0) + (Number(entry.quantity_change) || 0));
  }

  const mismatches: string[] = [];
  for (const [key, expected] of expectedByGroup) {
    const actual = actualByGroup.get(key) || 0;
    if (Math.abs(expected - actual) > 0.0001) {
      mismatches.push(`${key}: computed=${expected} ledger=${actual}`);
    }
  }

  console.log(`Ledger mismatches             : ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.error("\nABORT: computed base_quantity does not match the ledger for:");
    mismatches.forEach(msg => console.error(`  ${msg}`));
    process.exit(1);
  }

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Rows to update: ${resolved.length}`);
  resolved.slice(0, 10).forEach(({ line, baseQuantity }) =>
    console.log(`  ${line.id} base_quantity := ${baseQuantity}`),
  );
  if (resolved.length > 10) console.log(`  ... and ${resolved.length - 10} more`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write.");
    return;
  }

  let written = 0;
  for (const { line, baseQuantity } of resolved) {
    await update("Purchase_Order_Lines", line.id, { base_quantity: baseQuantity });
    written += 1;
  }
  console.log(`\nUpdated ${written} rows.`);

  const after = (await findAllNoCache("Purchase_Order_Lines")) as Line[];
  const remaining = after.filter(line => !(Number(line.base_quantity) > 0)).length;
  console.log(`Rows still carrying 0 after apply: ${remaining}`);
  if (remaining !== 0) {
    console.error("ABORT: rows still carry 0. Investigate before continuing.");
    process.exit(1);
  }
}

main().catch(error => {
  console.error("FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
