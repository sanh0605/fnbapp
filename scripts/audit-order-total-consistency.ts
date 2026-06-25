import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 3.4 — Verify order total consistency:
 *   modal (sum of line-level fields) = stored order.net_total = table display
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ]);

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  let mismatchCount = 0;
  const mismatches: any[] = [];

  for (const order of orders as any[]) {
    if (order.status !== "COMPLETED") continue;
    const orderLines = linesByOrder.get(order.id) || [];

    const sumGrossLine = orderLines.reduce((s, l) => s + Number(l.gross_line_total || 0), 0);
    const sumPromoLine = orderLines.reduce((s, l) => s + Number(l.promo_discount || 0), 0);
    const sumManualItemLine = orderLines.reduce((s, l) => s + Number(l.manual_item_discount || 0), 0);
    const sumOrderAllocLine = orderLines.reduce((s, l) => s + Number(l.order_discount_allocation || 0), 0);
    const sumNetLine = orderLines.reduce((s, l) => s + Number(l.net_line_total || 0), 0);

    const expectedNet = sumGrossLine - sumPromoLine - sumManualItemLine - sumOrderAllocLine;

    const orderGross = Number(order.gross_total || 0);
    const orderPromo = Number(order.promo_discount_total || 0);
    const orderManualItem = Number(order.manual_item_discount_total || 0);
    const orderManualOrder = Number(order.manual_order_discount || 0);
    const orderNet = Number(order.net_total || 0);

    const issues: string[] = [];
    if (Math.abs(sumGrossLine - orderGross) > 1) issues.push(`gross: lines=${sumGrossLine} order=${orderGross}`);
    if (Math.abs(sumPromoLine - orderPromo) > 1) issues.push(`promo: lines=${sumPromoLine} order=${orderPromo}`);
    if (Math.abs(sumManualItemLine - orderManualItem) > 1) issues.push(`manual_item: lines=${sumManualItemLine} order=${orderManualItem}`);
    if (Math.abs(sumOrderAllocLine - orderManualOrder) > 1) issues.push(`order_alloc: lines=${sumOrderAllocLine} order=${orderManualOrder}`);
    if (Math.abs(expectedNet - orderNet) > 1) issues.push(`net: lines=${expectedNet} order=${orderNet}`);
    if (Math.abs(sumNetLine - orderNet) > 1) issues.push(`sum_net_line=${sumNetLine} vs order.net=${orderNet}`);

    if (issues.length > 0) {
      mismatchCount++;
      if (mismatches.length < 10) {
        mismatches.push({
          order_no: order.order_no,
          id: order.id,
          issues,
        });
      }
    }
  }

  console.log("=== ORDER TOTAL CONSISTENCY AUDIT ===");
  console.log(`COMPLETED orders checked: ${(orders as any[]).filter(o => o.status === "COMPLETED").length}`);
  console.log(`Mismatches: ${mismatchCount}`);

  if (mismatches.length > 0) {
    console.log("\nSample mismatches:");
    for (const m of mismatches) {
      console.log(`  ${m.order_no} (${m.id})`);
      for (const issue of m.issues) console.log(`    ${issue}`);
    }
  }

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
