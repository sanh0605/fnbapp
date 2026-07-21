import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-time recovery (2026-07-21) for the 41-line Task 3.9
 * BACKDATED_LEDGER_HISTORICAL_GAP cohort (docs/audits/2026-07-16-task-3.9-lock-result.md),
 * locked 2026-07-16 pending owner confirmation that the 5 underlying
 * backdated PO receipts genuinely arrived before the affected sales.
 * Owner gave that confirmation this session (2026-07-21): PO receipt
 * timestamps are always midnight-of-day placeholders, entered without the
 * real time of day, but the DATE itself is accurate and goods always
 * arrive before the shop opens for sales -- the same standing confirmation
 * that unblocked the rest of tonight's corrections.
 *
 * Uses the purpose-built apply_mac_drift_recovery RPC (migration 0016)
 * directly, with the EXACT stored_cost_at_sale/expected_cost_at_sale
 * values already recorded in audit_baseline_locks by Task 3.9 -- these
 * were already reviewed and Claude-approved on 2026-07-16 (source hash
 * 2ac54a604fc03c438dbf8f99039e57d068b8b270aadb092bf74a2e5a0538ae24), so
 * this does not recompute anything fresh, only replays the already-
 * approved plan. The RPC sets app.mac_drift_recovery=on during apply,
 * which is what actually lifts the prevent_audit_locked_order_line_mutation
 * trigger for these rows -- no lock row is deleted or modified.
 *
 * Dry-run (p_dry_run=true) previews without writing; --apply runs for real.
 */

const SOURCE_HASH = "2ac54a604fc03c438dbf8f99039e57d068b8b270aadb092bf74a2e5a0538ae24";
const RUN_ID = "task-3.9-historical-gap-recovery-2026-07-21";

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  const { data: locks, error } = await supabase
    .from("audit_baseline_locks")
    .select("order_line_id, stored_cost_at_sale, expected_cost_at_sale, delta_vnd, source_hash")
    .eq("source_hash", SOURCE_HASH);
  if (error) throw new Error(error.message);
  if (!locks || locks.length === 0) {
    console.log("No matching audit_baseline_locks rows found for this source hash.");
    return;
  }

  const { findAllNoCache } = await import("../lib/sheets_db");
  const lines = await findAllNoCache("Order_Lines_V2") as any[];
  const lineById = new Map(lines.map(l => [l.id, l]));

  const changes = locks.map(lock => {
    const line = lineById.get(lock.order_line_id);
    if (!line) throw new Error(`Order line ${lock.order_line_id} not found in Order_Lines_V2`);
    return {
      line_id: lock.order_line_id,
      order_id: line.order_id,
      old_cost_at_sale: lock.stored_cost_at_sale,
      new_cost_at_sale: lock.expected_cost_at_sale,
    };
  });

  const totalDelta = locks.reduce((s, l) => s + Number(l.delta_vnd), 0);
  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Locked lines found: ${locks.length}, total delta: ${totalDelta.toLocaleString()} VND`);

  const { data, error: rpcError } = await supabase.rpc("apply_mac_drift_recovery", {
    p_run_id: RUN_ID,
    p_source_hash: SOURCE_HASH,
    p_changes: changes,
    p_dry_run: !apply,
  });
  if (rpcError) throw new Error(rpcError.message);

  console.log(JSON.stringify(data, null, 2));

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
