import * as dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

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
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, insertMany } = await import("../lib/sheets_db");

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
  for (const row of ledger as any[]) {
    const itemId = row.item_reference || "";
    if (!itemId) continue;
    balanceByItem.set(itemId, (balanceByItem.get(itemId) || 0) + Number(row.quantity_change || 0));
  }

  const now = new Date().toISOString();
  const adjustments = [...balanceByItem.entries()]
    .map(([itemId, balance]) => {
      const item = itemById.get(itemId);
      return { itemId, item, balance };
    })
    .filter(row => row.item && !isNonInventory(row.item) && row.balance < -0.000001)
    .sort((a, b) => a.balance - b.balance)
    .map(row => ({
      id: `STK-AUDIT-${crypto.randomUUID()}`,
      transaction_type: "STOCK_ADJUST",
      reference_id: `NEGATIVE-STOCK-AUDIT-${now}`,
      item_reference: row.itemId,
      quantity_change: -row.balance,
      unit_cost: 0,
      created_at: now,
      _name: row.item?.name || row.itemId,
      _unitName: unitById.get(row.item?.base_unit || "") || row.item?.base_unit || "",
      _oldBalance: row.balance,
    }));

  console.log(`=== NEGATIVE STOCK ADJUSTMENTS (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`Adjustments: ${adjustments.length}`);
  for (const row of adjustments) {
    console.log([
      row.item_reference,
      row._name,
      `old=${fmt(row._oldBalance)} ${row._unitName}`,
      `adjust=+${fmt(Number(row.quantity_change))}`,
      "new=0",
    ].join(" | "));
  }

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply after confirming these physical stock corrections.");
    return;
  }

  const rowsToInsert = adjustments.map(({ _name, _unitName, _oldBalance, ...row }) => row);
  await insertMany("Stock_Ledger", rowsToInsert);
  console.log(`Inserted ${rowsToInsert.length} STOCK_ADJUST rows.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
