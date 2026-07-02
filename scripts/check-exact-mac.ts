// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { getSupabaseClient } from "../lib/supabase";
import { getMacUnitCostWithRecipeFallback, MacLedgerEntry } from "../lib/mac-cogs";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const supabase = getSupabaseClient();
  
  // FETCH ALL LEDGER
  const allLedger: MacLedgerEntry[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data } = await supabase
      .from("stock_ledger")
      .select("*")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    allLedger.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  
  const { data: semiProducts } = await supabase.from("semi_products").select("*");
  const { data: recipes } = await supabase.from("recipes").select("*");
  
  const now = new Date().toISOString();
  
  const semiProductRecipes = new Map();
  const semiProductYields = new Map();
  
  for (const s of semiProducts) {
      semiProductYields.set(s.id, s.yield_quantity || 1);
      const recipe = recipes.find(r => r.target_type === "SEMI_PRODUCT" && r.target_id === s.id && r.status === "ACTIVE");
      if (recipe) {
          try {
              semiProductRecipes.set(s.id, JSON.parse(recipe.ingredients_json));
          } catch(e) {}
      }
  }
  
  const ctx = { semiProductRecipes, semiProductYields };
  
  const mac1 = getMacUnitCostWithRecipeFallback("BTP-001", allLedger, now, ctx);
  console.log("BTP-001 (Cốt cà phê) MAC:", mac1);
  
  const mac2 = getMacUnitCostWithRecipeFallback("BTP-011", allLedger, now, ctx);
  console.log("BTP-011 (Kem muối phô mai) MAC:", mac2);
  
  const ing3 = getMacUnitCostWithRecipeFallback("ING-003", allLedger, now, ctx);
  console.log("ING-003 (Sữa đặc) MAC:", ing3);
  
  const ing12 = getMacUnitCostWithRecipeFallback("ING-012", allLedger, now, ctx);
  console.log("ING-012 (Xốt caramel) MAC:", ing12);
  
  const totalCost = (mac1 * 50) + (ing3 * 30) + (mac2 * 40) + (ing12 * 20);
  console.log("Total variant cost:", totalCost);
}

main().catch(console.error);
