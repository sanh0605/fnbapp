import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 1 empirical checkpoint (read-only). Runs lib/full-history-recompute.ts
 * against live data and reports the pre-2026-06-25 mismatch count, to check
 * whether the from-scratch design avoids the "209 -> 3,542" blowup seen when
 * the old balance-dependent methodology (lib/order-ledger-audit.ts) was
 * extended backward past the cutover. Per the plan, this must be verified
 * empirically, not assumed. Full Phase 2 diff report is a separate script.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { buildTrustedPrimitiveLedger, replayFullHistory } = await import("../lib/full-history-recompute");

  console.log("Loading data...");
  const [orders, lines, ledger, recipes, semiProducts, purchaseOrders, purchaseOrderLines, purchasedItems, conversions] =
    await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAllNoCache("Stock_Ledger"),
      findAllNoCache("Recipes"),
      findAllNoCache("Semi_Products"),
      findAllNoCache("Purchase_Orders"),
      findAllNoCache("Purchase_Order_Lines"),
      findAllNoCache("Purchased_Items"),
      findAllNoCache("UOM_Conversions"),
    ]) as any[][];

  console.log(`Orders: ${orders.length}, lines: ${lines.length}, ledger rows: ${ledger.length}`);
  console.log(`Purchase orders: ${purchaseOrders.length}, PO lines: ${purchaseOrderLines.length}`);

  const start = Date.now();
  const { rows: trustedPrimitives, skippedPoReceipts } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  console.log(`\nTrusted primitive ledger: ${trustedPrimitives.length} rows (${trustedPrimitives.filter(r => r.transaction_type === "PO_RECEIPT").length} re-derived PO_RECEIPT, rest trusted PRODUCTION_CONSUME/YIELD/STOCK_ADJUST)`);
  console.log(`Skipped PO receipts (missing item/conversion): ${skippedPoReceipts.length}`);
  if (skippedPoReceipts.length > 0) {
    console.log("Sample skips:", skippedPoReceipts.slice(0, 10));
  }

  const { lineResults, computedLedger, errors } = replayFullHistory({
    orders, lines, recipes, semiProducts, trustedPrimitives,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nReplay complete in ${elapsed}s. Line results: ${lineResults.length}. Errors: ${errors.length}. Computed ledger rows: ${computedLedger.length}`);
  if (errors.length > 0) {
    console.log("Sample errors:", errors.slice(0, 10));
  }

  const cutover = new Date("2026-06-25T07:31:08.402Z").getTime();
  const before = lineResults.filter(r => new Date(r.sale_time).getTime() < cutover);
  const after = lineResults.filter(r => new Date(r.sale_time).getTime() >= cutover);

  function summarize(label: string, rows: typeof lineResults) {
    const mismatches = rows.filter(r => Math.abs(r.computed_cost_at_sale - r.stored_cost_at_sale) > 1);
    const absDelta = mismatches.reduce((s, r) => s + Math.abs(r.computed_cost_at_sale - r.stored_cost_at_sale), 0);
    const netDelta = mismatches.reduce((s, r) => s + (r.computed_cost_at_sale - r.stored_cost_at_sale), 0);
    console.log(`${label}: ${rows.length} lines checked, ${mismatches.length} mismatched (>1 VND), abs delta ${absDelta.toLocaleString()} VND, net delta ${netDelta.toLocaleString()} VND`);
    return mismatches.length;
  }

  console.log("\n=== EMPIRICAL CHECKPOINT: pre vs post cutover mismatch counts ===");
  const beforeCount = summarize("Before 2026-06-25 cutover", before);
  summarize("On/after 2026-06-25 cutover", after);

  console.log(`\nKnown baselines for comparison: COGS-4 (old balance-dependent methodology, quantity-side) reported 3,542 mismatches when extended past the cutover (vs 209 within its designed scope). This engine's pre-cutover COST mismatch count: ${beforeCount}.`);
  console.log(beforeCount > 1000
    ? "\n*** BLOWUP DETECTED -- pre-cutover data does not look trustworthy under this methodology either. Needs investigation before treating this period as reliable. ***"
    : "\nNo blowup -- pre-cutover mismatch count is in a plausible, investigable range, not evidence of a fundamentally broken data foundation for this from-scratch method.");

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
