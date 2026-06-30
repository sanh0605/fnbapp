import { findAll } from "@/lib/sheets_db";
import { getMacUnitCostWithRecipeFallback, MacSemiProductContext } from "@/lib/mac-cogs";
import CogsCalculator from "./CogsCalculator";

export const dynamic = "force-dynamic";

export default async function CogsEstimatePage() {
  const [recipes, baseIngredients, semiProducts, allUnits, ledger]: [any[], any[], any[], any[], any[]] = await Promise.all([
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
      semiProductYields.set(s.id, s.batch_yield ? Number(s.batch_yield) : 1);
    }
  }
  const semiContext: MacSemiProductContext = { semiProductRecipes, semiProductYields };
  
  const now = new Date().toISOString();

  // Prepare ingredients list with MAC
  const ingredientsOptions: any[] = [];
  
  for (const b of activeBaseIngredients) {
    const unitName = units.find(u => u.id === b.base_unit)?.name || b.base_unit;
    ingredientsOptions.push({
      id: b.id,
      name: b.name,
      unit: unitName,
      type: "BASE_INGREDIENT",
      current_mac: getMacUnitCostWithRecipeFallback(b.id, ledger, now, semiContext)
    });
  }

  for (const s of activeSemiProducts) {
    const unitName = units.find(u => u.id === s.base_unit)?.name || s.base_unit;
    ingredientsOptions.push({
      id: s.id,
      name: s.name,
      unit: unitName,
      type: "SEMI_PRODUCT",
      current_mac: getMacUnitCostWithRecipeFallback(s.id, ledger, now, semiContext)
    });
  }

  return (
    <div className="space-y-6">
      <CogsCalculator ingredients={ingredientsOptions} />
    </div>
  );
}
