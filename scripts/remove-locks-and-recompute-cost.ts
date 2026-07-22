import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Owner decision 2026-07-22: stop preserving per-cohort locked cost
 * decisions; apply the single from-scratch ground-truth engine
 * (lib/full-history-recompute.ts) uniformly, including to lines currently
 * protected by audit_baseline_locks. Owner explicitly confirmed: "anh cần
 * sửa tất cả mà, anh đâu có muốn khoá nữa. Anh cần chính xác 100% theo
 * từng sản phẩm từng đơn."
 *
 * For every currently-locked line where the engine's computed cost_at_sale
 * differs from the current stored value: removes the lock via
 * remove_audit_baseline_lock (migration 0032, logs the removal to
 * data_recovery_changes with the full prior lock row before deleting), then
 * applies the new value via apply_full_history_recovery (migration 0031,
 * now succeeds since the line is no longer locked).
 *
 * Dry-run by default; --apply writes for real.
 */

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
  const { data: locks, error: locksError } = await supabase.from("audit_baseline_locks").select("order_line_id");
  if (locksError) throw new Error(locksError.message);
  const lockedLineIds = new Set((locks || []).map((l: any) => l.order_line_id));
  console.log(`Currently locked lines: ${lockedLineIds.size}`);

  const { rows: trustedPrimitives } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  const { lineResults, errors } = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives });
  if (errors.length > 0) console.log(`Replay errors (excluded): ${errors.length}`);

  type Change = { line_id: string; order_id: string; old_cost_at_sale: number; new_cost_at_sale: number };
  const changesByOrder = new Map<string, Change[]>();
  for (const r of lineResults) {
    if (!lockedLineIds.has(r.line_id)) continue;
    const delta = r.computed_cost_at_sale - r.stored_cost_at_sale;
    if (Math.abs(delta) <= 1) continue;
    const arr = changesByOrder.get(r.order_id) || [];
    arr.push({ line_id: r.line_id, order_id: r.order_id, old_cost_at_sale: r.stored_cost_at_sale, new_cost_at_sale: r.computed_cost_at_sale });
    changesByOrder.set(r.order_id, arr);
  }
  const totalLines = [...changesByOrder.values()].reduce((s, arr) => s + arr.length, 0);
  const netDelta = [...changesByOrder.values()].flat().reduce((s, c) => s + (c.new_cost_at_sale - c.old_cost_at_sale), 0);

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Locked lines needing correction: ${totalLines} across ${changesByOrder.size} orders. Net delta: ${netDelta.toLocaleString()} VND`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  let unlockedCount = 0;
  let appliedOrders = 0;
  let appliedLines = 0;
  const failures: string[] = [];

  for (const [orderId, changes] of changesByOrder) {
    // Remove the lock for every line in this order first.
    for (const change of changes) {
      const { error: removeError } = await supabase.rpc("remove_audit_baseline_lock", {
        p_order_line_id: change.line_id,
        p_reviewer: "Claude",
        p_reason: "Owner decision 2026-07-22: stop preserving per-cohort locked cost decisions, apply the single from-scratch ground-truth engine (lib/full-history-recompute.ts) uniformly. See CLAUDE.md section 9 and docs/audits/2026-07-22-lock-removal-and-full-recompute.md.",
      });
      if (removeError) {
        failures.push(`${change.line_id}: lock removal failed: ${removeError.message}`);
        continue;
      }
      unlockedCount++;
    }

    const runId = `full-history-unlocked-${orderId}`;
    const sourceHash = createHash("sha256").update(JSON.stringify(changes)).digest("hex");

    const { error: dryRunError } = await supabase.rpc("apply_full_history_recovery", {
      p_run_id: runId, p_source_hash: sourceHash, p_changes: changes, p_dry_run: true,
    });
    if (dryRunError) { failures.push(`${orderId}: dry-run check failed: ${dryRunError.message}`); continue; }

    const { error: applyError } = await supabase.rpc("apply_full_history_recovery", {
      p_run_id: runId, p_source_hash: sourceHash, p_changes: changes, p_dry_run: false,
    });
    if (applyError) { failures.push(`${orderId}: apply failed: ${applyError.message}`); continue; }

    appliedOrders++;
    appliedLines += changes.length;
  }

  console.log(`\nLocks removed: ${unlockedCount}`);
  console.log(`Applied: ${appliedOrders} orders, ${appliedLines} lines.`);
  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`);
    failures.forEach(f => console.log(`  ${f}`));
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
