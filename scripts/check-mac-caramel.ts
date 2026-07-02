// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { getMacUnitCostWithRecipeFallback, MacSemiProductContext } from "../lib/mac-cogs";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  
  // Get recipes
  const { data: recipes } = await supabase.from("recipes").select("*");
  // Get base ingredients
  const { data: baseIngredients } = await supabase.from("base_ingredients").select("*");
  // Get semi products
  const { data: semiProducts } = await supabase.from("semi_products").select("*");
  // Get ledger
  const { data: ledger } = await supabase.from("stock_ledger").select("*");
  
  // Find Caramel sauce
  const caramelBase = baseIngredients?.find(b => b.name.toLowerCase().includes("caramel"));
  const caramelSemi = semiProducts?.find(s => s.name.toLowerCase().includes("caramel"));
  
  console.log("Found caramel base:", caramelBase?.id, caramelBase?.name);
  console.log("Found caramel semi:", caramelSemi?.id, caramelSemi?.name);
  
  const caramel = caramelBase || caramelSemi;
  if (!caramel) {
    console.log("Caramel not found!");
    return;
  }

  const semiProductRecipes = new Map();
  const semiProductYields = new Map();
  for (const s of semiProducts || []) {
    const r = recipes?.find((x: any) => x.target_type === "SEMI_PRODUCT" && x.target_id === s.id);
    if (r && r.ingredients_json) {
      try { semiProductRecipes.set(s.id, JSON.parse(r.ingredients_json)); } catch (e) {}
      semiProductYields.set(s.id, r.yield_quantity ? Number(r.yield_quantity) : 1);
    }
  }
  const semiContext: MacSemiProductContext = { semiProductRecipes, semiProductYields };

  const now = new Date().toISOString();
  const mac = getMacUnitCostWithRecipeFallback(caramel.id, ledger || [], now, semiContext);
  console.log("Calculated MAC for", caramel.name, "is", mac);

  // Look at ledger rows for this item
  const rows = (ledger || []).filter(r => r.item_reference === caramel.id);
  console.log("Ledger rows for", caramel.id, rows.map(r => ({
    type: r.transaction_type,
    qty: r.quantity_change,
    unit_cost: r.unit_cost
  })));
}

main().catch(console.error);
