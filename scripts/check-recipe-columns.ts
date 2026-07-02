// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: recipes } = await supabase.from("recipes").select("*").limit(1);
  console.log("Recipes columns:", Object.keys(recipes[0]));
}

main().catch(console.error);
