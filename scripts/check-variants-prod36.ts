// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: variants } = await supabase.from("product_variants").select("*").eq("product_id", "PROD-036");
  console.log("Variants:", variants);
}

main().catch(console.error);
