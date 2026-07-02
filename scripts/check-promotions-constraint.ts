// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_table_constraints", { table_name: "promotions" });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("Constraints:", data);
  }
}

main().catch(console.error);
