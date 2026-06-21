/**
 * Verify WS-7 bug fixes via pattern checks.
 *
 * Run: npx tsx scripts/verify-pnl-patterns.ts
 *
 * Expected after WS-7:
 *   1. Cà phê đá revenue per cup ends in 5k or 0k (15k or 18k price)
 *   2. Trà sữa truyền thống revenue per cup ends in 5k or 0k
 *   3. Yogurt việt quất revenue per cup ends in 5k or 0k
 *   4. Topping COGS > 0 for at least some toppings
 *   5. No order has manual_order_discount > 30% of gross (suspicious)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { getPnLDataV2 } = require("../app/actions/reports");

async function main() {
  console.log("\n=== WS-7 PnL Pattern Verification ===\n");

  const pnl = await getPnLDataV2({
    startDate: "2026-06-01T00:00:00+07:00",
    endDate: "2026-06-19T23:59:59+07:00",
  });

  console.log(`Orders: ${pnl.orderCount}, Revenue: ${pnl.totalRevenue}đ, COGS: ${pnl.totalCOGS}đ\n`);

  let allPassed = true;

  // Check 1: drink revenue per cup should end in 5k or 0k (15k/18k/25k prices)
  console.log("--- Drink revenue per-cup check ---");
  const drinkRows = pnl.productProfitAnalysis.filter(p => !p.product_id.startsWith("MOD:"));
  for (const row of drinkRows.slice(0, 10)) {
    if (row.qty === 0) continue;
    const perCup = row.revenue / row.qty;
    const last3Digits = Math.round(perCup) % 1000;
    const endsIn5kOr0k = last3Digits === 0 || last3Digits === 500;
    const status = endsIn5kOr0k ? "✓" : "✗";
    if (!endsIn5kOr0k) allPassed = false;
    console.log(`  ${status} ${row.product_name}: ${Math.round(perCup)}đ/cup (qty ${row.qty})`);
  }

  // Check 2: Topping COGS > 0
  console.log("\n--- Topping COGS check ---");
  const toppingRows = pnl.productProfitAnalysis.filter(p => p.product_id.startsWith("MOD:"));
  for (const row of toppingRows) {
    const hasCogs = row.cogs > 0;
    const status = hasCogs ? "✓" : "✗";
    if (!hasCogs) allPassed = false;
    console.log(`  ${status} ${row.product_name}: revenue ${row.revenue}, cogs ${row.cogs}, margin ${row.marginPct.toFixed(1)}%`);
  }

  // Check 3: No order has suspiciously large manual_order_discount
  console.log("\n--- Suspicious manual_order_discount check ---");
  const orders = await findAllNoCache("Orders_V2");
  const filteredOrders = orders.filter((o: any) =>
    o.status === "COMPLETED" && !o.superseded_by && o.created_at,
  );
  const suspicious = filteredOrders.filter((o: any) => {
    const gross = Number(o.gross_total || 0);
    const orderDiscount = Number(o.manual_order_discount || 0);
    return gross > 0 && orderDiscount / gross > 0.30;
  });
  if (suspicious.length > 0) {
    console.log(`  ✗ Found ${suspicious.length} orders with manual_order_discount > 30% of gross (suspicious)`);
    suspicious.slice(0, 5).forEach((o: any) => {
      const ratio = ((Number(o.manual_order_discount) / Number(o.gross_total)) * 100).toFixed(1);
      console.log(`    ${o.order_no}: gross ${o.gross_total}, manual_order ${o.manual_order_discount} (${ratio}%)`);
    });
    allPassed = false;
  } else {
    console.log(`  ✓ No orders with manual_order_discount > 30% of gross`);
  }

  console.log(`\n=== ${allPassed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"} ===`);
  if (!allPassed) process.exit(1);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
