import * as dotenv from "dotenv";
import { buildPurchaseReceipt } from "../lib/purchase-ledger-rebuild";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const TARGET_POS = new Set(["PO-047", "PO-048"]);

async function main(): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, items, conversions, ledger] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("UOM_Conversions"),
    findAllNoCache("Stock_Ledger"),
  ]);
  const itemMap = new Map((items as any[]).map(item => [item.id, item]));

  console.log("=== PURCHASE COST ROUNDING DIAGNOSIS (READ ONLY) ===");
  for (const po of (orders as any[]).filter(row => TARGET_POS.has(row.id))) {
    console.log(`\n${po.id}`);
    console.log("Expected from purchase lines:");
    for (const line of (lines as any[]).filter(
      row => (row.purchase_order_id || row.po_id) === po.id,
    )) {
      const item = itemMap.get(line.purchased_item_id);
      if (!item) continue;
      const receipt = buildPurchaseReceipt({
        po,
        line,
        item,
        conversions: conversions as any[],
      });
      console.log(
        [
          `line=${line.id}`,
          `purchased_item=${line.purchased_item_id}`,
          `item=${receipt.item_reference}`,
          `quantity=${receipt.quantity_change}`,
          `unit_cost=${receipt.unit_cost}`,
          `total=${receipt.landed_cost_total}`,
        ].join(" | "),
      );
    }

    console.log("Actual inventory receipts:");
    for (const row of (ledger as any[]).filter(
      entry =>
        entry.reference_id === po.id &&
        entry.transaction_type === "PO_RECEIPT",
    )) {
      console.log(
        [
          `ledger=${row.id}`,
          `item=${row.item_reference}`,
          `quantity=${row.quantity_change}`,
          `unit_cost=${row.unit_cost}`,
          `total=${Number(row.quantity_change) * Number(row.unit_cost)}`,
        ].join(" | "),
      );
    }
  }
  console.log("\nNo operational data was changed.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
