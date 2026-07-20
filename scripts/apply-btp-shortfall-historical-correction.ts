import * as dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Applies the Method-1 historical correction (owner-approved 2026-07-20,
 * see docs/superpowers/plans/2026-07-20-implicit-production-shortfall-design.md
 * and the dry-run report from scripts/investigate-btp-shortfall-historical-correction.ts)
 * to every historically shortfall-affected order not yet corrected.
 *
 * Inserts only -- never updates or deletes an existing stock_ledger row.
 * Idempotent: an order already carrying a "RECLASSIFY_2026-07-20"-tagged
 * row is skipped, so re-running this script after a partial run or a crash
 * does not double-apply.
 *
 * Design (updated 2026-07-20 after owner review -- see
 * investigate-btp-shortfall-historical-correction.ts's header comment for
 * the full reasoning):
 * - cost_at_sale is never read or written by this script. It is a separate
 *   concern (backdated-PO/recipe cost drift) handled by lib/backdated-ledger/.
 * - RECLASSIFICATION_REVERSAL always reverses the exact RECORDED quantity.
 * - PRODUCTION_CONSUME always uses the RECOMPUTED quantity (the raw-
 *   ingredient amount implied by the semi-product recipe version truly
 *   effective at the order's own sale time). These differ only for a
 *   handful of orders sold right at a recipe-version boundary; reversing
 *   the recorded amount and re-consuming the recomputed amount nets to the
 *   correct final stock balance with no separate adjustment entry needed.
 * - A per-item ratio outside [0.2, 5] between recorded and recomputed is
 *   treated as still-unexplained and the whole order is skipped (excluded,
 *   not corrected) -- no case seen through 479 orders as of 2026-07-20 falls
 *   outside this band.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, insertMany } = await import("../lib/sheets_db");
  const {
    buildLineConsumptionRows,
    buildSemiProductRecipeMaps,
    buildInventoryBalances,
    splitImplicitProduction,
  } = await import("../lib/inventory-consumption");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const alreadyCorrected = new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("RECLASSIFY_2026-07-20"))
      .map(r => r.reference_id),
  );

  const shortfallOrderIds = [...new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("BTP_SHORTFALL"))
      .map(r => r.reference_id),
  )];

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Orders with a historical shortfall event: ${shortfallOrderIds.length}`);
  console.log(`Already corrected (idempotency skip): ${alreadyCorrected.size}`);

  const allNewEntries: any[] = [];
  let safeOrders = 0;
  let recipeVersionAdjustedOrders = 0;
  let unexplainedOrders = 0;
  let skippedAlreadyCorrected = 0;
  const unexplainedDetails: string[] = [];

  for (const orderId of shortfallOrderIds) {
    if (alreadyCorrected.has(orderId)) {
      skippedAlreadyCorrected++;
      continue;
    }

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

    const orderProductionConsumeRows: Array<{ item_reference: string; quantity: number; source: string }> = [];
    const orderProductionYieldRows: Array<{ item_reference: string; quantity: number }> = [];
    const recomputedByKey = new Map<string, number>();

    for (const line of orderLines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const implicitYields = new Map<string, number>();
      const rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), balances, consumptionMaps, implicitYields);
      if (implicitYields.size === 0) continue;

      const { productionConsumeRows, productionYieldRows } = splitImplicitProduction(rows, implicitYields);
      for (const row of productionConsumeRows) {
        const key = `${row.item_reference} ${row.source}`;
        recomputedByKey.set(key, (recomputedByKey.get(key) || 0) + row.quantity);
      }
      orderProductionConsumeRows.push(...productionConsumeRows);
      orderProductionYieldRows.push(...productionYieldRows);
    }

    let orderUnexplained = false;
    let orderVersionAdjusted = false;
    for (const [key, recomputedQty] of recomputedByKey) {
      const recordedQty = Math.abs(actualByItemSource.get(key) || 0);
      if (recordedQty === 0) continue;
      const ratio = recomputedQty / recordedQty;
      if (Math.abs(recordedQty - recomputedQty) <= 0.01) continue;
      if (ratio < 0.2 || ratio > 5) {
        orderUnexplained = true;
        unexplainedDetails.push(
          `${order.order_no} item ${key}: recorded=${recordedQty} recomputed=${recomputedQty} (ratio ${ratio.toFixed(3)} outside sanity band)`,
        );
      } else {
        orderVersionAdjusted = true;
      }
    }

    if (orderUnexplained) {
      unexplainedOrders++;
      continue;
    }
    if (orderVersionAdjusted) recipeVersionAdjustedOrders++;

    const orderEntries: any[] = [];
    const now = new Date().toISOString();
    for (const row of orderProductionConsumeRows) {
      const key = `${row.item_reference} ${row.source}`;
      const recordedQty = Math.abs(actualByItemSource.get(key) || 0);
      const tag = `${row.source}:RECLASSIFY_2026-07-20`;
      orderEntries.push({
        id: `stk-${crypto.randomUUID()}`,
        item_reference: row.item_reference,
        transaction_type: "RECLASSIFICATION_REVERSAL",
        quantity_change: recordedQty,
        unit_cost: 0,
        reference_id: orderId,
        source: tag,
        notes: "Reverses original mis-classified SALES_CONSUME row (BTP shortfall reclassification)",
        created_at: now,
      });
      orderEntries.push({
        id: `stk-${crypto.randomUUID()}`,
        item_reference: row.item_reference,
        transaction_type: "PRODUCTION_CONSUME",
        quantity_change: -row.quantity,
        unit_cost: 0,
        reference_id: orderId,
        source: tag,
        notes: "Implicit production input for BTP shortfall reclassification (quantity per the recipe version effective at sale time)",
        created_at: now,
      });
    }
    for (const yieldRow of orderProductionYieldRows) {
      orderEntries.push({
        id: `stk-${crypto.randomUUID()}`,
        item_reference: yieldRow.item_reference,
        transaction_type: "PRODUCTION_YIELD",
        quantity_change: yieldRow.quantity,
        unit_cost: 0,
        reference_id: orderId,
        source: "AUTO_SHORTFALL_PRODUCTION:RECLASSIFY_2026-07-20",
        notes: "Implicit production yield for BTP shortfall reclassification",
        created_at: now,
      });
      orderEntries.push({
        id: `stk-${crypto.randomUUID()}`,
        item_reference: yieldRow.item_reference,
        transaction_type: "SALES_CONSUME",
        quantity_change: -yieldRow.quantity,
        unit_cost: 0,
        reference_id: orderId,
        source: "VARIANT_RECIPE:RECLASSIFY_2026-07-20",
        notes: "Additional semi-product sale consumption folded in from BTP shortfall reclassification",
        created_at: now,
      });
    }

    if (orderEntries.length > 0) {
      safeOrders++;
      allNewEntries.push(...orderEntries);
    }
  }

  console.log(`\nSafe orders to correct this run: ${safeOrders} (of which ${recipeVersionAdjustedOrders} needed a recipe-version quantity correction)`);
  console.log(`Unexplained orders (excluded): ${unexplainedOrders}`);
  console.log(`Skipped (already corrected): ${skippedAlreadyCorrected}`);
  console.log(`Total new ledger entries: ${allNewEntries.length}`);

  if (unexplainedDetails.length > 0) {
    console.log(`\nUnexplained details:`);
    for (const d of unexplainedDetails) console.log(`  ${d}`);
  }

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these entries.");
    return;
  }

  const BATCH_SIZE = 500;
  let written = 0;
  for (let i = 0; i < allNewEntries.length; i += BATCH_SIZE) {
    const batch = allNewEntries.slice(i, i + BATCH_SIZE);
    await insertMany("Stock_Ledger", batch);
    written += batch.length;
    console.log(`  Inserted ${written}/${allNewEntries.length} entries...`);
  }

  console.log(`\nDone. Inserted ${written} new stock_ledger entries across ${safeOrders} orders.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
