import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-off read-only check: does any Purchase_Order_Lines row for ING-003
 * (Sữa đặc) exist after the last Stock_Ledger PO_RECEIPT (2026-05-16),
 * which would indicate a purchase was entered but never reached the
 * ledger (a system bug) rather than simply never being entered at all.
 */

const ITEM_REFERENCE = "ING-003";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [poLines, purchaseOrders, purchasedItems] = await Promise.all([
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchased_Items"),
  ]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>];

  const poById = new Map(purchaseOrders.map(po => [String(po.id), po]));
  const purchasedItemIds = new Set(
    purchasedItems
      .filter(item => String(item.base_ingredient_id || "") === ITEM_REFERENCE)
      .map(item => String(item.id)),
  );
  console.log(`Purchased_Items trỏ tới ${ITEM_REFERENCE}: ${[...purchasedItemIds].join(", ") || "(không có)"}`);

  const lines = poLines.filter(line => purchasedItemIds.has(String(line.purchased_item_id || "")));

  console.log(`Tổng số dòng PO chứa ${ITEM_REFERENCE}: ${lines.length}`);
  for (const line of lines) {
    const po = poById.get(String(line.purchase_order_id));
    console.log([
      `po_id=${line.purchase_order_id}`,
      `po_status=${po?.status}`,
      `po_created_at=${po?.created_at}`,
      `po_transaction_date=${po?.transaction_date}`,
      `quantity=${line.quantity}`,
      `base_quantity=${line.base_quantity}`,
    ].join(" | "));
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
