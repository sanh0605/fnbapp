// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: ledger } = await supabase.from("stock_ledger").select("*").gt("unit_cost", 100000);
  console.log("High unit_cost ledger:", ledger);
}

main().catch(console.error);
