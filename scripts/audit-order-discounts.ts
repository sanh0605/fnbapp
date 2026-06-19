/**
 * Audit all migrated V2 orders with manual_order_discount > 0.
 * Lists them with details so User can identify which are wrong.
 *
 * Run: npx tsx scripts/audit-order-discounts.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const [v2Orders, v2Lines] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ]);

  // Get migrated orders with manual_order_discount > 0
  const migrated = (v2Orders as any[]).filter((o: any) => {
    if (o.status !== "COMPLETED") return false;
    if (o.superseded_by) return false;
    const isMigrated = (() => {
      try {
        const snap = JSON.parse(o.pos_snapshot_json || "{}");
        return !!snap.v1_id;
      } catch { return false; }
    })();
    return isMigrated && Number(o.manual_order_discount || 0) > 0;
  });

  console.log(`\n=== Audit: ${migrated.length} migrated orders with manual_order_discount > 0 ===\n`);

  // Group by promo type
  const withPromo = migrated.filter(o => o.applied_promotion_id);
  const withoutPromo = migrated.filter(o => !o.applied_promotion_id);

  console.log(`With PRM applied: ${withPromo.length}`);
  console.log(`Without PRM: ${withoutPromo.length}\n`);

  // Sort by manual_order_discount descending
  const sorted = migrated.sort((a, b) => Number(b.manual_order_discount) - Number(a.manual_order_discount));

  // Print table
  console.log("Order No    | Gross  | Promo  | ManItem | ManOrder | Net   | % disc | PromoID");
  console.log("-".repeat(95));
  for (const o of sorted) {
    const gross = Number(o.gross_total || 0);
    const promo = Number(o.promo_discount_total || 0);
    const manItem = Number(o.manual_item_discount_total || 0);
    const manOrder = Number(o.manual_order_discount || 0);
    const net = Number(o.net_total || 0);
    const pct = gross > 0 ? ((manOrder / gross) * 100).toFixed(1) : "0";
    const promoId = o.applied_promotion_id || "-";
    console.log(
      `${o.order_no.padEnd(11)} | ${String(gross).padStart(6)} | ${String(promo).padStart(6)} | ${String(manItem).padStart(7)} | ${String(manOrder).padStart(8)} | ${String(net).padStart(5)} | ${pct.padStart(6)}% | ${promoId}`,
    );
  }

  // Summary stats
  console.log("\n=== Summary ===");
  const totalManOrder = sorted.reduce((s, o) => s + Number(o.manual_order_discount), 0);
  const totalGross = sorted.reduce((s, o) => s + Number(o.gross_total), 0);
  console.log(`Total manual_order_discount across these orders: ${totalManOrder}đ`);
  console.log(`Total gross across these orders: ${totalGross}đ`);
  console.log(`Avg discount ratio: ${(totalManOrder / totalGross * 100).toFixed(1)}%`);

  // Distribution
  console.log("\n=== Distribution by manual_order / gross ratio ===");
  const buckets = { "<10%": 0, "10-30%": 0, "30-50%": 0, "50-80%": 0, ">80%": 0 };
  for (const o of sorted) {
    const ratio = Number(o.manual_order_discount) / Number(o.gross_total || 1);
    if (ratio < 0.10) buckets["<10%"]++;
    else if (ratio < 0.30) buckets["10-30%"]++;
    else if (ratio < 0.50) buckets["30-50%"]++;
    else if (ratio < 0.80) buckets["50-80%"]++;
    else buckets[">80%"]++;
  }
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`  ${k}: ${v} orders`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
