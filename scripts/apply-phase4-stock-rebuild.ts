import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 4 stock rebuild (docs/superpowers/plans/2026-07-29-phase4-stock-rebuild.md,
 * Task 2). Widens scripts/apply-full-history-stock-ledger-rebuild.ts's
 * correction-touched-only scope to every order in Orders_V2, reusing the same
 * replay engine and the same per-order rebuild_stock_ledger_for_order RPC
 * (migration 0034, suppression added in 0042) unchanged.
 *
 * This script writes stock rows only. Every RPC call passes p_cost_changes: []
 * and never reads audit_baseline_locks -- Phase 5 owns cost_at_sale. The
 * non-inventory exclusion (nonInventoryItems, threaded through
 * replayFullHistory in Phase 2b) is applied here too: without it, the rebuild
 * would regenerate SALES_CONSUME rows for Nuoc/Nuoc soi/Da vien across all of
 * history, undoing the point of the engine fix deployed in 9ae2ce5.
 *
 * Any order with at least one replay error, or that produced no computed
 * rows, is excluded from the rebuild entirely (lib/phase4-rebuild-scope.ts) --
 * partial rebuild of an order is never acceptable, since the RPC deletes an
 * order's whole derived row set before reinserting.
 *
 * A distinct run_id prefix (phase4-rebuild-, not full-history-rebuild-) keeps
 * data_recovery_changes idempotency checks from colliding with the narrower
 * 2026-07-24 correction run's rows for the same order ids -- this run's
 * computed insert rows differ (no cost changes, non-inventory excluded), so
 * reusing the old prefix would trip the RPC's source-hash mismatch guard for
 * every previously-touched order.
 *
 * Dry-run by default; --apply writes for real. Writes a full summary to
 * docs/audits/2026-07-29-phase4-rebuild-dryrun.json (or -apply.json).
 */

const DERIVED_TYPES = new Set([
  "SALES_CONSUME",
  "PRODUCTION_CONSUME",
  "PRODUCTION_YIELD",
  "RECLASSIFICATION_REVERSAL",
  "EDIT_REVERSAL",
  "EDIT_CONSUME",
]);

const RUN_ID_PREFIX = "phase4-rebuild-";

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { createHash } = await import("node:crypto");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { buildTrustedPrimitiveLedger, replayFullHistory } = await import("../lib/full-history-recompute");
  const { selectRebuildableOrders } = await import("../lib/phase4-rebuild-scope");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log("Loading data...");
  const [
    orders, lines, ledger, recipes, semiProducts,
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions,
    baseIngredients,
  ] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("UOM_Conversions"),
    findAllNoCache("Base_Ingredients"),
  ]) as any[][];

  const nameById = new Map<string, string>();
  for (const i of baseIngredients as any[]) nameById.set(i.id, i.name);
  for (const s of semiProducts as any[]) nameById.set(s.id, s.name);
  const nameOf = (id: string) => nameById.get(id) || id;

  const nonInventoryItems = new Set(
    (baseIngredients as any[])
      .filter(b => b.is_non_inventory === true || b.is_non_inventory === "TRUE")
      .map(b => b.id),
  );
  console.log(`Non-inventory ingredients excluded from replay: ${[...nonInventoryItems].map(nameOf).join(", ") || "(none)"}`);

  const supabase = getSupabaseClient();

  console.log("Replaying full history with the fixed engine (all orders)...");
  const { rows: trustedPrimitives } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  const { lineResults, computedLedger, errors } = replayFullHistory({
    orders, lines, recipes, semiProducts, trustedPrimitives, nonInventoryItems,
  });
  console.log(`Replay: ${lineResults.length} lines, ${errors.length} errors, ${computedLedger.length} computed rows.`);

  // replayFullHistory keys its own errors/rows by order.order_no (falls back
  // to id); reference_id on computed rows is always order.id. Remap error
  // prefixes to id so the exclusion scope lines up with the id-keyed maps
  // used everywhere else (stock_ledger.reference_id, the RPC's p_order_id).
  const orderNoToId = new Map<string, string>();
  for (const o of orders as any[]) {
    orderNoToId.set(o.order_no || o.id, o.id);
  }
  const remappedErrors = errors.map(e => {
    const idx = e.indexOf("/");
    if (idx === -1) return e;
    const prefix = e.slice(0, idx);
    const mappedId = orderNoToId.get(prefix);
    return mappedId ? `${mappedId}${e.slice(idx)}` : e;
  });

  const computedRowsByOrder = new Map<string, any[]>();
  for (const row of computedLedger) {
    const arr = computedRowsByOrder.get(row.reference_id) || [];
    arr.push(row);
    computedRowsByOrder.set(row.reference_id, arr);
  }

  const allOrderIds = (orders as any[]).map(o => o.id);
  const scope = selectRebuildableOrders({
    allOrderIds,
    replayErrors: remappedErrors,
    computedRowsByOrder,
  });
  const rebuildSet = new Set(scope.rebuildOrderIds);

  // Existing derived rows per order, needed for the RPC's expected-delete-
  // count guard and for the before/after per-item totals below.
  const existingDerivedRowsByOrder = new Map<string, any[]>();
  for (const row of ledger as any[]) {
    if (!DERIVED_TYPES.has(row.transaction_type)) continue;
    const arr = existingDerivedRowsByOrder.get(row.reference_id) || [];
    arr.push(row);
    existingDerivedRowsByOrder.set(row.reference_id, arr);
  }

  const insertRowsByOrder = new Map<string, any[]>();
  for (const row of computedLedger) {
    if (!rebuildSet.has(row.reference_id)) continue;
    const arr = insertRowsByOrder.get(row.reference_id) || [];
    arr.push({
      item_reference: row.item_reference,
      transaction_type: row.transaction_type,
      quantity_change: row.quantity_change,
      unit_cost: row.unit_cost,
      created_at: row.created_at,
    });
    insertRowsByOrder.set(row.reference_id, arr);
  }

  const totalDelete = scope.rebuildOrderIds.reduce(
    (s, id) => s + (existingDerivedRowsByOrder.get(id)?.length || 0), 0,
  );
  const totalInsert = scope.rebuildOrderIds.reduce(
    (s, id) => s + (insertRowsByOrder.get(id)?.length || 0), 0,
  );

  // Per-item before/after totals, for the owner's review.
  const beforeTotalByItem = new Map<string, number>();
  for (const row of ledger as any[]) {
    beforeTotalByItem.set(row.item_reference, (beforeTotalByItem.get(row.item_reference) || 0) + (Number(row.quantity_change) || 0));
  }
  const afterTotalByItem = new Map(beforeTotalByItem);
  for (const orderId of scope.rebuildOrderIds) {
    for (const row of existingDerivedRowsByOrder.get(orderId) || []) {
      afterTotalByItem.set(row.item_reference, (afterTotalByItem.get(row.item_reference) || 0) - (Number(row.quantity_change) || 0));
    }
    for (const row of insertRowsByOrder.get(orderId) || []) {
      afterTotalByItem.set(row.item_reference, (afterTotalByItem.get(row.item_reference) || 0) + (Number(row.quantity_change) || 0));
    }
  }
  const itemDeltas = [...afterTotalByItem.keys()]
    .map(itemId => {
      const before = beforeTotalByItem.get(itemId) || 0;
      const after = afterTotalByItem.get(itemId) || 0;
      return { item_id: itemId, name: nameOf(itemId), before, after, delta: after - before };
    })
    .filter(d => Math.abs(d.delta) > 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const stillNegative = [...afterTotalByItem.entries()]
    .filter(([, total]) => total < -0.01)
    .map(([itemId, total]) => ({ item_id: itemId, name: nameOf(itemId), balance: total }));

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Orders in Orders_V2: ${allOrderIds.length}`);
  console.log(`Orders to rebuild: ${scope.rebuildOrderIds.length}`);
  console.log(`Orders excluded: ${scope.excludedOrderIds.length}`);
  console.log(`Stock_Ledger rows to delete: ${totalDelete}`);
  console.log(`Stock_Ledger rows to insert (fresh): ${totalInsert}`);
  console.log(`Ingredients/semi-products with a changed total: ${itemDeltas.length}`);
  console.log(`Ingredients still negative after rebuild: ${stillNegative.length}`);

  // Step 6: verify the empty cost-change array is accepted, on one order,
  // before running the loop over everything.
  if (scope.rebuildOrderIds.length > 0) {
    const probeOrderId = scope.rebuildOrderIds[0];
    const probeInsertRows = insertRowsByOrder.get(probeOrderId) || [];
    const probeExpectedDelete = existingDerivedRowsByOrder.get(probeOrderId)?.length || 0;
    const probeHash = createHash("sha256")
      .update(JSON.stringify({ probe: true, expectedDeleteCount: probeExpectedDelete, insertRows: probeInsertRows }))
      .digest("hex");
    const { error: probeError } = await supabase.rpc("rebuild_stock_ledger_for_order", {
      p_run_id: `${RUN_ID_PREFIX}probe-${probeOrderId}`,
      p_order_id: probeOrderId,
      p_source_hash: probeHash,
      p_expected_delete_count: probeExpectedDelete,
      p_insert_rows: probeInsertRows,
      p_cost_changes: [],
      p_dry_run: true,
    });
    if (probeError) {
      console.error(`\nSTOP: empty p_cost_changes was rejected by the RPC for a probe call on order ${probeOrderId}: ${probeError.message}`);
      console.error("Not working around this -- report it rather than passing real cost changes.");
      process.exit(1);
    }
    console.log(`\nProbe call (empty p_cost_changes, order ${probeOrderId}): accepted.`);
  }

  const dryRunFailures: string[] = [];
  const applyFailures: string[] = [];
  let appliedOrders = 0;

  for (const orderId of scope.rebuildOrderIds) {
    const expectedDeleteCount = existingDerivedRowsByOrder.get(orderId)?.length || 0;
    const insertRows = insertRowsByOrder.get(orderId) || [];
    const runId = `${RUN_ID_PREFIX}${orderId}`;
    const sourceHash = createHash("sha256")
      .update(JSON.stringify({ expectedDeleteCount, insertRows, costChanges: [] }))
      .digest("hex");

    const { error: dryRunError } = await supabase.rpc("rebuild_stock_ledger_for_order", {
      p_run_id: runId,
      p_order_id: orderId,
      p_source_hash: sourceHash,
      p_expected_delete_count: expectedDeleteCount,
      p_insert_rows: insertRows,
      p_cost_changes: [],
      p_dry_run: true,
    });
    if (dryRunError) {
      dryRunFailures.push(`${orderId}: ${dryRunError.message}`);
      continue;
    }

    if (!apply) continue;

    const { error: applyError } = await supabase.rpc("rebuild_stock_ledger_for_order", {
      p_run_id: runId,
      p_order_id: orderId,
      p_source_hash: sourceHash,
      p_expected_delete_count: expectedDeleteCount,
      p_insert_rows: insertRows,
      p_cost_changes: [],
      p_dry_run: false,
    });
    if (applyError) {
      applyFailures.push(`${orderId}: ${applyError.message}`);
      continue;
    }
    appliedOrders++;
  }

  console.log(`\nDry-run checks failed: ${dryRunFailures.length}`);
  dryRunFailures.slice(0, 20).forEach(f => console.log(`  ${f}`));
  if (apply) {
    console.log(`\nApplied: ${appliedOrders} / ${scope.rebuildOrderIds.length} orders.`);
    if (applyFailures.length > 0) {
      console.log(`Apply failures: ${applyFailures.length}`);
      applyFailures.slice(0, 20).forEach(f => console.log(`  ${f}`));
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: apply ? "APPLY" : "DRY_RUN",
    orders_total: allOrderIds.length,
    orders_to_rebuild: scope.rebuildOrderIds.length,
    orders_excluded: scope.excludedOrderIds.length,
    excluded_orders: scope.excludedOrderIds.map(id => ({ order_id: id, reason: scope.exclusionReasons.get(id) || "" })),
    stock_ledger_rows_to_delete: totalDelete,
    stock_ledger_rows_to_insert: totalInsert,
    item_deltas: itemDeltas,
    still_negative_after_rebuild: stillNegative,
    dry_run_failures: dryRunFailures,
    applied_orders: apply ? appliedOrders : null,
    apply_failures: apply ? applyFailures : null,
    no_cost_changes_written: true,
  };
  const outPath = path.resolve(
    process.cwd(),
    apply ? "docs/audits/2026-07-29-phase4-rebuild-apply.json" : "docs/audits/2026-07-29-phase4-rebuild-dryrun.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${outPath}`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply only after the owner approves this summary.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
