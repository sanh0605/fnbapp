import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-off fix for the last residual finding after the 2026-07-24 full-history
 * rebuild (see DEVELOPMENT-TRACKING.md). 5 Stock_Ledger rows tagged
 * reference_id="PHASE9-NEGATIVE-STOCK-2026-06-26" (dated 2026-06-27, predating
 * all 3 correction rounds this session dealt with) added stock for 5 BTP
 * items as PRODUCTION_YIELD -- but they are not tied to any real order or
 * production event, so lib/full-history-recompute.ts's engine (correctly,
 * per its 2026-07-24 fix) never trusts or re-derives them, leaving a small
 * "recorded but not theoretical" gap for exactly these 5 items. The sibling
 * entry from the same original correction effort, reference_id
 * "NEGATIVE-STOCK-AUDIT-2026-06-25...", used STOCK_ADJUST for the same kind
 * of correction and is trusted with no issue -- these 5 rows were simply
 * filed under the wrong transaction_type. Reclassifies transaction_type
 * PRODUCTION_YIELD -> STOCK_ADJUST for exactly these 5 rows (quantity/item
 * untouched) so the engine trusts them as the physical-count-style
 * correction they actually represent. Logged to data_recovery_changes for
 * an audit trail, guarded by verifying the current value before writing.
 */

const ROW_IDS = [
  "STK-PHASE9-6cac7dc7-001",
  "STK-PHASE9-6cac7dc7-002",
  "STK-PHASE9-6cac7dc7-003",
  "STK-PHASE9-6cac7dc7-004",
  "STK-PHASE9-6cac7dc7-005",
];

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  const { data: rows, error } = await supabase
    .from("stock_ledger")
    .select("id, item_reference, transaction_type, quantity_change, reference_id")
    .in("id", ROW_IDS);
  if (error) throw new Error(error.message);
  if (!rows || rows.length !== ROW_IDS.length) {
    throw new Error(`Expected ${ROW_IDS.length} rows, found ${rows?.length ?? 0}`);
  }
  for (const r of rows) {
    if (r.reference_id !== "PHASE9-NEGATIVE-STOCK-2026-06-26" || r.transaction_type !== "PRODUCTION_YIELD") {
      throw new Error(`Row ${r.id} does not match expected state: ${JSON.stringify(r)}`);
    }
  }

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Rows to reclassify PRODUCTION_YIELD -> STOCK_ADJUST:`);
  for (const r of rows) console.log(`  ${r.id} (${r.item_reference}, qty=${r.quantity_change})`);

  if (!apply) {
    console.log("\nDry run only -- re-run with --apply to write.");
    return;
  }

  for (const r of rows) {
    const { error: logError } = await supabase.from("data_recovery_changes").insert({
      run_id: "phase9-type-reclassify-2026-07-24",
      table_name: "stock_ledger",
      row_id: r.id,
      column_name: "transaction_type",
      old_value: JSON.stringify(r.transaction_type),
      new_value: JSON.stringify("STOCK_ADJUST"),
      source_hash: "0".repeat(64),
    });
    if (logError) throw new Error(`Log failed for ${r.id}: ${logError.message}`);

    const { error: updateError } = await supabase
      .from("stock_ledger")
      .update({ transaction_type: "STOCK_ADJUST" })
      .eq("id", r.id)
      .eq("transaction_type", "PRODUCTION_YIELD");
    if (updateError) throw new Error(`Update failed for ${r.id}: ${updateError.message}`);
  }

  console.log(`\nReclassified ${rows.length} rows.`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
