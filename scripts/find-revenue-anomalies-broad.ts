/**
 * Find specific orders causing revenue anomalies for 3 drinks:
 * - Cà phê sữa đá (PROD-002): expected per_cup = 15k (VAR-012 promo) or 17k (VAR-012 not in promo?) or 20k (VAR-002 not in promo)
 * - Cà phê đá (PROD-001): expected = 15k (VAR-010/011 promo) or 18k (VAR-001 not in promo)
 * - Trà sữa truyền thống (PROD-025): expected = 15k (VAR-032 promo) or 18k (VAR-032 not in promo?)
 *
 * Find lines where per_cup revenue deviates from expected variant prices.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { allocateLineRevenue } = require("../lib/order-math");

async function main() {
  const [orders, lines, products, variants, promotions] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Promotions"),
  ]);

  // Get PRM-003 applicable products map
  const promo = (promotions as any[]).find(p => p.id === "PRM-003");
  const applicable = JSON.parse(promo?.applicable_products_json || "{}");

  // Filter V2 orders: COMPLETED, latest, June 2026
  const filteredOrders = orders.filter((o: any) => {
    if (o.status !== "COMPLETED") return false;
    if (o.superseded_by) return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= new Date("2026-06-01") && d <= new Date("2026-06-19T23:59:59");
  });
  const orderIds = new Set(filteredOrders.map((o: any) => o.id));
  const filteredLines = lines.filter((l: any) => orderIds.has(l.order_id));

  // Target products
  const targets = [
    { productId: "PROD-002", name: "Cà phê sữa đá" },
    { productId: "PROD-001", name: "Cà phê đá" },
    { productId: "PROD-025", name: "Trà sữa truyền thống" },
  ];

  for (const target of targets) {
    console.log(`\n=== ${target.name} (${target.productId}) ===`);

    const productLines = filteredLines.filter((l: any) => l.product_id === target.productId);

    // Get all variants for this product
    const productVariants = (variants as any[]).filter(v => v.product_id === target.productId);
    console.log(`Variants:`);
    for (const v of productVariants) {
      const inPromo = applicable[v.id];
      console.log(`  ${v.id} size=${v.size_name} price=${v.price} ${inPromo ? `→ in PRM-003 (target ${inPromo})` : "(NOT in promo)"}`);
    }
    console.log(`Lines: ${productLines.length}`);

    // Build expected per_cup price map
    const expectedPerCup = new Map<string, number>(); // variant_id → expected per cup
    for (const v of productVariants) {
      const inPromo = applicable[v.id];
      expectedPerCup.set(v.id, inPromo ? Number(inPromo) : Number(v.price));
    }

    // Check each line for anomaly
    const anomalies: any[] = [];
    const expectedCounts = new Map<number, number>(); // per_cup → count
    let totalQty = 0;
    let totalRevenue = 0;

    for (const l of productLines) {
      const qty = Number(l.qty) || 0;
      const unit_price = Number(l.unit_price) || 0;
      const gross_variant = unit_price * qty;
      const mods = JSON.parse(l.modifiers_snapshot_json || "[]");
      const gross_line = Number(l.gross_line_total || 0);
      const promo_discount = Number(l.promo_discount || 0);
      const manual_item = Number(l.manual_item_discount || 0);
      const order_alloc = Number(l.order_discount_allocation || 0);

      const alloc = allocateLineRevenue({
        unit_price, qty, modifiers: mods,
        gross_line_total: gross_line,
        promo_discount, manual_item_discount: manual_item,
        order_discount_allocation: order_alloc,
      });

      const perCup = qty > 0 ? alloc.variantRevenue / qty : 0;
      totalQty += qty;
      totalRevenue += alloc.variantRevenue;

      const expected = expectedPerCup.get(l.variant_id);
      expectedCounts.set(expected, (expectedCounts.get(expected) || 0) + qty);

      // Anomaly: per_cup deviates from expected by more than 1đ
      if (expected !== undefined && Math.abs(perCup - expected) > 1) {
        anomalies.push({
          order_id: l.order_id,
          order_no: filteredOrders.find((o: any) => o.id === l.order_id)?.order_no,
          variant_id: l.variant_id,
          qty,
          unit_price,
          expected_per_cup: expected,
          actual_per_cup: perCup,
          diff: perCup - expected,
          gross_line,
          promo_discount,
          manual_item,
          order_alloc,
          variant_revenue: alloc.variantRevenue,
        });
      }
    }

    console.log(`Total cups: ${totalQty}, revenue: ${totalRevenue}đ, avg/cup: ${Math.round(totalRevenue / totalQty)}đ`);
    console.log(`Expected per_cup distribution:`);
    for (const [cup, count] of expectedCounts) {
      console.log(`  ${cup}đ: ${count} cups`);
    }
    console.log(`Anomalies: ${anomalies.length}`);

    // Group anomalies by variant + diff
    const byVariant = new Map<string, any[]>();
    for (const a of anomalies) {
      const key = `${a.variant_id}|diff=${a.diff}`;
      if (!byVariant.has(key)) byVariant.set(key, []);
      byVariant.get(key).push(a);
    }
    console.log(`\nAnomaly groups:`);
    for (const [key, items] of byVariant) {
      console.log(`  ${key} (${items.length} orders) — sample:`);
      for (const a of items.slice(0, 3)) {
        console.log(`    ${a.order_no}: qty=${a.qty} unit=${a.unit_price} expected=${a.expected_per_cup} actual=${a.actual_per_cup}`);
        console.log(`      promo=${a.promo_discount} manual_item=${a.manual_item} order_alloc=${a.order_alloc} variant_rev=${a.variant_revenue}`);
      }
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
