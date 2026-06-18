/**
 * Find a real order that has BOTH:
 *   - applied_promotion_id pointing to a PRODUCT_DISCOUNT promotion
 *   - order.discount_amount > 0 (manual or ORDER_DISCOUNT promo on top)
 *
 * This is the "combo" case that originally caused the Sữa Dâu revenue bug
 * (double-application via line_discount + order_discount_ratio).
 *
 * Run: npx tsx scripts/find-promo-plus-order-discount.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const [orders, lines, promotions] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Promotions"),
  ]);

  // Build a lookup: promotion_id -> type
  const promoTypeById = new Map<string, string>();
  for (const p of promotions as any[]) {
    promoTypeById.set(p.id, p.type);
  }

  const candidates: any[] = [];

  for (const o of orders as any[]) {
    if (o.status && o.status !== "COMPLETED") continue;
    const orderDiscount = Number(o.discount_amount || 0);
    if (orderDiscount <= 0) continue;
    if (!o.applied_promotion_id) continue;

    const promoType = promoTypeById.get(o.applied_promotion_id);
    if (promoType !== "PRODUCT_DISCOUNT") continue;

    const orderLines = (lines as any[]).filter(l => l.order_id === o.id);
    const suaDauLine = orderLines.find(l => {
      try {
        // Sữa dâu = VAR-031 per real data
        return l.variant_id === "VAR-031";
      } catch {
        return false;
      }
    });

    candidates.push({
      order_no: o.order_no,
      order_id: o.id,
      order_discount: orderDiscount,
      discount_type: o.discount_type,
      applied_promotion_id: o.applied_promotion_id,
      applied_promotion_snapshot_present: !!(o.applied_promotion_snapshot_json && o.applied_promotion_snapshot_json.length > 0),
      total_amount: Number(o.total_amount || 0),
      subtotal: Number(o.subtotal || o.subtotal_amount || 0),
      line_count: orderLines.length,
      has_sua_dau: !!suaDauLine,
      created_at: o.created_at,
    });
  }

  console.log(`Found ${candidates.length} orders with PRODUCT_DISCOUNT + order discount combo.\n`);

  // Sort: prefer orders with Sữa Dâu, then simpler (fewer lines)
  candidates.sort((a, b) => {
    if (a.has_sua_dau !== b.has_sua_dau) return a.has_sua_dau ? -1 : 1;
    return a.line_count - b.line_count;
  });

  console.log("Top 5 candidates (Sữa Dâu preferred, simpler preferred):\n");
  for (const c of candidates.slice(0, 5)) {
    console.log(JSON.stringify(c, null, 2));
    console.log("---");
  }

  // For the top candidate with Sữa Dâu, print full detail
  const top = candidates.find(c => c.has_sua_dau && c.line_count <= 5) || candidates[0];
  if (!top) {
    console.log("No suitable candidate found.");
    return;
  }

  console.log(`\n=== FULL DETAIL: ${top.order_no} ===\n`);
  const order = (orders as any[]).find(o => o.id === top.order_id);
  const promo = (promotions as any[]).find(p => p.id === top.applied_promotion_id);
  const orderLines = (lines as any[]).filter(l => l.order_id === top.order_id);

  console.log("ORDER:");
  console.log(JSON.stringify({
    id: order.id,
    order_no: order.order_no,
    status: order.status,
    subtotal: order.subtotal,
    subtotal_amount: order.subtotal_amount,
    discount_amount: order.discount_amount,
    discount_type: order.discount_type,
    total_amount: order.total_amount,
    applied_promotion_id: order.applied_promotion_id,
    applied_promotion_snapshot_json: order.applied_promotion_snapshot_json,
    method: order.method,
    staff_name: order.staff_name,
    created_at: order.created_at,
  }, null, 2));

  console.log("\nPROMOTION:");
  if (promo) {
    console.log(JSON.stringify({
      id: promo.id,
      name: promo.name,
      type: promo.type,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      min_order_value: promo.min_order_value,
    }, null, 2));
  }

  console.log(`\nLINES (${orderLines.length}):`);
  for (const l of orderLines) {
    console.log(JSON.stringify({
      id: l.id,
      product_id: l.product_id,
      variant_id: l.variant_id,
      qty: l.qty,
      unit_price: l.unit_price,
      line_discount: l.line_discount,
      line_manual_discount: l.line_manual_discount,
      discount_amount: l.discount_amount,
      discount_type: l.discount_type,
      modifiers_json: l.modifiers_json,
    }));
  }

  // Sanity math
  const lineGross = orderLines.reduce((s, l) => {
    const qty = Number(l.qty) || 0;
    const price = Number(l.unit_price) || 0;
    let mods = 0;
    try {
      const parsed = JSON.parse(l.modifiers_json || "[]");
      if (Array.isArray(parsed)) mods = parsed.reduce((ms: number, m: any) => ms + Number(m.price || 0), 0);
    } catch {}
    return s + (price + mods) * qty;
  }, 0);
  const sumLineDiscount = orderLines.reduce((s, l) => s + Number(l.line_discount || 0), 0);
  const sumLineManual = orderLines.reduce((s, l) => s + Number(l.line_manual_discount || 0), 0);
  const sumLineNet = orderLines.reduce((s, l) => {
    const qty = Number(l.qty) || 0;
    const price = Number(l.unit_price) || 0;
    let mods = 0;
    try {
      const parsed = JSON.parse(l.modifiers_json || "[]");
      if (Array.isArray(parsed)) mods = parsed.reduce((ms: number, m: any) => ms + Number(m.price || 0), 0);
    } catch {}
    return s + (price + mods) * qty - Number(l.line_discount || 0) - Number(l.line_manual_discount || 0);
  }, 0);

  console.log("\nSANITY MATH:");
  console.log(JSON.stringify({
    sum_line_gross: lineGross,
    sum_line_discount: sumLineDiscount,
    sum_line_manual_discount: sumLineManual,
    sum_line_net: sumLineNet,
    order_subtotal: Number(order.subtotal || order.subtotal_amount || 0),
    order_discount_amount: Number(order.discount_amount || 0),
    order_total_amount: Number(order.total_amount || 0),
    gross_minus_all_discounts: lineGross - sumLineDiscount - sumLineManual - Number(order.discount_amount || 0),
    discrepancy_sum_net_vs_total: sumLineNet - Number(order.total_amount || 0),
  }, null, 2));
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
