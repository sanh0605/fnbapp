/**
 * Inspect UCK000094 — print the REAL order data from Google Sheets.
 *
 * Goal: ground the WS-1 fixtures in actual data instead of invented numbers.
 * Run: npx tsx scripts/inspect-uck000094.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Use require to ensure lib/sheets_db.ts picks up env vars set by dotenv
const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const [orders, lines, promotions, products, variants] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Promotions"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
  ]);

  const order = (orders as any[]).find(o => o.order_no === "UCK000094");
  if (!order) {
    console.log("UCK000094 not found. Searching for similar order_nos...");
    const candidates = (orders as any[])
      .filter(o => /UCK/i.test(o.order_no || ""))
      .slice(0, 10)
      .map(o => o.order_no);
    console.log("Candidates:", candidates);
    return;
  }

  console.log("=== ORDER UCK000094 ===");
  console.log(JSON.stringify({
    id: order.id,
    order_no: order.order_no,
    brand_id: order.brand_id,
    status: order.status,
    total_amount: order.total_amount,
    subtotal: order.subtotal,
    subtotal_amount: order.subtotal_amount,
    discount_amount: order.discount_amount,
    discount_type: order.discount_type,
    applied_promotion_id: order.applied_promotion_id,
    applied_promotion_snapshot_json: order.applied_promotion_snapshot_json,
    discount_reason: order.discount_reason,
    method: order.method,
    staff_name: order.staff_name,
    created_at: order.created_at,
  }, null, 2));

  console.log("\n=== LINES ===");
  const orderLines = (lines as any[]).filter(l => l.order_id === order.id);
  console.log(`Found ${orderLines.length} lines`);
  for (const l of orderLines) {
    const product = (products as any[]).find(p => p.id === l.product_id);
    const variant = (variants as any[]).find(v => v.id === l.variant_id);
    console.log(JSON.stringify({
      line_id: l.id,
      product_id: l.product_id,
      product_name: product?.name,
      variant_id: l.variant_id,
      variant_size: variant?.size_name,
      qty: l.qty,
      unit_price: l.unit_price,
      line_discount: l.line_discount,
      line_manual_discount: l.line_manual_discount,
      discount_amount: l.discount_amount,
      discount_type: l.discount_type,
      modifiers_json: l.modifiers_json,
    }, null, 2));
  }

  if (order.applied_promotion_id) {
    const promo = (promotions as any[]).find(p => p.id === order.applied_promotion_id);
    if (promo) {
      console.log("\n=== PROMOTION APPLIED ===");
      console.log(JSON.stringify({
        id: promo.id,
        name: promo.name,
        type: promo.type,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        applicable_products_json: promo.applicable_products_json,
        code: promo.code,
        start_date: promo.start_date,
        end_date: promo.end_date,
        min_order_value: promo.min_order_value,
        brand_id: promo.brand_id,
      }, null, 2));
    } else {
      console.log(`\nPromotion ${order.applied_promotion_id} not found in Promotions sheet`);
    }
  }

  console.log("\n=== SANITY MATH ===");
  const grossSum = orderLines.reduce((s, l) => {
    const qty = Number(l.qty) || 0;
    const price = Number(l.unit_price) || 0;
    let mods = 0;
    try {
      const parsed = JSON.parse(l.modifiers_json || "[]");
      if (Array.isArray(parsed)) {
        mods = parsed.reduce((ms: number, m: any) => ms + Number(m.price || 0), 0);
      }
    } catch {}
    return s + (price + mods) * qty;
  }, 0);
  const lineDiscountSum = orderLines.reduce((s, l) => s + Number(l.line_discount || 0), 0);
  const lineManualSum = orderLines.reduce((s, l) => s + Number(l.line_manual_discount || 0), 0);
  const legacyDiscountSum = orderLines.reduce((s, l) => s + Number(l.discount_amount || 0), 0);

  console.log(JSON.stringify({
    sum_of_line_gross: grossSum,
    sum_of_line_discount: lineDiscountSum,
    sum_of_line_manual_discount: lineManualSum,
    sum_of_legacy_line_discount_amount: legacyDiscountSum,
    order_subtotal: Number(order.subtotal || order.subtotal_amount || 0),
    order_discount_amount: Number(order.discount_amount || 0),
    order_total_amount: Number(order.total_amount || 0),
    gross_minus_discounts_minus_order_discount: grossSum - lineDiscountSum - lineManualSum - Number(order.discount_amount || 0),
  }, null, 2));
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
