// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { getMacUnitCostWithRecipeFallback, MacLedgerEntry } from "../lib/mac-cogs";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  
  const allLedger: MacLedgerEntry[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from("stock_ledger").select("*").range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allLedger.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  
  const { data: semiProducts } = await supabase.from("semi_products").select("*");
  const { data: recipes } = await supabase.from("recipes").select("*");
  const { data: products } = await supabase.from("products").select("*");
  const { data: variants } = await supabase.from("product_variants").select("*");
  
  const now = new Date().toISOString();
  
  const semiContext = { semiProductRecipes: new Map(), semiProductYields: new Map() };
  for (const s of semiProducts) {
      semiContext.semiProductYields.set(s.id, s.yield_quantity || 1);
      const r = recipes.find(r => r.target_type === "SEMI_PRODUCT" && r.target_id === s.id && !r.end_date);
      if (r) try { semiContext.semiProductRecipes.set(s.id, JSON.parse(r.ingredients_json)); } catch(e){}
  }
  
  const macCache = new Map();
  const getMac = (type, id) => {
    const key = type + ":" + id;
    if (macCache.has(key)) return macCache.get(key);
    const m = getMacUnitCostWithRecipeFallback(id, allLedger, now, semiContext);
    macCache.set(key, m);
    return m;
  };
  
  for (const p of products) {
    const pVariants = variants.filter(v => v.product_id === p.id);
    for (const v of pVariants) {
      const r = recipes.find(rec => rec.target_type === "PRODUCT_VARIANT" && rec.target_id === v.id && !rec.end_date);
      if (!r) continue;
      
      let ings = [];
      try { ings = JSON.parse(r.ingredients_json); } catch(e){}
      
      let cost = 0;
      for (const ing of ings) {
        cost += getMac(ing.ingredient_type, ing.ingredient_id) * (ing.quantity || 0);
      }
      
      console.log(`Product ${p.name} (Variant ${v.size_name}): Cost = ${cost}`);
    }
  }
}

main().catch(console.error);
