import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only. Characterizes the 18 cost_at_sale mismatches found during
 * tonight's 2026-07-20 BTP-shortfall historical correction that have NO
 * matching backdated_ledger_events row (confirmed via
 * scripts/verify-82-mismatches-explained.ts) and confirmed NOT to overlap
 * with the already-closed Task 3.8/3.9 "historical gap" lock cohort
 * (order_no ranges don't intersect: locked cohort is PHD000502-618/
 * UCK000105-272, these are PHD000795-899).
 *
 * For each, finds the causal raw-ingredient PO_RECEIPT row(s) consumed by
 * the affected line and reports whether they look like the same seed-era
 * phenomenon (hand-assigned "STK-0XX"/"STK-GEN-..." style IDs, a round
 * timestamp like 17:00:00, predating the backdating-detection trigger) that
 * Task 3.8 already characterized for its own 41-line cohort.
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

  const shortfallOrderIds = [...new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("BTP_SHORTFALL"))
      .map(r => r.reference_id),
  )];

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const results: Array<{
    orderNo: string;
    lineId: string;
    stored: number;
    recomputed: number;
    delta: number;
    consumedItems: string[];
    causalReceipts: Array<{ id: string; item: string; created_at: string; unit_cost: number; idLooksSeeded: boolean }>;
  }> = [];

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

    for (const line of orderLines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const implicitYields = new Map<string, number>();
      const rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), balances, consumptionMaps, implicitYields);
      if (implicitYields.size === 0) continue;

      const newCost = computeMacCostForConsumptionRows(rows, pastLedger, order.created_at, consumptionMaps);
      if (Math.abs(newCost - Number(line.cost_at_sale)) <= 1) continue;

      const consumedItems = [...new Set(rows.map(r => r.item_reference))];
      const causalReceipts = (pastLedger as any[])
        .filter(r => r.transaction_type === "PO_RECEIPT" && consumedItems.includes(r.item_reference))
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 3)
        .map(r => ({
          id: r.id,
          item: r.item_reference,
          created_at: r.created_at,
          unit_cost: Number(r.unit_cost),
          idLooksSeeded: /^STK-\d{3}$|^STK-GEN-/.test(r.id || ""),
        }));

      results.push({
        orderNo: order.order_no,
        lineId: line.id,
        stored: Number(line.cost_at_sale),
        recomputed: newCost,
        delta: newCost - Number(line.cost_at_sale),
        consumedItems,
        causalReceipts,
      });
    }
  }

  console.log(`Total cost mismatches found: ${results.length}`);
  for (const r of results) {
    console.log(`\n${r.orderNo} line=${r.lineId}: stored=${r.stored} recomputed=${r.recomputed} delta=${r.delta}`);
    console.log(`  consumed items: ${r.consumedItems.join(", ")}`);
    console.log(`  most recent PO_RECEIPTs for these items:`);
    for (const rec of r.causalReceipts) {
      console.log(`    ${rec.id} item=${rec.item} created_at=${rec.created_at} unit_cost=${rec.unit_cost} seeded_id_pattern=${rec.idLooksSeeded}`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
