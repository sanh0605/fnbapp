/**
 * Investigate why Sữa Dâu revenue per cup avg = 25047đ (not exactly 25000đ).
 * Identify specific orders contributing to anomaly.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { allocateLineRevenue } = require("../lib/order-math");

async function main() {
  const [orders, lines] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ]);

  // Filter: COMPLETED, latest, in June 2026
  const filteredOrders = orders.filter((o: any) => {
    if (o.status !== "COMPLETED") return false;
    if (o.superseded_by) return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= new Date("2026-06-01") && d <= new Date("2026-06-19T23:59:59");
  });
  const orderIds = new Set(filteredOrders.map((o: any) => o.id));
  const filteredLines = lines.filter((l: any) => orderIds.has(l.order_id));

  // Get Sữa Dâu lines (PROD-024)
  const suaDauLines = filteredLines.filter((l: any) => l.product_id === "PROD-024");
  console.log(`Sữa Dâu lines in range: ${suaDauLines.length}`);
  console.log();

  // For each line, compute per-cup revenue via allocateLineRevenue (same as PnL)
  let totalQty = 0;
  let totalRevenue = 0;
  const anomalies: any[] = [];

  for (const l of suaDauLines) {
    const qty = Number(l.qty) || 0;
    const unit_price = Number(l.unit_price) || 0;
    const gross_variant = unit_price * qty;
    const mods = JSON.parse(l.modifiers_snapshot_json || "[]");
    const gross_mods = mods.reduce((s: number, m: any) => s + Number(m.price || 0) * Number(m.qty || 1) * qty, 0);
    const gross_line = Number(l.gross_line_total || 0);
    const promo = Number(l.promo_discount || 0);
    const manualItem = Number(l.manual_item_discount || 0);
    const orderAlloc = Number(l.order_discount_allocation || 0);
    const netLineTotal = Number(l.net_line_total || 0);

    const alloc = allocateLineRevenue({
      unit_price, qty, modifiers: mods,
      gross_line_total: gross_line, promo_discount: promo,
      manual_item_discount: manualItem, order_discount_allocation: orderAlloc,
    });

    const perCup = qty > 0 ? alloc.variantRevenue / qty : 0;

    totalQty += qty;
    totalRevenue += alloc.variantRevenue;

    // Anomaly: per cup is not 25k or 35k (the 2 valid prices for Sữa Dâu)
    const valid = perCup === 25000 || perCup === 35000;
    if (!valid) {
      anomalies.push({
        order_id: l.order_id,
        line_id: l.id,
        qty,
        unit_price,
        gross_variant,
        gross_line,
        promo,
        manual_item: manualItem,
        order_alloc: orderAlloc,
        net_line_total: netLineTotal,
        allocated_variant_revenue: alloc.variantRevenue,
        per_cup: perCup,
      });
    }
  }

  console.log(`Total Sữa Dâu cups: ${totalQty}`);
  console.log(`Total revenue: ${totalRevenue}đ`);
  console.log(`Avg per cup: ${totalRevenue / totalQty}đ`);
  console.log();
  console.log(`=== ANOMALIES: ${anomalies.length} lines (per-cup ≠ 25k or 35k) ===`);

  // Group by per_cup value
  const byPerCup = new Map();
  for (const a of anomalies) {
    const key = a.per_cup;
    if (!byPerCup.has(key)) byPerCup.set(key, []);
    byPerCup.get(key).push(a);
  }

  console.log();
  for (const [perCup, items] of Array.from(byPerCup.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`=== per_cup = ${perCup}đ (${items.length} orders) ===`);
    for (const a of items.slice(0, 3)) {
      console.log(`  ${a.order_id} qty=${a.qty} unit=${a.unit_price} gross_v=${a.gross_variant} gross_l=${a.gross_line} promo=${a.promo} manItem=${a.manual_item} orderAlloc=${a.order_alloc} netLine=${a.net_line_total} → alloc=${a.allocated_variant_revenue}`);
    }
    if (items.length > 3) console.log(`  ... and ${items.length - 3} more`);
  }

  // Show first 10 anomalies in detail
  console.log();
  console.log(`=== First 10 anomalies detail ===`);
  for (const a of anomalies.slice(0, 10)) {
    console.log(JSON.stringify(a));
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
