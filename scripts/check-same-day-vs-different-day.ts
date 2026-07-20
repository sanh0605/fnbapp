import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only. For each of the cost mismatches found in
 * investigate-18-unflagged-cost-mismatches.ts, classifies the causal
 * PO_RECEIPT as same-day or different-day relative to the order's sale
 * date. Per owner clarification (2026-07-20): these seed-era PO_RECEIPT
 * rows always show 17:00:00 UTC (00:00 Vietnam time) because the owner
 * intentionally defaulted to start-of-day when manually entering historical
 * purchases without remembering the exact time -- the DATE itself is a
 * deliberate, accurate memory, only the time-of-day is a placeholder. This
 * means a receipt dated a full day (or more) before the sale is safe to
 * trust for recompute; a receipt dated the SAME day as the sale carries
 * genuine same-day ordering ambiguity (which happened first that day is
 * unknown).
 */

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

function ictDate(isoString: string): string {
  return new Date(new Date(isoString).getTime() + ICT_OFFSET_MS).toISOString().slice(0, 10);
}

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

  let sameDayCount = 0;
  let differentDayCount = 0;
  const sameDayDetails: string[] = [];
  const differentDayDetails: string[] = [];

  for (const orderId of shortfallOrderIds) {
    const order = (orders as any[]).find(o => o.id === orderId);
    if (!order) continue;
    const orderLines = linesByOrder.get(orderId) || [];
    const orderDate = ictDate(order.created_at);

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
      const seededReceipts = (pastLedger as any[]).filter(r =>
        r.transaction_type === "PO_RECEIPT" &&
        consumedItems.includes(r.item_reference) &&
        /^STK-\d{3}$|^STK-GEN-/.test(r.id || ""),
      );
      if (seededReceipts.length === 0) continue;

      const mostRecentSeeded = seededReceipts.sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      )[0];
      const receiptDate = ictDate(mostRecentSeeded.created_at);

      const detail = `${order.order_no} sale=${order.created_at} receipt=${mostRecentSeeded.id}@${mostRecentSeeded.created_at} (item=${mostRecentSeeded.item_reference})`;
      if (receiptDate === orderDate) {
        sameDayCount++;
        sameDayDetails.push(detail);
      } else {
        differentDayCount++;
        differentDayDetails.push(detail);
      }
    }
  }

  console.log(`Different-day (receipt clearly before sale's day): ${differentDayCount}`);
  console.log(`Same-day (genuine ordering ambiguity): ${sameDayCount}`);
  if (sameDayDetails.length > 0) {
    console.log(`\nSame-day cases (need individual judgment):`);
    for (const d of sameDayDetails) console.log(`  ${d}`);
  }
  console.log(`\nFirst 10 different-day cases (safe to trust the receipt date):`);
  for (const d of differentDayDetails.slice(0, 10)) console.log(`  ${d}`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
