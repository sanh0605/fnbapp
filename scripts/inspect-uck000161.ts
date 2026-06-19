/**
 * Inspect UCK000161 V1 + V2 to find promo/discount errors.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const [v1Orders, v1Lines, v2Orders, v2Lines] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ]);

  // UCK000161 V1
  const v1 = (v1Orders as any[]).find(o => o.order_no === "UCK000161");
  console.log("=== V1 UCK000161 ===");
  console.log({
    id: v1?.id,
    subtotal: v1?.subtotal,
    discount_amount: v1?.discount_amount,
    total_amount: v1?.total_amount,
    applied_promotion_id: v1?.applied_promotion_id,
    snapshot: v1?.applied_promotion_snapshot_json?.substring(0, 300),
  });

  const v1OrderLines = (v1Lines as any[]).filter(l => l.order_id === v1?.id);
  console.log(`\nV1 lines (${v1OrderLines.length}):`);
  for (const l of v1OrderLines) {
    console.log({
      product_id: l.product_id,
      variant_id: l.variant_id,
      qty: l.qty,
      unit_price: l.unit_price,
      line_discount: l.line_discount,
      line_manual_discount: l.line_manual_discount,
      discount_amount: l.discount_amount,
      modifiers: l.modifiers_json?.substring(0, 100),
    });
  }

  // V2
  const v2 = (v2Orders as any[]).find(o => o.order_no === "UCK000161");
  console.log("\n=== V2 UCK000161 ===");
  console.log({
    id: v2?.id,
    gross_total: v2?.gross_total,
    promo_discount_total: v2?.promo_discount_total,
    manual_item_discount_total: v2?.manual_item_discount_total,
    manual_order_discount: v2?.manual_order_discount,
    net_total: v2?.net_total,
    migration_notes: v2?.migration_notes,
  });

  const v2OrderLines = (v2Lines as any[]).filter(l => l.order_id === v2?.id);
  console.log(`\nV2 lines (${v2OrderLines.length}):`);
  for (const l of v2OrderLines) {
    console.log({
      line_no: l.line_no,
      product_id: l.product_id,
      variant_id: l.variant_id,
      qty: l.qty,
      unit_price: l.unit_price,
      gross_line_total: l.gross_line_total,
      promo_discount: l.promo_discount,
      manual_item_discount: l.manual_item_discount,
      order_discount_allocation: l.order_discount_allocation,
      net_line_total: l.net_line_total,
    });
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
