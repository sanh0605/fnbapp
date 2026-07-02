// @ts-nocheck — debug one-off script, not maintained for TS strictness.
import { findAll } from "../lib/sheets_db";
import { getMacUnitCostWithRecipeFallback, MacSemiProductContext } from "../lib/mac-cogs";

async function main() {
  const [recipes, baseIngredients, semiProducts, allUnits, ledger] = await Promise.all([
    findAll("Recipes"),
    findAll("Base_Ingredients"),
    findAll("Semi_Products"),
    findAll("Units"),
    findAll("Stock_Ledger")
  ]);

  const activeBaseIngredients = baseIngredients.filter(b => b.status !== "DELETED");
  const activeSemiProducts = semiProducts.filter(s => s.status !== "DELETED");
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  const semiProductRecipes = new Map();
  const semiProductYields = new Map();
  for (const s of activeSemiProducts) {
    const r = recipes.find((x: any) => x.target_type === "SEMI_PRODUCT" && x.target_id === s.id);
    if (r && r.ingredients_json) {
      try { semiProductRecipes.set(s.id, JSON.parse(r.ingredients_json)); } catch (e) {}
      semiProductYields.set(s.id, r.yield_quantity ? Number(r.yield_quantity) : 1);
    }
  }
  const semiContext: MacSemiProductContext = { semiProductRecipes, semiProductYields };
  
  const now = new Date().toISOString();

  const caramel = activeBaseIngredients.find(b => b.name.includes("caramel"));
  if (caramel) {
    const mac = getMacUnitCostWithRecipeFallback(caramel.id, ledger, now, semiContext);
    console.log("Xốt caramel MAC in page.tsx:", mac);
  }
}

main().catch(console.error);
