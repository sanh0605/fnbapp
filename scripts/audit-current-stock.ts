import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type StockRow = {
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
};

type ItemRow = {
  id?: string;
  name?: string;
  base_unit?: string;
  is_non_inventory?: string | boolean;
};

function fmt(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

function isNonInventory(item?: ItemRow): boolean {
  return item?.is_non_inventory === true || item?.is_non_inventory === "TRUE";
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [ledger, baseIngredients, semiProducts, units] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Units"),
  ]);

  const itemById = new Map<string, ItemRow & { item_type: string }>();
  for (const item of baseIngredients as ItemRow[]) {
    if (item.id) itemById.set(item.id, { ...item, item_type: "BASE_INGREDIENT" });
  }
  for (const item of semiProducts as ItemRow[]) {
    if (item.id) itemById.set(item.id, { ...item, item_type: "SEMI_PRODUCT" });
  }

  const unitById = new Map((units as any[]).map(unit => [unit.id, unit.name || unit.id]));
  const balanceByItem = new Map<string, number>();
  const typeTotalsByItem = new Map<string, Map<string, number>>();
  const unknownRows: StockRow[] = [];

  for (const row of ledger as StockRow[]) {
    const itemId = row.item_reference || "";
    if (!itemId) continue;

    const qty = Number(row.quantity_change || 0);
    balanceByItem.set(itemId, (balanceByItem.get(itemId) || 0) + qty);

    const typeMap = typeTotalsByItem.get(itemId) || new Map<string, number>();
    const type = row.transaction_type || "(blank)";
    typeMap.set(type, (typeMap.get(type) || 0) + qty);
    typeTotalsByItem.set(itemId, typeMap);

    if (!itemById.has(itemId)) unknownRows.push(row);
  }

  const rows = [...balanceByItem.entries()]
    .map(([itemId, balance]) => {
      const item = itemById.get(itemId);
      const unitName = unitById.get(item?.base_unit || "") || item?.base_unit || "";
      const typeMap = typeTotalsByItem.get(itemId) || new Map<string, number>();
      return {
        itemId,
        name: item?.name || itemId,
        itemType: item?.item_type || "UNKNOWN",
        unitName,
        balance,
        nonInventory: isNonInventory(item),
        transactionSummary: [...typeMap.entries()]
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .map(([type, qty]) => `${type}:${fmt(qty)}`)
          .join(" | "),
      };
    })
    .filter(row => !row.nonInventory);

  const negative = rows.filter(row => row.balance < -0.000001).sort((a, b) => a.balance - b.balance);
  const positive = rows.filter(row => row.balance > 0.000001).sort((a, b) => b.balance - a.balance);
  const zero = rows.length - negative.length - positive.length;

  console.log("=== CURRENT STOCK AUDIT (READ ONLY) ===");
  console.log(`Ledger rows:       ${(ledger as any[]).length}`);
  console.log(`Tracked items:     ${rows.length}`);
  console.log(`Positive stock:    ${positive.length}`);
  console.log(`Zero stock:        ${zero}`);
  console.log(`Negative stock:    ${negative.length}`);
  console.log(`Unknown item refs: ${unknownRows.length}`);

  if (negative.length > 0) {
    console.log("\nTop negative balances:");
    for (const row of negative.slice(0, 50)) {
      console.log([
        row.itemId,
        row.name,
        row.itemType,
        `stock=${fmt(row.balance)} ${row.unitName}`,
        row.transactionSummary,
      ].join(" | "));
    }
  }

  if (unknownRows.length > 0) {
    console.log("\nUnknown item reference examples:");
    for (const row of unknownRows.slice(0, 20)) {
      console.log(JSON.stringify(row));
    }
  }

  console.log("\nNo data was written.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
