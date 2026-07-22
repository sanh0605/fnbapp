import * as dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Round 3 (2026-07-21) of the historical implicit-production-on-shortfall
 * quantity correction. Round 2 (corrected) matched recorded vs recomputed
 * consumption by a compound "<item_reference> <source>" key, which missed
 * a large population: older/migrated orders record their raw-ingredient
 * SALES_CONSUME with an EMPTY source field, while the recomputed key always
 * includes the full tagged recipe path (e.g.
 * "VARIANT_RECIPE:BTP_SHORTFALL:BTP-013") -- these never match by exact key
 * equality, so Round 2 classified them as "unexplained" (recordedQty=0)
 * even though a real recorded row exists, just filed under a different
 * source string. Confirmed directly: order PHD000702's Trứng gà (egg,
 * NNL-007) SALES_CONSUME row has source="" (empty), not a tagged path.
 *
 * Round 3 fixes this by matching per ITEM only (ignoring source) on the
 * recorded side: sums every existing SALES_CONSUME row for that raw item on
 * that order, regardless of source, and reverses EACH existing row
 * individually at its own recorded quantity (tagged with its own source +
 * a reclassify suffix) -- this handles any number/format of pre-existing
 * rows correctly without needing an exact key match. The recomputed side is
 * unchanged (still produces correctly-tagged fresh PRODUCTION_CONSUME rows
 * per recipe path). Same per-order "semi-product already accounted for
 * elsewhere" skip and [0.2, 5] sanity band as Round 2.
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

  const [orders, lines, ledger, recipes, semiProducts, baseIngredients] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Base_Ingredients"),
  ]) as any[][];

  const nameById = new Map<string, string>();
  for (const bi of baseIngredients as any[]) nameById.set(bi.id, bi.name);
  for (const sp of semiProducts as any[]) nameById.set(sp.id, sp.name);

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const ledgerByOrder = new Map<string, any[]>();
  for (const row of ledger as any[]) {
    if (!row.reference_id) continue;
    const rows = ledgerByOrder.get(row.reference_id) || [];
    rows.push(row);
    ledgerByOrder.set(row.reference_id, rows);
  }

  const alreadyCorrected = new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("RECLASSIFY_2026-07-20"))
      .map(r => r.reference_id),
  );

  const SHORTFALL_TAG = ":BTP_SHORTFALL:";
  const allOrderIds = (orders as any[]).map(o => o.id);

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Total orders considered: ${allOrderIds.length}`);
  console.log(`Already corrected (Round 1 + Round 2, idempotency skip): ${alreadyCorrected.size}`);

  const allNewEntries: any[] = [];
  let safeOrders = 0;
  let skippedAlreadyAccounted = 0;
  let unexplainedOrders = 0;
  let skippedAlreadyCorrected = 0;
  const unexplainedDetails: string[] = [];
  const correctedOrderNos: string[] = [];

  for (const orderId of allOrderIds) {
    if (alreadyCorrected.has(orderId)) {
      skippedAlreadyCorrected++;
      continue;
    }

    const order = (orders as any[]).find(o => o.id === orderId);
    if (!order) continue;
    const orderLines = linesByOrder.get(orderId) || [];
    const existingOrderLedgerRows = ledgerByOrder.get(orderId) || [];
    const itemsAlreadyOnLedger = new Set(existingOrderLedgerRows.map(r => r.item_reference));

    const pastLedger = (ledger as any[]).filter(r => {
      const rowTime = new Date(r.created_at || 0).getTime();
      const orderTime = new Date(order.created_at).getTime();
      return rowTime <= orderTime && r.reference_id !== order.id;
    });
    const balances = buildInventoryBalances(pastLedger, order.created_at);
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[], order.created_at);

    // Recorded SALES_CONSUME rows for this order, grouped by item only
    // (ignoring source -- this is the fix from Round 2).
    const recordedRowsByItem = new Map<string, any[]>();
    for (const row of existingOrderLedgerRows) {
      if (row.transaction_type !== "SALES_CONSUME") continue;
      const arr = recordedRowsByItem.get(row.item_reference) || [];
      arr.push(row);
      recordedRowsByItem.set(row.item_reference, arr);
    }

    const orderProductionConsumeRows: Array<{ item_reference: string; quantity: number; source: string }> = [];
    const orderProductionYieldRows: Array<{ item_reference: string; quantity: number }> = [];
    const recomputedByItem = new Map<string, number>();
    let orderSkippedAlreadyAccounted = false;

    for (const line of orderLines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const implicitYields = new Map<string, number>();
      const rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), balances, consumptionMaps, implicitYields);
      if (implicitYields.size === 0) continue;

      const semiProductIdsInvolved = [...implicitYields.keys()].map(key => {
        const tagIndex = key.lastIndexOf(SHORTFALL_TAG);
        return tagIndex < 0 ? key : key.slice(tagIndex + SHORTFALL_TAG.length);
      });
      const semiProductsAlreadyRecorded = semiProductIdsInvolved.filter(item => itemsAlreadyOnLedger.has(item));
      if (semiProductsAlreadyRecorded.length > 0) {
        orderSkippedAlreadyAccounted = true;
        continue;
      }

      const { productionConsumeRows, productionYieldRows } = splitImplicitProduction(rows, implicitYields);
      for (const row of productionConsumeRows) {
        recomputedByItem.set(row.item_reference, (recomputedByItem.get(row.item_reference) || 0) + row.quantity);
      }
      orderProductionConsumeRows.push(...productionConsumeRows);
      orderProductionYieldRows.push(...productionYieldRows);
    }

    if (orderSkippedAlreadyAccounted) skippedAlreadyAccounted++;
    if (recomputedByItem.size === 0) continue;

    let orderUnexplained = false;
    let orderHasAnyRealMatch = false;
    for (const [item, recomputedQty] of recomputedByItem) {
      const recordedRows = recordedRowsByItem.get(item) || [];
      const recordedQty = recordedRows.reduce((s, r) => s + Math.abs(Number(r.quantity_change)), 0);
      if (recordedQty === 0) {
        orderUnexplained = true;
        unexplainedDetails.push(`${order.order_no} item ${item}(${nameById.get(item) || "?"}): no recorded SALES_CONSUME to reclassify (recomputed=${recomputedQty})`);
        continue;
      }
      orderHasAnyRealMatch = true;
      const ratio = recomputedQty / recordedQty;
      if (Math.abs(recordedQty - recomputedQty) <= 0.01) continue;
      if (ratio < 0.2 || ratio > 5) {
        orderUnexplained = true;
        unexplainedDetails.push(
          `${order.order_no} item ${item}(${nameById.get(item) || "?"}): recorded=${recordedQty} recomputed=${recomputedQty} (ratio ${ratio.toFixed(3)} outside sanity band)`,
        );
      }
    }

    if (orderUnexplained || !orderHasAnyRealMatch) {
      unexplainedOrders++;
      continue;
    }

    const orderEntries: any[] = [];
    const now = new Date().toISOString();

    // Reverse EACH existing recorded row individually, at its own quantity
    // and its own source (tagged with a reclassify suffix) -- this is the
    // Round 3 fix, avoids needing an exact key match.
    for (const [item] of recomputedByItem) {
      const recordedRows = recordedRowsByItem.get(item) || [];
      for (const row of recordedRows) {
        orderEntries.push({
          id: `stk-${crypto.randomUUID()}`,
          item_reference: item,
          transaction_type: "RECLASSIFICATION_REVERSAL",
          quantity_change: Math.abs(Number(row.quantity_change)),
          unit_cost: 0,
          reference_id: orderId,
          source: `${row.source || "UNTAGGED"}:RECLASSIFY_2026-07-20`,
          notes: "Reverses original mis-classified SALES_CONSUME row (BTP shortfall reclassification, round 3 -- item-level match, source-agnostic)",
          created_at: now,
        });
      }
    }

    for (const row of orderProductionConsumeRows) {
      orderEntries.push({
        id: `stk-${crypto.randomUUID()}`,
        item_reference: row.item_reference,
        transaction_type: "PRODUCTION_CONSUME",
        quantity_change: -row.quantity,
        unit_cost: 0,
        reference_id: orderId,
        source: `${row.source}:RECLASSIFY_2026-07-20`,
        notes: "Implicit production input for BTP shortfall reclassification (round 3, quantity per the recipe version effective at sale time)",
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
        notes: "Implicit production yield for BTP shortfall reclassification (round 3)",
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
        notes: "Additional semi-product sale consumption folded in from BTP shortfall reclassification (round 3)",
        created_at: now,
      });
    }

    if (orderEntries.length > 0) {
      safeOrders++;
      correctedOrderNos.push(order.order_no);
      allNewEntries.push(...orderEntries);
    }
  }

  console.log(`\nSafe orders to correct this run: ${safeOrders}`);
  console.log(`Skipped -- semi-product already accounted for elsewhere: ${skippedAlreadyAccounted}`);
  console.log(`Unexplained orders (excluded): ${unexplainedOrders}`);
  console.log(`Skipped (already corrected): ${skippedAlreadyCorrected}`);
  console.log(`Total new ledger entries: ${allNewEntries.length}`);

  if (unexplainedDetails.length > 0) {
    console.log(`\nUnexplained samples (first 15):`);
    for (const d of unexplainedDetails.slice(0, 15)) console.log(`  ${d}`);
  }

  console.log(`\nCorrected order numbers (first 30): ${correctedOrderNos.slice(0, 30).join(", ")}${correctedOrderNos.length > 30 ? ` ... (+${correctedOrderNos.length - 30} more)` : ""}`);

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
