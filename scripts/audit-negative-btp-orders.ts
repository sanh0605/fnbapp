import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const TARGET_BTP = new Set(["BTP-002", "BTP-003", "BTP-008", "BTP-010", "BTP-011"]);

function fmtQty(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [ledger, orders, lines, semiProducts] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Semi_Products"),
  ]);

  const orderById = new Map((orders as any[]).map(order => [order.id, order]));
  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }
  const spById = new Map((semiProducts as any[]).map(sp => [sp.id, sp]));

  const rows = (ledger as any[])
    .filter(row =>
      TARGET_BTP.has(row.item_reference) &&
      row.transaction_type === "SALES_CONSUME" &&
      Number(row.quantity_change || 0) < 0 &&
      new Date(row.created_at || 0).getTime() >= new Date("2026-06-25T07:31:08.402Z").getTime(),
    )
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  console.log("=== NEGATIVE BTP SALES AFTER STOCK ADJUST (READ ONLY) ===");
  console.log(`Rows: ${rows.length}`);

  const byItem = new Map<string, any[]>();
  for (const row of rows) {
    const itemRows = byItem.get(row.item_reference) || [];
    itemRows.push(row);
    byItem.set(row.item_reference, itemRows);
  }

  for (const [itemId, itemRows] of [...byItem.entries()].sort()) {
    const total = itemRows.reduce((sum, row) => sum + Number(row.quantity_change || 0), 0);
    console.log(`\n${itemId} | ${spById.get(itemId)?.name || itemId} | sales=${fmtQty(total)} | rows=${itemRows.length}`);
    for (const row of itemRows) {
      const order = orderById.get(row.reference_id);
      const orderLines = linesByOrder.get(row.reference_id) || [];
      console.log([
        `time=${row.created_at}`,
        `order=${order?.order_no || row.reference_id}`,
        `ledger=${row.id}`,
        `qty=${fmtQty(Number(row.quantity_change || 0))}`,
        `source=${row.source || ""}`,
        `line_count=${orderLines.length}`,
        `status=${order?.status || ""}`,
      ].join(" | "));
      for (const line of orderLines) {
        console.log([
          "  line",
          line.id,
          `product=${line.product_id || ""}`,
          `variant=${line.variant_id || ""}`,
          `qty=${line.qty || ""}`,
          `cost=${line.cost_at_sale || ""}`,
        ].join(" | "));
      }
    }
  }

  console.log("\nNo data was written.");
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
