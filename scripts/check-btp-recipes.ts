// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: recipes } = await supabase.from("recipes").select("*").eq("target_type", "SEMI_PRODUCT").eq("status", "ACTIVE").is("end_date", null);
  console.log(JSON.stringify(recipes, null, 2));
}

main().catch(console.error);
