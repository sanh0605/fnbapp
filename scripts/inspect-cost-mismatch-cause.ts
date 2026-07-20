import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only inspection of one cost-mismatch order (from the 82 remaining
 * after the aggregation-bug fix to investigate-btp-shortfall-historical-
 * correction.ts) to find why recomputed line.cost_at_sale differs from what
 * was recorded. Unlike the quantity mismatches (root-caused to a per-line
 * vs per-order aggregation bug in the check itself), this is a genuinely
 * different symptom: the recorded COGS for the line doesn't match a MAC
 * recompute using the same historical ledger/recipe state.
 */

async function main() {
  const orderNo = process.argv[2];
  if (!orderNo) {
    console.error("Usage: npx tsx scripts/inspect-cost-mismatch-cause.ts <order_no>");
    process.exit(1);
  }

  const { findAllNoCache } = await import("../lib/sheets_db");
  const {
    buildLineConsumptionRows,
    buildSemiProductRecipeMaps,
    buildInventoryBalances,
  } = await import("../lib/inventory-consumption");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const { computeMacCostForConsumptionRows, getMacUnitCost } = await import("../lib/mac-cogs");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const order = (orders as any[]).find(o => o.order_no === orderNo);
  if (!order) {
    console.error("Order not found");
    process.exit(1);
  }
  console.log(`Order ${orderNo}: id=${order.id} status=${order.status} created_at=${order.created_at}`);

  const orderLines = (lines as any[]).filter(l => l.order_id === order.id);
  const pastLedger = (ledger as any[]).filter(r => {
    const rowTime = new Date(r.created_at || 0).getTime();
    const orderTime = new Date(order.created_at).getTime();
    return rowTime <= orderTime && r.reference_id !== order.id;
  });
  const balances = buildInventoryBalances(pastLedger, order.created_at);
  const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[], order.created_at);

  for (const line of orderLines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    const implicitYields = new Map<string, number>();
    const rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), balances, consumptionMaps, implicitYields);
    if (implicitYields.size === 0) continue;

    const newCost = computeMacCostForConsumptionRows(rows, pastLedger, order.created_at, consumptionMaps);
    console.log(`\nLine ${line.id} qty=${line.qty} stored cost_at_sale=${line.cost_at_sale} recomputed=${newCost}`);
    console.log(`  recipe variant target_id=${lineRecipe.variant.target_id}`);
    for (const row of rows) {
      const unitCost = getMacUnitCost(pastLedger as any, row.item_reference, order.created_at);
      console.log(`    row item=${row.item_reference} qty=${row.quantity} source=${row.source} macUnitCostAsOfOrder=${unitCost}`);
    }
  }

  console.log(`\nLedger rows for this order:`);
  const orderLedgerRows = (ledger as any[])
    .filter(r => r.reference_id === order.id)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  for (const r of orderLedgerRows) {
    console.log([r.created_at, r.transaction_type, r.item_reference, `qty=${r.quantity_change}`, `unit_cost=${r.unit_cost}`, `source=${r.source}`].join(" | "));
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
