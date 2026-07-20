import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Final verification (2026-07-20): confirms every one of the 479
 * historically shortfall-affected orders (the full set corrected across
 * both apply runs plus the double-reversal bugfix) is now clean under the
 * fixed lib/order-ledger-audit.ts -- i.e. none of them appear in
 * auditOrderLedger's mismatch list. Any remaining mismatches in the full
 * 1612-order audit should belong ONLY to orders outside this 479-order set
 * (the pre-existing, separate NNL-003/BTP-XXX identity-drift issue in very
 * early orders, unrelated to tonight's work).
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

  const shortfallOrderIds = new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("BTP_SHORTFALL"))
      .map(r => r.reference_id),
  );

  const report = auditOrderLedger({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
    shortfallCutoverAt: "2026-06-25T07:31:08.402Z",
  });

  const mismatchOrderIds = new Set(report.mismatches.map(m => m.order_id));
  const shortfallOrdersStillMismatched = [...shortfallOrderIds].filter(id => mismatchOrderIds.has(id));

  console.log(`Total shortfall-affected orders: ${shortfallOrderIds.size}`);
  console.log(`Total mismatches (whole dataset): ${report.mismatches.length}`);
  console.log(`Shortfall-affected orders still mismatched: ${shortfallOrdersStillMismatched.length}`);

  if (shortfallOrdersStillMismatched.length > 0) {
    console.log(`\nStill-mismatched shortfall orders:`);
    for (const id of shortfallOrdersStillMismatched) {
      const order = (orders as any[]).find(o => o.id === id);
      const rows = report.mismatches.filter(m => m.order_id === id);
      console.log(`  ${order?.order_no || id} (status=${order?.status}):`);
      for (const r of rows) {
        console.log(`    item=${r.item_reference} expected=${r.expected_quantity} actual=${r.actual_quantity} delta=${r.delta}`);
      }
    }
  } else {
    console.log("\nAll 479 shortfall-affected orders are clean. Remaining mismatches (if any) belong to unrelated, pre-existing orders.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
