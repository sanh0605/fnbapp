// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("promotions").select("id, name, discount_type");
  console.log("Promotions:", data);
}

main().catch(console.error);
