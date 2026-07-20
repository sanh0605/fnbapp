import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Follow-up to the 2026-07-20 implicit-production-shortfall historical
 * correction: that work fixed raw-ingredient QUANTITY across all 479
 * shortfall orders but deliberately left cost_at_sale untouched (a separate
 * concern). This drives the existing, already-tested lib/backdated-ledger/
 * pipeline (recomputeEventDryRun / recomputeEventApply, backed by the
 * atomic apply_backdated_event_recovery RPC from migration 0015) over every
 * PENDING backdated_ledger_events row -- default dry-run, --apply to write.
 *
 * Does not touch REJECTED or already-RECOMPUTED events. Idempotent: the RPC
 * itself detects and safely no-ops a re-run of an already-applied event.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { recomputeEventDryRun, recomputeEventApply } = await import("../lib/backdated-ledger/recompute-event");

  const supabase = getSupabaseClient();
  const { data: events, error } = await supabase
    .from("backdated_ledger_events")
    .select("*")
    .eq("status", "PENDING");
  if (error) throw new Error(error.message);

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`PENDING backdated_ledger_events: ${events?.length || 0}`);

  let totalChanges = 0;
  let totalDeltaVnd = 0;

  for (const event of events || []) {
    const plan = await recomputeEventDryRun(event.id);
    const deltaVnd = plan.changes.reduce((sum, c) => sum + (c.new_cost_at_sale - c.old_cost_at_sale), 0);
    totalChanges += plan.changes.length;
    totalDeltaVnd += deltaVnd;

    console.log(`\nEvent ${event.id} (item=${event.item_reference}, effective=${event.effective_timestamp}, visibility=${event.visibility_timestamp}):`);
    console.log(`  Affected lines: ${plan.affected_lines.length}, cost changes: ${plan.changes.length}, delta: ${deltaVnd} VND`);
    for (const change of plan.changes) {
      console.log(`    line=${change.line_id} order=${change.order_id} old=${change.old_cost_at_sale} new=${change.new_cost_at_sale}`);
    }

    if (apply && plan.changes.length > 0) {
      const result = await recomputeEventApply(event.id, "Claude");
      console.log(`  Applied: ${JSON.stringify(result.apply_result)} / ${JSON.stringify(result.mark_result)}`);
    }
  }

  console.log(`\nTotal cost_at_sale changes across all PENDING events: ${totalChanges}`);
  console.log(`Total delta: ${totalDeltaVnd} VND`);
  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
