/**
 * Diagnostic: verify Sales vs P&L date filter discrepancy.
 *
 * Hypothesis: sales/page.tsx pre-converts date-only "2026-06-26" to ISO via
 * `new Date()` (UTC midnight), then passes ISO to getSalesDataV2.
 * `toSaigonUtcRange` passes ISO through unchanged -> Sales misses the first
 * 7 hours of the Saigon day.
 *
 * P&L page passes date-only directly -> correctly handles Saigon timezone.
 *
 * Claude code — diagnosis for bug report 2026-06-26.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { ORDER_STATUS } = await import("../lib/order-types");
  const { toSaigonUtcRange } = await import("../lib/report-time");

  const orders = await findAllNoCache("Orders_V2");
  const orderLines = await findAllNoCache("Order_Lines_V2");

  const completed = (orders as any[]).filter(
    (o) =>
      o.status === ORDER_STATUS.COMPLETED &&
      !(o.superseded_by && o.superseded_by !== "") &&
      o.created_at,
  );

  console.log("Total COMPLETED orders:", completed.length);

  // P&L semantics: date-only string passed to toSaigonUtcRange.
  const pnlRange = toSaigonUtcRange("2026-06-26", "2026-06-26")!;
  console.log("\nP&L range (date-only input):");
  console.log("  startUtc:", pnlRange.startUtc.toISOString());
  console.log("  endUtc:  ", pnlRange.endUtc.toISOString());

  // Sales page post-fix: also passes date-only string (no pre-conversion).
  const salesRange = toSaigonUtcRange("2026-06-26", "2026-06-26")!;
  console.log("\nSales range (post-fix, date-only input):");
  console.log("  startUtc:", salesRange.startUtc.toISOString());
  console.log("  endUtc:  ", salesRange.endUtc.toISOString());

  console.log("\nRanges identical:", pnlRange.startUtc.getTime() === salesRange.startUtc.getTime() && pnlRange.endUtc.getTime() === salesRange.endUtc.getTime());

  const pnlOrders = completed.filter((o) => {
    const d = new Date(o.created_at);
    return d >= pnlRange.startUtc && d <= pnlRange.endUtc;
  });
  const salesOrders = completed.filter((o) => {
    const d = new Date(o.created_at);
    return d >= salesRange.startUtc && d <= salesRange.endUtc;
  });

  console.log("\nOrders in P&L range:", pnlOrders.length);
  console.log("Orders in Sales range:", salesOrders.length);

  const salesIds = new Set(salesOrders.map((o) => o.id));
  const pnlOnly = pnlOrders.filter((o) => !salesIds.has(o.id));

  console.log("Missed by Sales (P&L only):", pnlOnly.length);
  if (pnlOnly.length > 0) {
    console.log("\nMissed order details:");
    for (const o of pnlOnly) {
      console.log(
        `  ${o.order_no} | created_at=${o.created_at} | net_total=${o.net_total}`,
      );
    }

    const missedByProduct = new Map<string, number>();
    for (const o of pnlOnly) {
      const lines = (orderLines as any[]).filter((l) => l.order_id === o.id);
      for (const l of lines) {
        const snap = JSON.parse(l.product_snapshot_json || "{}");
        const name = snap.name || l.product_id;
        missedByProduct.set(
          name,
          (missedByProduct.get(name) || 0) + Number(l.qty),
        );
      }
    }
    console.log("\nMissed qty by product:");
    for (const [name, qty] of missedByProduct.entries()) {
      console.log(`  ${name}: ${qty}`);
    }
  }

  console.log("\n--- P&L product totals ---");
  printProductQty(pnlOrders, orderLines as any[]);
  console.log("\n--- Sales product totals ---");
  printProductQty(salesOrders, orderLines as any[]);
}

function printProductQty(orders: any[], allLines: any[]) {
  const orderIds = new Set(orders.map((o) => o.id));
  const lines = allLines.filter((l) => orderIds.has(l.order_id));
  const byProduct = new Map<string, number>();
  for (const l of lines) {
    const snap = JSON.parse(l.product_snapshot_json || "{}");
    const name = snap.name || l.product_id;
    byProduct.set(name, (byProduct.get(name) || 0) + Number(l.qty));
  }
  const sorted = Array.from(byProduct.entries()).sort((a, b) => b[1] - a[1]);
  let total = 0;
  for (const [name, qty] of sorted) {
    console.log(`  ${name}: ${qty}`);
    total += qty;
  }
  console.log(`  TOTAL: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
