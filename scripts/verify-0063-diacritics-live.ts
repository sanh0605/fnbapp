import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-off, read-only-by-construction check that migration 0063 actually
 * landed: the reason-required guard fires before the session lookup (see
 * reverse_stocktake_session_atomic's check order), so passing any non-empty
 * session id with a blank reason raises the Vietnamese message without
 * touching stocktake_sessions at all -- safe even though the table is
 * currently empty after cleanup.
 */
async function main(): Promise<void> {
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc("reverse_stocktake_session_atomic", {
    p_session_id: "STK-ANY",
    p_reason: "   ",
    p_reversed_by_id: "test",
    p_reversed_by_name: "Test",
  });
  console.log(`reverse_stocktake_session_atomic, blank reason -> ${error ? error.message : "DID NOT RAISE (BUG)"}`);

  const { error: slipErr } = await supabase.rpc("cancel_issue_slip_atomic", {
    p_slip_id: "ISL-ANY",
    p_reason: "   ",
    p_created_by_id: "test",
    p_created_by_name: "Test",
  });
  console.log(`cancel_issue_slip_atomic, blank reason -> ${slipErr ? slipErr.message : "DID NOT RAISE (BUG)"}`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
