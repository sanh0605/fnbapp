import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only. Quantifies the scope of the 2026-07-21 finding: do migrated
 * (bulk-imported, order_id prefix "ord-migrated-") historical order lines'
 * cost_at_sale reflect a true MAC recomputation? Recomputes every migrated
 * line directly via buildLineConsumptionRows/computeMacCostForConsumptionRows
 * (same functions the rest of tonight's corrections use) and reports any
 * mismatch. Lines whose recipe snapshot yields zero consumption rows are
 * skipped (not an error -- e.g. legitimately free/modifier-only lines).
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const {
    buildLineConsumptionRows,
    buildSemiProductRecipeMaps,
    buildInventoryBalances,
  } = await import("../lib/inventory-consumption");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const { computeMacCostForConsumptionRows } = await import("../lib/mac-cogs");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const migratedOrders = (orders as any[]).filter(o => String(o.id).startsWith("ord-migrated-"));
  const migratedOrderIds = new Set(migratedOrders.map(o => o.id));
  const migratedLines = (lines as any[]).filter(l => migratedOrderIds.has(l.order_id));

  console.log(`Migrated orders: ${migratedOrders.length}`);
  console.log(`Migrated order lines: ${migratedLines.length}`);
  console.log(`Total orders: ${(orders as any[]).length}, total lines: ${(lines as any[]).length}`);

  const dates = migratedOrders.map(o => new Date(o.created_at).getTime()).filter(t => !Number.isNaN(t));
  if (dates.length > 0) {
    console.log(`Migrated order date range: ${new Date(Math.min(...dates)).toISOString()} to ${new Date(Math.max(...dates)).toISOString()}`);
  }

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  let mismatchCount = 0;
  let sumAbsDelta = 0;
  let sumNetDelta = 0;
  let maxDelta = 0;
  let errors = 0;
  let processed = 0;
  const sampleMismatches: Array<{ orderNo: string; lineId: string; stored: number; recomputed: number; delta: number }> = [];

  for (const order of migratedOrders) {
    const orderLines = linesByOrder.get(order.id) || [];
    const pastLedger = (ledger as any[]).filter(r => {
      const rowTime = new Date(r.created_at || 0).getTime();
      const orderTime = new Date(order.created_at).getTime();
      return rowTime <= orderTime && r.reference_id !== order.id;
    });
    const balances = buildInventoryBalances(pastLedger, order.created_at);
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[], order.created_at);

    for (const line of orderLines) {
      processed++;
      try {
        const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
        const rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), new Map(balances), consumptionMaps);
        if (rows.length === 0) continue;
        const newCost = computeMacCostForConsumptionRows(rows, pastLedger, order.created_at, consumptionMaps);
        const stored = Number(line.cost_at_sale);
        const delta = newCost - stored;
        if (Math.abs(delta) > 1) {
          mismatchCount++;
          sumAbsDelta += Math.abs(delta);
          sumNetDelta += delta;
          if (Math.abs(delta) > Math.abs(maxDelta)) maxDelta = delta;
          if (sampleMismatches.length < 15) {
            sampleMismatches.push({ orderNo: order.order_no, lineId: line.id, stored, recomputed: newCost, delta });
          }
        }
      } catch {
        errors++;
      }
    }
  }

  console.log(`\nProcessed ${processed} migrated lines. Errors during recompute: ${errors}`);
  console.log(`Mismatches (>1 VND): ${mismatchCount}`);
  console.log(`Sum of absolute deltas: ${sumAbsDelta.toLocaleString()} VND`);
  console.log(`Sum of net deltas: ${sumNetDelta.toLocaleString()} VND`);
  console.log(`Max single-line delta: ${maxDelta.toLocaleString()} VND`);
  console.log(`\nSample mismatches:`);
  for (const s of sampleMismatches) {
    console.log(`  ${s.orderNo} line=${s.lineId}: stored=${s.stored} recomputed=${s.recomputed} delta=${s.delta}`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
