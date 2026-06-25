import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const TRANSITION_START = new Date("2026-05-13T00:00:00+07:00").getTime();

function norm(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [baseIngredients, semiProducts, ledger, poLines, purchasedItems] = await Promise.all([
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
  ]);

  const matchesName = (row: any) =>
    row.id === "SPM-027" ||
    row.id === "ING-022" ||
    row.base_ingredient === "ING-022" ||
    row.base_ingredient_id === "ING-022" ||
    row.raw_material_id === "ING-022" ||
    norm(row.name).includes("nuoc duong") ||
    norm(row.name).includes("glofood");
  const matchesSugarName = (row: any) => norm(row.name).includes("duong") || norm(row.name).includes("glofood");
  const baseMatches = (baseIngredients as any[]).filter(matchesName);
  const semiMatches = (semiProducts as any[]).filter((row: any) => matchesName(row) || row.id === "BTP-004");
  const purchasedMatches = (purchasedItems as any[]).filter(matchesName);

  console.log("=== WATER SUGAR ITEM MATCHES ===");
  console.log("Base_Ingredients:");
  console.table(baseMatches.map((row: any) => pick(row, ["id", "name", "base_unit", "status", "non_inventory"])));
  console.log("Semi_Products:");
  console.table(semiMatches.map((row: any) => pick(row, ["id", "name", "base_unit", "batch_yield", "status"])));
  console.log("Purchased_Items:");
  console.table(purchasedMatches.map((row: any) => pick(row, ["id", "name", "default_unit", "base_ingredient_id", "status"])));

  console.log("\nAll sugar-like Base_Ingredients:");
  console.table((baseIngredients as any[]).filter(matchesSugarName).map((row: any) => pick(row, ["id", "name", "base_unit", "status", "non_inventory"])));
  console.log("All sugar-like Purchased_Items:");
  console.table((purchasedItems as any[]).filter(matchesSugarName).map((row: any) => pick(row, ["id", "name", "default_unit", "base_ingredient_id", "status"])));

  const candidateIds = new Set<string>([
    "BTP-004",
    ...baseMatches.map((row: any) => row.id),
    ...purchasedMatches.map((row: any) => row.base_ingredient_id || row.base_ingredient || row.raw_material_id).filter(Boolean),
    "ING-022",
  ]);

  console.log("\n=== LEDGER FROM 2026-05-13 FOR CANDIDATES ===");
  for (const id of candidateIds) {
    const rows = (ledger as any[]).filter((row: any) => {
      const at = new Date(row.created_at || row.transaction_date || 0).getTime();
      return row.item_reference === id && at >= TRANSITION_START;
    });
    const net = rows.reduce((sum: number, row: any) => sum + Number(row.quantity_change || 0), 0);
    console.log(`${id}: rows=${rows.length}, net=${net}`);
    console.table(rows.slice(0, 20).map((row: any) => pick(row, [
      "id",
      "created_at",
      "transaction_type",
      "reference_id",
      "item_reference",
      "quantity_change",
      "unit_cost",
      "source",
    ])));
  }

  console.log("\n=== PO LINES FOR WATER SUGAR PURCHASED ITEMS ===");
  const purchasedIds = new Set(purchasedMatches.map((row: any) => row.id));
  const matchingPoLines = (poLines as any[]).filter((row: any) => purchasedIds.has(row.purchased_item_id));
  console.table(matchingPoLines.map((row: any) => pick(row, [
    "id",
    "purchase_order_id",
    "purchased_item_id",
    "quantity",
    "unit_price",
    "conversion_rate",
    "conversion_id",
  ])));
}

function pick(row: any, keys: string[]) {
  return Object.fromEntries(keys.map(key => [key, row[key] ?? ""]));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
