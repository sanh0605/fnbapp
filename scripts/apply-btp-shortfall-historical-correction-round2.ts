import * as dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Round 2 (corrected, 2026-07-21) of the historical implicit-production-on-
 * shortfall quantity correction. See
 * docs/operations/implicit-production-quantity-correction-playbook.md for
 * the full incident this rewrite is fixing: a first attempt assumed every
 * order with implicitYields.size > 0 used the pre-2026-07-20 bug pattern
 * (raw ingredient directly debited, semi-product itself never touched) --
 * wrong for orders already touched by an earlier, unrelated correction
 * pass, where the semi-product ITSELF was directly debited (meaning its
 * raw ingredients were already accounted for elsewhere). That version
 * double-counted consumption for those orders and was fully rolled back.
 *
 * The fix: before reclassifying anything for an order, check what's
 * ACTUALLY recorded for that order, not just what the recipe recompute
 * expects.
 * - If the semi-product itself already has ANY stock_ledger row for this
 *   order (any transaction type) -- its consumption is already accounted
 *   for somewhere; SKIP this order/semi-product entirely, do not reclassify.
 * - Else if the raw ingredients show a direct SALES_CONSUME for this order
 *   (the classic pre-fix bug, verified against the egg/Trứng gà case and
 *   Round 1's 479 orders) -- reverse it and reclassify, same as Round 1.
 * - Else (neither the semi-product nor the raw ingredients have any
 *   recorded row) -- unexplained, skip and report for manual review rather
 *   than guessing.
 *
 * Everything else is unchanged from Round 1: insert-only, same
 * RECLASSIFICATION_REVERSAL + PRODUCTION_CONSUME + PRODUCTION_YIELD shape,
 * same [0.2, 5] sanity band, same RECLASSIFY_2026-07-20 idempotency tag
 * (Round 1's 2026-07-20 rows are skipped automatically; this run's rows get
 * today's date, same as the rolled-back attempt, distinguishable the same
 * way if a rollback is ever needed again).
 *
 * IMPORTANT: correcting these stock quantities changes the raw-ingredient
 * MAC basis for every subsequent sale of the same items -- a full
 * cost_at_sale re-verification pass across all affected raw ingredients is
 * required after this and is tracked as a separate follow-up step.
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

  const allOrderIds = (orders as any[]).map(o => o.id);

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Total orders considered: ${allOrderIds.length}`);
  console.log(`Already corrected (idempotency skip): ${alreadyCorrected.size}`);

  const allNewEntries: any[] = [];
  let safeOrders = 0;
  let skippedAlreadyAccounted = 0;
  let unexplainedOrders = 0;
  let skippedAlreadyCorrected = 0;
  const unexplainedDetails: string[] = [];
  const alreadyAccountedDetails: string[] = [];
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
      return rowTime <= orderTime && r.reference_id !== orderId;
    });
    const balances = buildInventoryBalances(pastLedger, order.created_at);
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[], order.created_at);

    const actualRows = existingOrderLedgerRows.filter(r => r.transaction_type === "SALES_CONSUME");
    const actualByItemSource = new Map<string, number>();
    for (const r of actualRows) {
      const key = `${r.item_reference} ${r.source}`;
      actualByItemSource.set(key, (actualByItemSource.get(key) || 0) + Number(r.quantity_change));
    }

    const orderProductionConsumeRows: Array<{ item_reference: string; quantity: number; source: string }> = [];
    const orderProductionYieldRows: Array<{ item_reference: string; quantity: number }> = [];
    const recomputedByKey = new Map<string, number>();
    let orderSkippedAlreadyAccounted = false;

    for (const line of orderLines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const implicitYields = new Map<string, number>();
      const rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), balances, consumptionMaps, implicitYields);
      if (implicitYields.size === 0) continue;

      // Critical check (this is what Round 1's rewrite adds): if the
      // semi-product itself already has ANY ledger row for this order, its
      // consumption is already accounted for somewhere else -- do not
      // reclassify, or we double-count raw-ingredient consumption.
      // implicitYields is keyed by a compound "<parentSource>:BTP_SHORTFALL:<itemReference>"
      // string (see splitImplicitProduction), not the plain item id -- must
      // parse it the same way before comparing against the ledger.
      const SHORTFALL_TAG = ":BTP_SHORTFALL:";
      const semiProductIdsInvolved = [...implicitYields.keys()].map(key => {
        const tagIndex = key.lastIndexOf(SHORTFALL_TAG);
        return tagIndex < 0 ? key : key.slice(tagIndex + SHORTFALL_TAG.length);
      });
      const semiProductsAlreadyRecorded = semiProductIdsInvolved.filter(item => itemsAlreadyOnLedger.has(item));
      if (semiProductsAlreadyRecorded.length > 0) {
        orderSkippedAlreadyAccounted = true;
        alreadyAccountedDetails.push(
          `${order.order_no}: semi-product(s) ${semiProductsAlreadyRecorded.map(i => nameById.get(i) || i).join(", ")} already has a ledger row for this order -- skipping`,
        );
        continue;
      }

      const { productionConsumeRows, productionYieldRows } = splitImplicitProduction(rows, implicitYields);
      for (const row of productionConsumeRows) {
        const key = `${row.item_reference} ${row.source}`;
        recomputedByKey.set(key, (recomputedByKey.get(key) || 0) + row.quantity);
      }
      orderProductionConsumeRows.push(...productionConsumeRows);
      orderProductionYieldRows.push(...productionYieldRows);
    }

    if (orderSkippedAlreadyAccounted) skippedAlreadyAccounted++;
    if (recomputedByKey.size === 0) continue;

    let orderUnexplained = false;
    let orderHasAnyRealMatch = false;
    for (const [key, recomputedQty] of recomputedByKey) {
      const recordedQty = Math.abs(actualByItemSource.get(key) || 0);
      if (recordedQty === 0) {
        // No direct raw-ingredient debit recorded at all for this key --
        // neither the classic old-bug pattern nor an already-accounted
        // semi-product. Unexplained; do not guess.
        orderUnexplained = true;
        unexplainedDetails.push(`${order.order_no} key ${key}: no recorded SALES_CONSUME to reclassify (recomputed=${recomputedQty})`);
        continue;
      }
      orderHasAnyRealMatch = true;
      const ratio = recomputedQty / recordedQty;
      if (Math.abs(recordedQty - recomputedQty) <= 0.01) continue;
      if (ratio < 0.2 || ratio > 5) {
        orderUnexplained = true;
        unexplainedDetails.push(
          `${order.order_no} item ${key}: recorded=${recordedQty} recomputed=${recomputedQty} (ratio ${ratio.toFixed(3)} outside sanity band)`,
        );
      }
    }

    if (orderUnexplained || !orderHasAnyRealMatch) {
      unexplainedOrders++;
      continue;
    }

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
        notes: "Reverses original mis-classified SALES_CONSUME row (BTP shortfall reclassification, round 2 corrected)",
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
        notes: "Implicit production input for BTP shortfall reclassification (round 2 corrected, quantity per the recipe version effective at sale time)",
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
        notes: "Implicit production yield for BTP shortfall reclassification (round 2 corrected)",
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
        notes: "Additional semi-product sale consumption folded in from BTP shortfall reclassification (round 2 corrected)",
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

  if (alreadyAccountedDetails.length > 0) {
    console.log(`\nAlready-accounted samples (first 10):`);
    for (const d of alreadyAccountedDetails.slice(0, 10)) console.log(`  ${d}`);
  }
  if (unexplainedDetails.length > 0) {
    console.log(`\nUnexplained samples (first 10):`);
    for (const d of unexplainedDetails.slice(0, 10)) console.log(`  ${d}`);
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
