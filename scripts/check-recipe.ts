// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: recipes } = await supabase.from("recipes").select("*").eq("target_id", "ING-012");
  console.log("Recipes for ING-012:", recipes);
}

main().catch(console.error);
