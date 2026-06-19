/**
 * Reconcile V1 vs V2 reports for a date range.
 *
 * Pre-WS-5-migration: V2 will likely have 0 orders, V1 will have many.
 * Post-WS-5-migration: V1 and V2 should match within ±1đ per order.
 *
 * Usage:
 *   npx tsx scripts/reconcile-v1-v2.ts                                # current month
 *   npx tsx scripts/reconcile-v1-v2.ts --start=2026-06-01 --end=2026-06-30
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache } = require("../lib/sheets_db");

function parseArgs(): { start: string; end: string } {
  const args = process.argv.slice(2);
  const get = (key: string): string | undefined => {
    const found = args.find(a => a.startsWith(`--${key}=`));
    return found ? found.split("=")[1] : undefined;
  };

  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    start: get("start") || defaultStart.toISOString(),
    end: get("end") || defaultEnd.toISOString(),
  };
}

async function main() {
  const { start, end } = parseArgs();
  console.log(`\n=== Reconciliation ${start} → ${end} ===\n`);

  const [v1Orders, v1Lines, v2Orders, v2Lines] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ]);

  // V1 filter
  const v1Filtered = (v1Orders as any[]).filter(o => {
    if (o.status !== "COMPLETED") return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= new Date(start) && d <= new Date(end);
  });

  // V2 filter (latest COMPLETED only)
  const v2Filtered = (v2Orders as any[]).filter(o => {
    if (o.status !== "COMPLETED") return false;
    if (o.superseded_by && o.superseded_by !== "") return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= new Date(start) && d <= new Date(end);
  });

  // V1 totals (legacy formula)
  let v1Revenue = 0;
  let v1LineDiscountSum = 0;
  const v1LineIds = new Set(v1Filtered.map(o => o.id));
  for (const line of v1Lines as any[]) {
    if (!v1LineIds.has(line.order_id)) continue;
    v1LineDiscountSum += Number(line.line_discount || 0) + Number(line.line_manual_discount || 0);
  }
  for (const o of v1Filtered) {
    v1Revenue += Number(o.total_amount || 0);
  }

  // V2 totals (stored values)
  const v2Revenue = v2Filtered.reduce((s, o) => s + Number(o.net_total || 0), 0);
  const v2LineIds = new Set(v2Filtered.map(o => o.id));
  let v2LineCOGS = 0;
  let v2PromoDiscount = 0;
  for (const line of v2Lines as any[]) {
    if (!v2LineIds.has(line.order_id)) continue;
    v2LineCOGS += Number(line.cost_at_sale || 0);
    v2PromoDiscount += Number(line.promo_discount || 0);
  }
  const v2GrossTotal = v2Filtered.reduce((s, o) => s + Number(o.gross_total || 0), 0);

  console.log("V1 (legacy):");
  console.log(`  Orders:           ${v1Filtered.length}`);
  console.log(`  Total revenue:    ${v1Revenue.toLocaleString("vi-VN")}đ`);
  console.log(`  Line discounts:   ${v1LineDiscountSum.toLocaleString("vi-VN")}đ`);
  console.log();
  console.log("V2 (new):");
  console.log(`  Orders:           ${v2Filtered.length}`);
  console.log(`  Gross total:      ${v2GrossTotal.toLocaleString("vi-VN")}đ`);
  console.log(`  Promo discounts:  ${v2PromoDiscount.toLocaleString("vi-VN")}đ`);
  console.log(`  Net revenue:      ${v2Revenue.toLocaleString("vi-VN")}đ`);
  console.log(`  COGS:             ${v2LineCOGS.toLocaleString("vi-VN")}đ`);
  console.log();

  if (v1Filtered.length === 0 && v2Filtered.length === 0) {
    console.log("Neither V1 nor V2 has orders in this range.");
  } else if (v2Filtered.length === 0) {
    console.log(`⚠ V2 has 0 orders. WS-5 migration has not run yet — V2 reports will show no data.`);
  } else if (v1Filtered.length === 0) {
    console.log(`ℹ V1 has 0 orders (legacy already archived?). V2 has ${v2Filtered.length}.`);
  } else {
    const drift = v1Revenue - v2Revenue;
    console.log(`Drift (V1 - V2): ${drift.toLocaleString("vi-VN")}đ`);
    if (Math.abs(drift) > v1Filtered.length) {
      console.log(`⚠ Drift exceeds ${v1Filtered.length}đ (1đ/order tolerance). Investigate before WS-5 cutover.`);
    } else {
      console.log(`✓ Drift within ${v1Filtered.length}đ tolerance. Migration OK.`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
