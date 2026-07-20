import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only check: the one thing that MUST be true after tonight's
 * lib/order-ledger-audit.ts fix is that none of the 377 orders corrected by
 * scripts/apply-btp-shortfall-historical-correction.ts (tagged
 * "RECLASSIFY_2026-07-20" in stock_ledger.source) show up in
 * scripts/audit-order-ledger.ts's mismatch list. Any remaining mismatches for
 * OTHER orders are a separate, already-known issue (the deferred 102-order
 * recipe-version mismatch, and/or a pre-existing pre-cutover recipe/ingredient
 * identity drift), not something this check is about.
 */

async function main() {
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const BTP_SHORTFALL_CUTOVER_AT = "2026-06-25T07:31:08.402Z";
  const report = auditOrderLedger({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
    shortfallCutoverAt: BTP_SHORTFALL_CUTOVER_AT,
  });

  const auditMismatchOrderIds = new Set(report.mismatches.map(m => m.order_id));

  const correctedOrderIds = new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("RECLASSIFY_2026-07-20"))
      .map(r => r.reference_id),
  );

  const correctedButStillFlagged = [...correctedOrderIds].filter(id => auditMismatchOrderIds.has(id));

  console.log(`Orders corrected by the 2026-07-20 historical correction: ${correctedOrderIds.size}`);
  console.log(`Of those, still flagged as a mismatch by the audit: ${correctedButStillFlagged.length}`);
  if (correctedButStillFlagged.length > 0) {
    for (const id of correctedButStillFlagged) {
      const order = (orders as any[]).find(o => o.id === id);
      const rows = report.mismatches.filter(m => m.order_id === id);
      console.log(`  ${order?.order_no || id}:`);
      for (const r of rows) {
        console.log(`    item=${r.item_reference} expected=${r.expected_quantity} actual=${r.actual_quantity} delta=${r.delta}`);
      }
    }
  } else {
    console.log("None -- all 377 corrected orders are clean under the fixed audit.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
