import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Giai doan 2 of the owner-approved full-rebuild plan
 * (C:\Users\Admin\.claude\plans\toasty-mapping-hollerith.md, revised
 * 2026-07-24 scope). Uses the fixed replay engine (lib/full-history-recompute.ts,
 * TRUSTED_PRIMITIVE_TYPES = STOCK_ADJUST only) to recompute Stock_Ledger from
 * scratch for every order that any prior correction round (2026-07-20, 07-21,
 * 07-22) ever touched, and replaces that order's ENTIRE set of derived rows
 * (SALES_CONSUME/PRODUCTION_CONSUME/PRODUCTION_YIELD/RECLASSIFICATION_REVERSAL/
 * EDIT_REVERSAL/EDIT_CONSUME -- genuine and correction-script rows alike) with
 * a single fresh computation. Orders no correction round ever touched are
 * never included -- their rows stay completely untouched.
 *
 * Orders_V2, Order_Lines_V2 (except cost_at_sale), Purchase_Orders, Recipes:
 * never written. PO_RECEIPT/STOCK_ADJUST rows: never touched.
 *
 * Dry-run by default; --apply writes for real, one rebuild_stock_ledger_for_order
 * RPC call per affected order (see migration 0034).
 */

function isClaudeInserted(row: any): boolean {
  return (row.source || "").includes("RECLASSIFY");
}

const DERIVED_TYPES = new Set([
  "SALES_CONSUME",
  "PRODUCTION_CONSUME",
  "PRODUCTION_YIELD",
  "RECLASSIFICATION_REVERSAL",
  "EDIT_REVERSAL",
  "EDIT_CONSUME",
]);

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { createHash } = await import("node:crypto");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { buildTrustedPrimitiveLedger, replayFullHistory } = await import("../lib/full-history-recompute");

  console.log("Loading data...");
  const [orders, lines, ledger, recipes, semiProducts, purchaseOrders, purchaseOrderLines, purchasedItems, conversions] =
    await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAllNoCache("Stock_Ledger"),
      findAllNoCache("Recipes"),
      findAllNoCache("Semi_Products"),
      findAllNoCache("Purchase_Orders"),
      findAllNoCache("Purchase_Order_Lines"),
      findAllNoCache("Purchased_Items"),
      findAllNoCache("UOM_Conversions"),
    ]) as any[][];

  const supabase = getSupabaseClient();
  const { data: locks, error: locksError } = await supabase
    .from("audit_baseline_locks")
    .select("order_line_id");
  if (locksError) throw new Error(locksError.message);
  const lockedLineIds = new Set((locks || []).map((l: any) => l.order_line_id));

  // Affected-order set: any order with >=1 row ever inserted by a correction script.
  const affectedOrderIds = new Set(
    (ledger as any[]).filter(isClaudeInserted).map((r: any) => r.reference_id)
  );
  console.log(`Affected orders (any correction round ever touched): ${affectedOrderIds.size}`);

  // Current derived-row count per order, for the RPC's expected-count guard.
  const existingDerivedCountByOrder = new Map<string, number>();
  for (const row of ledger as any[]) {
    if (!DERIVED_TYPES.has(row.transaction_type)) continue;
    if (!affectedOrderIds.has(row.reference_id)) continue;
    existingDerivedCountByOrder.set(row.reference_id, (existingDerivedCountByOrder.get(row.reference_id) || 0) + 1);
  }

  console.log("Replaying full history with the fixed engine...");
  const { rows: trustedPrimitives } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  const { lineResults, computedLedger, errors } = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives });
  if (errors.length > 0) {
    console.log(`Replay errors: ${errors.length} (not blocking, these lines are simply excluded)`);
    errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
  }

  // Fresh insert rows, scoped to affected orders only.
  const insertRowsByOrder = new Map<string, any[]>();
  for (const row of computedLedger) {
    if (!affectedOrderIds.has(row.reference_id)) continue;
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

  // Cost changes, scoped to affected orders only, skipping locked lines and no-op deltas.
  type CostChange = { line_id: string; old_cost_at_sale: number; new_cost_at_sale: number };
  const costChangesByOrder = new Map<string, CostChange[]>();
  let skippedLockedLines = 0;
  for (const r of lineResults) {
    if (!affectedOrderIds.has(r.order_id)) continue;
    if (Math.abs(r.computed_cost_at_sale - r.stored_cost_at_sale) <= 1) continue;
    if (lockedLineIds.has(r.line_id)) {
      skippedLockedLines++;
      continue;
    }
    const arr = costChangesByOrder.get(r.order_id) || [];
    arr.push({ line_id: r.line_id, old_cost_at_sale: r.stored_cost_at_sale, new_cost_at_sale: r.computed_cost_at_sale });
    costChangesByOrder.set(r.order_id, arr);
  }

  const totalDelete = [...existingDerivedCountByOrder.values()].reduce((s, n) => s + n, 0);
  const totalInsert = [...insertRowsByOrder.values()].reduce((s, arr) => s + arr.length, 0);
  const totalCostChanges = [...costChangesByOrder.values()].reduce((s, arr) => s + arr.length, 0);

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Orders to rebuild: ${affectedOrderIds.size}`);
  console.log(`Stock_Ledger rows to delete: ${totalDelete}`);
  console.log(`Stock_Ledger rows to insert (fresh): ${totalInsert}`);
  console.log(`order_lines_v2.cost_at_sale updates: ${totalCostChanges}`);
  if (skippedLockedLines > 0) {
    console.log(`Cost updates skipped (audit-baseline locked, left untouched): ${skippedLockedLines}`);
  }

  let appliedOrders = 0;
  let dryRunFailures: string[] = [];
  let applyFailures: string[] = [];

  for (const orderId of affectedOrderIds) {
    const expectedDeleteCount = existingDerivedCountByOrder.get(orderId) || 0;
    const insertRows = insertRowsByOrder.get(orderId) || [];
    const costChanges = costChangesByOrder.get(orderId) || [];
    const runId = `full-history-rebuild-${orderId}`;
    const sourceHash = createHash("sha256")
      .update(JSON.stringify({ expectedDeleteCount, insertRows, costChanges }))
      .digest("hex");

    const { data: dryRunData, error: dryRunError } = await supabase.rpc("rebuild_stock_ledger_for_order", {
      p_run_id: runId,
      p_order_id: orderId,
      p_source_hash: sourceHash,
      p_expected_delete_count: expectedDeleteCount,
      p_insert_rows: insertRows,
      p_cost_changes: costChanges,
      p_dry_run: true,
    });
    if (dryRunError) {
      dryRunFailures.push(`${orderId}: ${dryRunError.message}`);
      continue;
    }

    if (!apply) {
      continue;
    }

    const { error: applyError } = await supabase.rpc("rebuild_stock_ledger_for_order", {
      p_run_id: runId,
      p_order_id: orderId,
      p_source_hash: sourceHash,
      p_expected_delete_count: expectedDeleteCount,
      p_insert_rows: insertRows,
      p_cost_changes: costChanges,
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

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  console.log(`\nApplied: ${appliedOrders} / ${affectedOrderIds.size} orders.`);
  if (applyFailures.length > 0) {
    console.log(`Apply failures: ${applyFailures.length}`);
    applyFailures.slice(0, 20).forEach(f => console.log(`  ${f}`));
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
