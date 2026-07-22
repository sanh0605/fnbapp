import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 4 of the owner-approved full-history rebuild plan
 * (C:\Users\Admin\.claude\plans\toasty-mapping-hollerith.md). Applies
 * ONLY Category A (unlocked) findings from
 * scripts/audit-full-history-recompute.ts's Phase 2 report -- lines with
 * no audit_baseline_locks row at all. Locked lines (Category B/C) are
 * never touched by this script; those need their own separate, explicitly
 * reviewed override per the plan, not an automated batch.
 *
 * Uses apply_full_history_recovery (migration 0031), which structurally
 * refuses to touch any locked line (checked twice: once for the whole
 * batch, once per line before the update) -- never the unconditional-
 * bypass pattern behind the COGS-5 incident.
 *
 * Re-runs the recompute engine fresh rather than trusting the persisted
 * JSON report, so the plan applied here always matches current live data.
 * Dry-run by default; --apply writes for real, one recovery run per order
 * (grouping all of that order's Category A lines together) for a clean
 * audit trail.
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
  const { data: locks, error: locksError } = await supabase
    .from("audit_baseline_locks")
    .select("order_line_id");
  if (locksError) throw new Error(locksError.message);
  const lockedLineIds = new Set((locks || []).map((l: any) => l.order_line_id));

  const { rows: trustedPrimitives } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  const { lineResults, errors } = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives });
  if (errors.length > 0) {
    console.log(`Replay errors: ${errors.length} (not blocking, these lines are simply excluded)`);
  }

  type Change = { line_id: string; order_id: string; old_cost_at_sale: number; new_cost_at_sale: number };
  const changesByOrder = new Map<string, Change[]>();
  for (const r of lineResults) {
    const delta = r.computed_cost_at_sale - r.stored_cost_at_sale;
    if (Math.abs(delta) <= 1) continue;
    if (lockedLineIds.has(r.line_id)) continue; // Category B/C -- never touched here.
    const arr = changesByOrder.get(r.order_id) || [];
    arr.push({ line_id: r.line_id, order_id: r.order_id, old_cost_at_sale: r.stored_cost_at_sale, new_cost_at_sale: r.computed_cost_at_sale });
    changesByOrder.set(r.order_id, arr);
  }

  const totalLines = [...changesByOrder.values()].reduce((s, arr) => s + arr.length, 0);
  const netDelta = [...changesByOrder.values()].flat().reduce((s, c) => s + (c.new_cost_at_sale - c.old_cost_at_sale), 0);
  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Category A (unlocked) lines to correct: ${totalLines} across ${changesByOrder.size} orders. Net delta: ${netDelta.toLocaleString()} VND`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  let appliedOrders = 0;
  let appliedLines = 0;
  const failures: string[] = [];

  for (const [orderId, changes] of changesByOrder) {
    const runId = `full-history-${orderId}`;
    const sourceHash = createHash("sha256").update(JSON.stringify(changes)).digest("hex");

    const { error: dryRunError } = await supabase.rpc("apply_full_history_recovery", {
      p_run_id: runId,
      p_source_hash: sourceHash,
      p_changes: changes,
      p_dry_run: true,
    });
    if (dryRunError) {
      failures.push(`${orderId}: dry-run check failed: ${dryRunError.message}`);
      continue;
    }

    const { error: applyError } = await supabase.rpc("apply_full_history_recovery", {
      p_run_id: runId,
      p_source_hash: sourceHash,
      p_changes: changes,
      p_dry_run: false,
    });
    if (applyError) {
      failures.push(`${orderId}: apply failed: ${applyError.message}`);
      continue;
    }

    appliedOrders++;
    appliedLines += changes.length;
  }

  console.log(`\nApplied: ${appliedOrders} orders, ${appliedLines} lines.`);
  if (failures.length > 0) {
    console.log(`Failures (skipped, not applied): ${failures.length}`);
    failures.forEach(f => console.log(`  ${f}`));
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
