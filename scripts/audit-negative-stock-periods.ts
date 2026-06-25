import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmtQty(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

function fmtDate(value: string): string {
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [ledger, baseIngredients, semiProducts, units] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Units"),
  ]);

  const itemById = new Map<string, any>();
  for (const item of baseIngredients as any[]) itemById.set(item.id, { ...item, item_type: "BASE_INGREDIENT" });
  for (const item of semiProducts as any[]) itemById.set(item.id, { ...item, item_type: "SEMI_PRODUCT" });
  const unitById = new Map((units as any[]).map(unit => [unit.id, unit.name || unit.id]));

  const rowsByItem = new Map<string, any[]>();
  for (const row of ledger as any[]) {
    const itemId = row.item_reference || "";
    if (!itemId) continue;
    const rows = rowsByItem.get(itemId) || [];
    rows.push(row);
    rowsByItem.set(itemId, rows);
  }

  console.log("=== NEGATIVE STOCK PERIODS (READ ONLY) ===");
  for (const [itemId, rows] of [...rowsByItem.entries()].sort()) {
    const item = itemById.get(itemId);
    if (!item) continue;
    rows.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

    let balance = 0;
    let open: any = null;
    const periods: any[] = [];
    let minBalance = 0;

    for (const row of rows) {
      const before = balance;
      balance += Number(row.quantity_change || 0);
      if (balance < minBalance) minBalance = balance;

      if (!open && before >= 0 && balance < 0) {
        open = { start: row.created_at, startRow: row, startBalance: balance, minBalance: balance };
      }
      if (open) {
        open.minBalance = Math.min(open.minBalance, balance);
      }
      if (open && balance >= 0) {
        periods.push({ ...open, end: row.created_at, endRow: row, endBalance: balance });
        open = null;
      }
    }
    if (open) periods.push({ ...open, end: "", endRow: null, endBalance: balance });

    if (periods.length === 0) continue;
    const unitName = unitById.get(item.base_unit || "") || item.base_unit || "";
    console.log(`\n${itemId} | ${item.name} | ${item.item_type} | final=${fmtQty(balance)} ${unitName}`);
    for (const period of periods) {
      const startRef = period.startRow?.reference_id || "";
      const endRef = period.endRow?.reference_id || "";
      console.log([
        `start=${fmtDate(period.start)}`,
        period.end ? `end=${fmtDate(period.end)}` : "end=ĐANG ÂM",
        `start_balance=${fmtQty(period.startBalance)}`,
        `min=${fmtQty(period.minBalance)}`,
        `end_balance=${fmtQty(period.endBalance)}`,
        `start_ref=${startRef}`,
        endRef ? `end_ref=${endRef}` : "",
      ].filter(Boolean).join(" | "));
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
