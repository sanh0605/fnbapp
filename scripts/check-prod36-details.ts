// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  const { data: variants } = await supabase.from("product_variants").select("*").eq("product_id", "PROD-036");
  console.log("Variants:", variants);
  if (variants && variants.length > 0) {
    const vId = variants[0].id;
    const { data: recipes } = await supabase.from("recipes").select("*").eq("target_id", vId);
    console.log("Recipes:", recipes);
    const { data: priceHistory } = await supabase.from("product_price_history").select("*").eq("variant_id", vId);
    console.log("Price history:", priceHistory);
  }
}

main().catch(console.error);
