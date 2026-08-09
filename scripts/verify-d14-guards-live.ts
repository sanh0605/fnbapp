import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * D14 live verification, guard paths only. Every call here is expected to
 * raise BEFORE the function's first INSERT (Postgres aborts an RPC call's
 * own implicit transaction on an unhandled exception), so nothing is ever
 * written -- no BEGIN...ROLLBACK wrapper needed for these. The
 * success/write path (a real reversal actually writing compensating rows)
 * is deliberately NOT exercised here: this repo has no Docker/pg driver in
 * this environment to run a client-controlled rolled-back transaction
 * against it, and constructing one by actually opening+confirming+reversing
 * a real session would create real committed data at exactly the moment a
 * parallel task (scripts/cleanup-stocktake-test.ts) is waiting on the owner
 * to run his own real first test count untouched.
 *
 * Real ids used below (STK-001, a real CANCELLED session) come from
 * production as it stands today -- read-only, no assumptions.
 */
async function main(): Promise<void> {
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  console.log("--- reverse_stocktake_session_atomic guards ---");

  const { error: unknownErr } = await supabase.rpc("reverse_stocktake_session_atomic", {
    p_session_id: "STK-DOES-NOT-EXIST",
    p_reason: "test",
    p_reversed_by_id: "test",
    p_reversed_by_name: "Test",
  });
  console.log(`unknown session -> ${unknownErr ? "raised: " + unknownErr.message : "DID NOT RAISE (BUG)"}`);

  const { data: cancelledSessions } = await supabase
    .from("stocktake_sessions")
    .select("id, status")
    .eq("status", "CANCELLED")
    .limit(1);
  const cancelledId = cancelledSessions?.[0]?.id;
  if (cancelledId) {
    const { error: notConfirmedErr } = await supabase.rpc("reverse_stocktake_session_atomic", {
      p_session_id: cancelledId,
      p_reason: "test",
      p_reversed_by_id: "test",
      p_reversed_by_name: "Test",
    });
    console.log(
      `real CANCELLED session ${cancelledId} (U3) -> ${notConfirmedErr ? "raised: " + notConfirmedErr.message : "DID NOT RAISE (BUG)"}`,
    );
  } else {
    console.log("no real CANCELLED session found to test U3 against -- skipped");
  }

  const { data: confirmedSessions } = await supabase
    .from("stocktake_sessions")
    .select("id")
    .eq("status", "CONFIRMED")
    .limit(1);
  const confirmedId = confirmedSessions?.[0]?.id;
  if (confirmedId) {
    const { error: emptyReasonErr } = await supabase.rpc("reverse_stocktake_session_atomic", {
      p_session_id: confirmedId,
      p_reason: "   ",
      p_reversed_by_id: "test",
      p_reversed_by_name: "Test",
    });
    console.log(`real CONFIRMED session ${confirmedId}, blank reason (U5) -> ${emptyReasonErr ? "raised: " + emptyReasonErr.message : "DID NOT RAISE (BUG)"}`);
  } else {
    console.log("no real CONFIRMED session exists today -- U2/U4/U5/success path all untested live (expected: none exist yet)");
  }

  console.log("\n--- cancel_issue_slip_atomic guards ---");

  const { error: unknownSlipErr } = await supabase.rpc("cancel_issue_slip_atomic", {
    p_slip_id: "ISL-DOES-NOT-EXIST",
    p_reason: "test",
    p_created_by_id: "test",
    p_created_by_name: "Test",
  });
  console.log(`unknown slip -> ${unknownSlipErr ? "raised: " + unknownSlipErr.message : "DID NOT RAISE (BUG)"}`);

  const { count: slipCount } = await supabase.from("issue_slips").select("id", { count: "exact", head: true });
  console.log(`\nissue_slips total rows today: ${slipCount} (0 means the success/U9-U11 path also has nothing real to test against yet)`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
