// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: ledger } = await supabase.from("stock_ledger").select("*").eq("unit_cost", 99);
  console.log("Rows with unit_cost 99:", ledger);
}

main().catch(console.error);
