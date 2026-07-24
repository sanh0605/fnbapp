import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Repairs the three orders identified by the 2026-07-24 full-history ledger
 * audit. PHD001128 and PHD001129 were voided without reversing their implicit
 * production rows; that polluted the balance used by PHD001132.
 *
 * Dry-run is the default. Pass --apply explicitly to write. The existing
 * rebuild_stock_ledger_for_order RPC supplies advisory locking, exact row-count
 * guards, per-order atomicity, source hashing, and recovery logging.
 */

const TARGET_ORDER_NOS = ["PHD001128", "PHD001129", "PHD001132"];

async function main() {
  const apply = process.argv.includes("--apply");
  const { createHash } = await import("node:crypto");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { buildTrustedPrimitiveLedger, replayFullHistory } = await import("../lib/full-history-recompute");
  const { buildVoidShortfallRepairPlan } = await import("../lib/void-order-ledger-repair");

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

  const { rows: trustedPrimitives, skippedPoReceipts } = buildTrustedPrimitiveLedger({
    purchaseOrders,
    purchaseOrderLines,
    purchasedItems,
    conversions,
    rawStockLedger: ledger,
  });
  const replay = replayFullHistory({
    orders,
    lines,
    recipes,
    semiProducts,
    trustedPrimitives,
  });
  if (skippedPoReceipts.length > 0 || replay.errors.length > 0) {
    throw new Error(
      `Full-history replay is not clean (skipped receipts: ${skippedPoReceipts.length}, errors: ${replay.errors.length})`,
    );
  }

  const plans = buildVoidShortfallRepairPlan({
    targetOrderNos: TARGET_ORDER_NOS,
    orders,
    rawLedger: ledger,
    computedLedger: replay.computedLedger,
  });

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN (no writes)"}`);
  console.log(`Target orders: ${plans.length}`);
  console.log(`Rows to delete: ${plans.reduce((sum, plan) => sum + plan.expectedDeleteCount, 0)}`);
  console.log(`Rows to insert: ${plans.reduce((sum, plan) => sum + plan.insertRows.length, 0)}`);
  for (const plan of plans) {
    console.log(`  ${plan.orderNo}: delete ${plan.expectedDeleteCount}, insert ${plan.insertRows.length}`);
  }

  const supabase = getSupabaseClient();
  let applied = 0;
  for (const plan of plans) {
    const sourceHash = createHash("sha256")
      .update(JSON.stringify(plan))
      .digest("hex");
    const params = {
      p_run_id: `void-shortfall-repair-${plan.orderId}`,
      p_order_id: plan.orderId,
      p_source_hash: sourceHash,
      p_expected_delete_count: plan.expectedDeleteCount,
      p_insert_rows: plan.insertRows,
      p_cost_changes: [],
      p_dry_run: true,
    };

    const { error: dryRunError } = await supabase.rpc("rebuild_stock_ledger_for_order", params);
    if (dryRunError) {
      throw new Error(`${plan.orderNo} dry-run refused: ${dryRunError.message}`);
    }
    if (!apply) continue;

    const { error: applyError } = await supabase.rpc("rebuild_stock_ledger_for_order", {
      ...params,
      p_dry_run: false,
    });
    if (applyError) {
      throw new Error(`${plan.orderNo} apply failed: ${applyError.message}`);
    }
    applied++;
  }

  if (!apply) {
    console.log("Dry-run checks passed. Re-run with --apply to write the repair.");
    return;
  }
  console.log(`Applied: ${applied} / ${plans.length} orders`);
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
