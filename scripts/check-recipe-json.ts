// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: recipes } = await supabase.from("recipes").select("*").in("id", ["REC-078", "REC-079"]);
  console.log("Recipes json:", JSON.stringify(recipes, null, 2));
}

main().catch(console.error);
