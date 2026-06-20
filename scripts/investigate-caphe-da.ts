/**
 * Investigate Bug 1: Cà phê đá shows 7.435đ/cup but V2 data shows 18k/cup.
 *
 * Run: npx tsx scripts/investigate-caphe-da.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const [orders, lines, products, variants] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
  ]);

  // 1. List ALL products with "cà phê" in name
  console.log("=== All 'cà phê' products ===");
  const caPheProducts = (products as any[]).filter(p =>
    p.name && p.name.toLowerCase().includes("cà phê"),
  );
  for (const p of caPheProducts) {
    console.log(`  ${p.id}: ${p.name}`);
  }

  // 2. For each, get variants
  console.log("\n=== Variants per product ===");
  for (const p of caPheProducts) {
    const vs = (variants as any[]).filter(v => v.product_id === p.id);
    console.log(`${p.name}:`);
    for (const v of vs) {
      console.log(`  ${v.id} size=${v.size_name} price=${v.price}`);
    }
  }

  // 3. Filter V2 by date range matching PnL report (01/06 - 19/06)
  const startDate = new Date("2026-06-01T00:00:00+07:00");
  const endDate = new Date("2026-06-19T23:59:59+07:00");

  const filteredOrders = (orders as any[]).filter(o => {
    if (o.status !== "COMPLETED") return false;
    if (o.superseded_by && o.superseded_by !== "") return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= startDate && d <= endDate;
  });
  console.log(`\n=== Filtered orders: ${filteredOrders.length} (01/06-19/06, COMPLETED, latest) ===`);

  const orderIds = new Set(filteredOrders.map(o => o.id));
  const filteredLines = (lines as any[]).filter(l => orderIds.has(l.order_id));

  // 4. For "Cà phê đá" specifically, aggregate
  const caPheDaProduct = caPheProducts.find(p => p.name && p.name.toLowerCase() === "cà phê đá");
  console.log(`\n=== Cà phê đá (exact match): ${caPheDaProduct?.id} ===`);

  const caPheDaVariants = (variants as any[]).filter(v => v.product_id === caPheDaProduct?.id);
  const caPheDaVariantIds = new Set(caPheDaVariants.map(v => v.id));
  const caPheDaLines = filteredLines.filter(l => caPheDaVariantIds.has(l.variant_id));

  console.log(`Lines: ${caPheDaLines.length}`);
  const totalQty = caPheDaLines.reduce((s, l) => s + Number(l.qty || 0), 0);
  const totalGross = caPheDaLines.reduce((s, l) => s + Number(l.gross_line_total || 0), 0);
  const totalPromo = caPheDaLines.reduce((s, l) => s + Number(l.promo_discount || 0), 0);
  const totalManualItem = caPheDaLines.reduce((s, l) => s + Number(l.manual_item_discount || 0), 0);
  const totalOrderAlloc = caPheDaLines.reduce((s, l) => s + Number(l.order_discount_allocation || 0), 0);
  const totalNet = caPheDaLines.reduce((s, l) => s + Number(l.net_line_total || 0), 0);
  const totalCost = caPheDaLines.reduce((s, l) => s + Number(l.cost_at_sale || 0), 0);

  console.log(`Total qty: ${totalQty}`);
  console.log(`Total gross: ${totalGross}`);
  console.log(`Total promo: ${totalPromo}`);
  console.log(`Total manual_item: ${totalManualItem}`);
  console.log(`Total order_alloc: ${totalOrderAlloc}`);
  console.log(`Total net_line_total: ${totalNet}`);
  console.log(`Net per cup: ${totalNet / totalQty}`);
  console.log(`Total cost_at_sale: ${totalCost}`);

  // 5. Check breakdownRevenueByProduct output (replicate the WS-4 logic)
  console.log(`\n=== breakdownRevenueByProduct simulation ===`);
  // For each line, compute variantRevenue = round(grossVariant * (net/gross))
  let simulatedVariantRevenue = 0;
  for (const l of caPheDaLines) {
    const grossVariant = Number(l.unit_price) * Number(l.qty);
    const mods = JSON.parse(l.modifiers_snapshot_json || "[]");
    const grossMods = mods.reduce((s: number, m: any) => s + Number(m.price || 0) * Number(m.qty || 1) * Number(l.qty), 0);
    const grossLine = grossVariant + grossMods;
    const totalDiscount = Number(l.promo_discount) + Number(l.manual_item_discount) + Number(l.order_discount_allocation);
    const lineNet = Math.max(0, grossLine - totalDiscount);
    const ratio = grossLine > 0 ? lineNet / grossLine : 0;
    const variantRevenue = Math.round(grossVariant * ratio);
    simulatedVariantRevenue += variantRevenue;
  }
  console.log(`Simulated variantRevenue: ${simulatedVariantRevenue}`);
  console.log(`Simulated per cup: ${simulatedVariantRevenue / totalQty}`);

  // 6. Compare to what PnL report shows (342.000đ)
  console.log(`\nPnL report shows: 342.000đ / 46 cups = 7.435đ/cup`);
  console.log(`V2 data shows:    ${simulatedVariantRevenue}đ / ${totalQty} cups`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
