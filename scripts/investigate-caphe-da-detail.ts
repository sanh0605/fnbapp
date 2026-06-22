/**
 * Investigate:
 * 1. PHD000522 current state (after fix)
 * 2. Cà phê đá (PROD-001) — user says only 500ml is sold. List orders by variant.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { allocateLineRevenue } = require("../lib/order-math");

async function main() {
  const [orders, lines, products, variants] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
  ]);

  // ============== PHD000522 ==============
  console.log("=== PHD000522 current state ===\n");
  const phd522 = orders.find((o: any) => o.order_no === "PHD000522");
  const phd522Lines = lines.filter((l: any) => l.order_id === phd522?.id);
  console.log("Order:", {
    gross: phd522?.gross_total,
    promo: phd522?.promo_discount_total,
    manual_item: phd522?.manual_item_discount_total,
    manual_order: phd522?.manual_order_discount,
    net: phd522?.net_total,
  });
  for (const l of phd522Lines) {
    console.log("Line:", {
      product_id: l.product_id,
      variant_id: l.variant_id,
      qty: l.qty,
      unit_price: l.unit_price,
      gross_line_total: l.gross_line_total,
      promo_discount: l.promo_discount,
      manual_item_discount: l.manual_item_discount,
      order_alloc: l.order_discount_allocation,
      net_line_total: l.net_line_total,
      modifiers: l.modifiers_snapshot_json,
    });
  }

  // ============== Cà phê đá breakdown ==============
  console.log("\n\n=== Cà phê đá (PROD-001) breakdown ===\n");

  const caPheVariants = (variants as any[]).filter(v => v.product_id === "PROD-001");
  console.log("All variants of Cà phê đá:");
  for (const v of caPheVariants) {
    console.log(`  ${v.id} size=${v.size_name} price=${v.price}`);
  }

  // Filter orders: COMPLETED, latest, June 2026
  const filteredOrders = orders.filter((o: any) => {
    if (o.status !== "COMPLETED") return false;
    if (o.superseded_by) return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= new Date("2026-06-01") && d <= new Date("2026-06-19T23:59:59");
  });
  const orderIds = new Set(filteredOrders.map((o: any) => o.id));
  const filteredLines = lines.filter((l: any) => orderIds.has(l.order_id));

  const caPheLines = filteredLines.filter((l: any) => l.product_id === "PROD-001");
  console.log(`\nTotal Cà phê đá lines in range: ${caPheLines.length}`);

  // Group by variant
  const byVariant = new Map<string, any[]>();
  for (const l of caPheLines) {
    let group = byVariant.get(l.variant_id);
    if (!group) {
      group = [];
      byVariant.set(l.variant_id, group);
    }
    group.push(l);
  }

  console.log("\nBreakdown by variant:");
  for (const [variantId, items] of byVariant) {
    const variant = (variants as any[]).find(v => v.id === variantId);
    console.log(`\n${variantId} (${variant?.size_name} ${variant?.price}đ): ${items.length} orders`);
    for (const l of items) {
      const order = filteredOrders.find((o: any) => o.id === l.order_id);
      const mods = JSON.parse(l.modifiers_snapshot_json || "[]");
      const alloc = allocateLineRevenue({
        unit_price: Number(l.unit_price), qty: Number(l.qty), modifiers: mods,
        gross_line_total: Number(l.gross_line_total),
        promo_discount: Number(l.promo_discount),
        manual_item_discount: Number(l.manual_item_discount),
        order_discount_allocation: Number(l.order_discount_allocation),
      });
      const perCup = Number(l.qty) > 0 ? alloc.variantRevenue / Number(l.qty) : 0;
      console.log(`  ${order?.order_no} qty=${l.qty} unit=${l.unit_price} | promo=${l.promo_discount} manItem=${l.manual_item_discount} orderAlloc=${l.order_discount_allocation} | perCup=${perCup}đ ${perCup === 15000 ? "✓" : "ANOMALY"}`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
