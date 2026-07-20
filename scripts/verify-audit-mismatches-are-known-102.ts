import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only cross-check: confirms that every order flagged by
 * scripts/audit-order-ledger.ts after the 2026-07-20 order-ledger-audit fix
 * belongs to the already-known "102 mismatch, deferred for later
 * investigation" set produced by
 * scripts/investigate-btp-shortfall-historical-correction.ts -- i.e. that the
 * remaining mismatch count is the pre-existing, deferred recipe-version issue
 * surfacing cleanly, not a new regression introduced by tonight's fix.
 */

async function main() {
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
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

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const shortfallOrderIds = [...new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("BTP_SHORTFALL"))
      .map(r => r.reference_id),
  )];

  const known102: string[] = [];
  for (const orderId of shortfallOrderIds) {
    const order = (orders as any[]).find(o => o.id === orderId);
    if (!order) continue;
    const orderLines = linesByOrder.get(orderId) || [];

    const pastLedger = (ledger as any[]).filter(r => {
      const rowTime = new Date(r.created_at || 0).getTime();
      const orderTime = new Date(order.created_at).getTime();
      return rowTime <= orderTime && r.reference_id !== orderId;
    });
    const balances = buildInventoryBalances(pastLedger, order.created_at);
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[], order.created_at);

    const actualRows = (ledger as any[]).filter(
      r => r.reference_id === orderId && r.transaction_type === "SALES_CONSUME",
    );
    const actualByItemSource = new Map<string, number>();
    for (const r of actualRows) {
      const key = `${r.item_reference} ${r.source}`;
      actualByItemSource.set(key, (actualByItemSource.get(key) || 0) + Number(r.quantity_change));
    }

    let orderMismatched = false;
    for (const line of orderLines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const implicitYields = new Map<string, number>();
      const rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), balances, consumptionMaps, implicitYields);
      if (implicitYields.size === 0) continue;

      const newCost = computeMacCostForConsumptionRows(rows, pastLedger, order.created_at, consumptionMaps);
      if (Math.abs(newCost - Number(line.cost_at_sale)) > 1) {
        orderMismatched = true;
        continue;
      }
      const { splitImplicitProduction } = await import("../lib/inventory-consumption");
      const { productionConsumeRows } = splitImplicitProduction(rows, implicitYields);
      for (const row of productionConsumeRows) {
        const key = `${row.item_reference} ${row.source}`;
        const actualQty = Math.abs(actualByItemSource.get(key) || 0);
        if (Math.abs(actualQty - row.quantity) > 0.01) {
          orderMismatched = true;
        }
      }
    }
    if (orderMismatched) known102.push(orderId);
  }

  const known102Set = new Set(known102);
  const auditOnlyNotIn102 = [...auditMismatchOrderIds].filter(id => !known102Set.has(id));
  const known102NotInAudit = known102.filter(id => !auditMismatchOrderIds.has(id));

  console.log(`Audit mismatch orders (distinct): ${auditMismatchOrderIds.size}`);
  console.log(`Known deferred (recipe-version) mismatch orders: ${known102Set.size}`);
  console.log(`Audit-flagged orders NOT in the known-102 set (should be 0 or explainable): ${auditOnlyNotIn102.length}`);
  if (auditOnlyNotIn102.length > 0) {
    for (const id of auditOnlyNotIn102.slice(0, 30)) {
      const order = (orders as any[]).find(o => o.id === id);
      console.log(`  NEW/unexplained: ${order?.order_no || id} status=${order?.status}`);
    }
  }
  console.log(`Known-102 orders NOT flagged by audit (should be 0, would mean audit under-reports): ${known102NotInAudit.length}`);
  if (known102NotInAudit.length > 0) {
    for (const id of known102NotInAudit.slice(0, 30)) {
      const order = (orders as any[]).find(o => o.id === id);
      console.log(`  MISSED: ${order?.order_no || id} status=${order?.status}`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
