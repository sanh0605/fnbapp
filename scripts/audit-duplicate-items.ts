import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only diagnostic for the duplicate purchased-item hypothesis: an
 * ingredient purchased under one item id but consumed by recipes under a
 * different id with the same real-world name. Purchased and consumed
 * quantity per item are both derivable from Stock_Ledger alone
 * (PO_RECEIPT rows for purchases; SALES_CONSUME/PRODUCTION_CONSUME/
 * EDIT_CONSUME rows for recipe-driven consumption), so Recipes is not
 * read here.
 */

function fmt(value: number): string {
  return Number(value.toFixed(2)).toLocaleString("vi-VN");
}

async function main() {
  const { auditDuplicateItems } = await import("../lib/duplicate-item-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log("Loading data...");
  const [ledger, baseIngredients, semiProducts] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const nameById = new Map<string, string>();
  for (const i of baseIngredients) nameById.set(i.id, i.name);
  for (const s of semiProducts) nameById.set(s.id, s.name);
  const nameOf = (id: string) => nameById.get(id) || id;
  const itemIds = [...baseIngredients.map((i: any) => i.id), ...semiProducts.map((s: any) => s.id)];

  const purchasedByItem = new Map<string, number>();
  const consumedByItem = new Map<string, number>();
  const CONSUME_TYPES = new Set(["SALES_CONSUME", "PRODUCTION_CONSUME", "EDIT_CONSUME"]);
  for (const row of ledger) {
    const qty = Number(row.quantity_change) || 0;
    if (row.transaction_type === "PO_RECEIPT") {
      purchasedByItem.set(row.item_reference, (purchasedByItem.get(row.item_reference) || 0) + Math.max(0, qty));
    } else if (CONSUME_TYPES.has(row.transaction_type)) {
      consumedByItem.set(row.item_reference, (consumedByItem.get(row.item_reference) || 0) + Math.abs(qty));
    }
  }

  const result = auditDuplicateItems({ itemIds, nameOf, purchasedByItem, consumedByItem });

  console.log("\n=== DUPLICATE PURCHASED-ITEM DIAGNOSTIC (READ ONLY) ===");
  console.log(`Items checked: ${itemIds.length}`);
  console.log(`\nConsumed with zero purchase history: ${result.consumedNeverPurchased.length}`);
  for (const r of result.consumedNeverPurchased) {
    console.log(`  ${r.item_name} (${r.item}): consumed=${fmt(r.consumed_qty)}`);
  }
  console.log(`\nPurchased but never consumed by any recipe: ${result.purchasedNeverConsumed.length}`);
  for (const r of result.purchasedNeverConsumed) {
    console.log(`  ${r.item_name} (${r.item}): purchased=${fmt(r.purchased_qty)}`);
  }
  console.log(`\nName-twin id pairs (duplicate-record signature): ${result.nameTwins.length}`);
  for (const t of result.nameTwins) {
    console.log(`  "${t.consumedItem.item_name}" -- consumed under ${t.consumedItem.item}, purchased under ${t.purchasedItem.item}`);
  }

  const dateStamp = "2026-07-29";
  const outPath = path.resolve(process.cwd(), `docs/audits/${dateStamp}-duplicate-item-diagnostic.json`);
  fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), ...result }, null, 2));
  console.log(`\nFull report written to ${outPath}`);
  console.log("No data was written.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
