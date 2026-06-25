import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const CUTOFF_AT = "2026-06-25T07:31:08.402Z";

function fmtQty(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, insertMany } = await import("../lib/sheets_db");
  const { planBtpShortfallReprocess } = await import("../lib/btp-shortfall-reprocess");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  const plan = planBtpShortfallReprocess({
    cutoffAt: CUTOFF_AT,
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });

  console.log(`=== BTP SHORTFALL LEDGER REPROCESS (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`Cutoff:              ${CUTOFF_AT}`);
  console.log(`Orders to reprocess: ${plan.ordersToReprocess}`);
  console.log(`Rows to insert:      ${plan.rowsToInsert.length}`);

  for (const row of plan.summaries.slice(0, 50)) {
    console.log([
      row.order_no,
      `order=${row.order_id}`,
      `old_rows=${row.old_rows}`,
      `new_rows=${row.new_rows}`,
    ].join(" | "));
  }

  const totals = new Map<string, number>();
  for (const row of plan.rowsToInsert) {
    totals.set(row.item_reference, (totals.get(row.item_reference) || 0) + Number(row.quantity_change || 0));
  }
  console.log("\nNet planned changes:");
  for (const [item, qty] of [...totals.entries()].sort()) {
    console.log(`${item}: ${fmtQty(qty)}`);
  }

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply to insert correction ledger rows.");
    return;
  }
  if (plan.rowsToInsert.length === 0) {
    console.log("\nNothing to insert.");
    return;
  }

  await insertMany("Stock_Ledger", plan.rowsToInsert);
  console.log(`\nInserted ${plan.rowsToInsert.length} Stock_Ledger correction rows.`);
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
