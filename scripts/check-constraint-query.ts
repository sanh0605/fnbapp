// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("exec_sql", { query: "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'promotions_discount_type_check';" });
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("Constraint def:", data);
  }
}

main().catch(console.error);
