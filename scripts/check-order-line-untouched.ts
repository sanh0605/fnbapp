import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only sanity check: confirms the failed apply_backdated_event_recovery
 * call (digest() unresolvable) left order_lines_v2 completely untouched --
 * the digest() call happens before any row lock/update in the function body,
 * so a Postgres exception there should roll back the whole transaction with
 * zero side effects.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const lines = await findAllNoCache("Order_Lines_V2") as any[];

  const checkIds = [
    "ol-2b7b1244-c9a8-4045-a63d-d98b97ca6d6f",
    "ol-86734b4a-9925-422e-ad90-501d2c651fea",
    "ol-a588b03d-91a9-4489-9428-4868ebe6d332",
  ];
  for (const id of checkIds) {
    const line = lines.find(l => l.id === id);
    console.log(`${id}: cost_at_sale=${line?.cost_at_sale}`);
  }

  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("data_recovery_changes")
    .select("*", { count: "exact", head: true })
    .eq("run_id", "backdated-b3b98840-76e7-400d-b2aa-eaf047418998");
  if (error) throw new Error(error.message);
  console.log(`data_recovery_changes rows for the failed run: ${count}`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
