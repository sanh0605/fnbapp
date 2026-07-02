// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: priceHistorySchema } = await supabase.from("product_price_history").select("*").limit(1);
  console.log("Price history:", priceHistorySchema);
  const { data: recipesSchema } = await supabase.from("recipes").select("*").limit(1);
  console.log("Recipes:", recipesSchema);
}

main().catch(console.error);
