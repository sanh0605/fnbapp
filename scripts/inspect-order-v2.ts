import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const orderNo = process.argv[2];
  if (!orderNo) throw new Error("Usage: vite-node scripts/inspect-order-v2.ts <order_no>");

  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const order = orders.find((row: any) => row.order_no === orderNo || row.id === orderNo);
  if (!order) throw new Error(`Order not found: ${orderNo}`);

  const orderLines = lines.filter((line: any) => line.order_id === order.id);
  const ledgerRows = ledger.filter((row: any) => row.reference_id === order.id);

  console.log("ORDER");
  console.log(JSON.stringify(order, null, 2));
  console.log("\nLINES");
  console.log(JSON.stringify(orderLines, null, 2));
  console.log("\nLEDGER");
  console.log(JSON.stringify(ledgerRows, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
