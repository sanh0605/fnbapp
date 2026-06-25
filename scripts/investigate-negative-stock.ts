import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const TARGET_ITEM = process.argv[2] || "ING-032";

function fmt(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [ledger, orders, lines, baseIngredients, semiProducts] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
  ]);

  const itemById = new Map<string, any>();
  for (const item of [...(baseIngredients as any[]), ...(semiProducts as any[])]) itemById.set(item.id, item);
  const orderById = new Map((orders as any[]).map(order => [order.id, order]));
  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const rows = (ledger as any[])
    .filter(row => row.item_reference === TARGET_ITEM)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  console.log(`=== NEGATIVE STOCK INVESTIGATION: ${TARGET_ITEM} ${itemById.get(TARGET_ITEM)?.name || ""} ===`);
  console.log(`Ledger rows: ${rows.length}`);

  let balance = 0;
  let firstNegative: any = null;
  for (const row of rows) {
    balance += Number(row.quantity_change || 0);
    if (!firstNegative && balance < -0.000001) firstNegative = { row, balance };
  }

  console.log(`Final balance: ${fmt(balance)}`);
  if (firstNegative) {
    const order = orderById.get(firstNegative.row.reference_id);
    console.log("\nFirst negative point:");
    console.log(JSON.stringify({
      at: firstNegative.row.created_at,
      balance: fmt(firstNegative.balance),
      ledger_id: firstNegative.row.id,
      transaction_type: firstNegative.row.transaction_type,
      reference_id: firstNegative.row.reference_id,
      order_no: order?.order_no || "",
      quantity_change: firstNegative.row.quantity_change,
    }, null, 2));
  }

  console.log("\nLast 40 rows:");
  for (const row of rows.slice(-40)) {
    const order = orderById.get(row.reference_id);
    console.log([
      row.created_at,
      row.transaction_type,
      `ref=${row.reference_id || ""}`,
      order?.order_no ? `order=${order.order_no}` : "",
      `qty=${row.quantity_change}`,
    ].filter(Boolean).join(" | "));
  }

  if (TARGET_ITEM.startsWith("BTP-")) {
    const consumingOrders = rows
      .filter(row => row.transaction_type === "SALES_CONSUME")
      .map(row => orderById.get(row.reference_id))
      .filter(Boolean);
    const sampleOrders = consumingOrders.slice(0, 5);
    console.log("\nSample BTP consuming order recipes:");
    for (const order of sampleOrders) {
      const orderLines = linesByOrder.get(order.id) || [];
      console.log(`Order ${order.order_no} ${order.created_at}`);
      for (const line of orderLines) {
        if (!String(line.recipe_snapshot_json || "").includes(TARGET_ITEM)) continue;
        console.log(`  line=${line.id} product=${line.product_id} variant=${line.variant_id} qty=${line.qty}`);
        console.log(`  recipe=${line.recipe_snapshot_json}`);
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
