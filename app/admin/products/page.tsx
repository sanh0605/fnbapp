import { findAll } from "@/lib/sheets_db";
import { getMacUnitCostWithRecipeFallback, MacSemiProductContext } from "@/lib/mac-cogs";
import ProductForm from "@/components/ProductForm";
import ProductsClient from "./ProductsClient";
import HistoryModal from "@/components/HistoryModal";

export const dynamic = "force-dynamic";

interface PriceHistory {
  variant_id: string;
  created_at: string;
  [key: string]: any;
}

interface RecipeIngredient {
  ingredient_id: string;
  ingredient_type: string;
  [key: string]: any;
}

interface Recipe {
  id: string;
  target_id: string;
  target_type: string;
  ingredients_json?: string;
  created_at: string;
  [key: string]: any;
}

interface BaseIngredient {
  id: string;
  name: string;
  base_unit: string;
  status: string;
}

interface SemiProduct {
  id: string;
  name: string;
  base_unit: string;
  status: string;
}

interface Unit {
  id: string;
  name: string;
}

export default async function ProductsPage() {
  const [categories, products, variants, recipes, baseIngredients, semiProducts, allUnits, allPriceHistory, ledger]: [any[], any[], any[], Recipe[], BaseIngredient[], SemiProduct[], Unit[], PriceHistory[], any[]] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Recipes"),
    findAll("Base_Ingredients"),
    findAll("Semi_Products"),
    findAll("Units"),
    findAll("Product_Price_History"),
    findAll("Stock_Ledger")
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");
  
  const activeBaseIngredientsRaw = baseIngredients.filter(b => b.status !== "DELETED");
  const activeSemiProductsRaw = semiProducts.filter(s => s.status !== "DELETED");
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  const semiProductRecipes = new Map();
  const semiProductYields = new Map();
  for (const s of activeSemiProductsRaw) {
    const r = recipes.find(x => x.target_type === "SEMI_PRODUCT" && x.target_id === s.id);
    if (r && r.ingredients_json) {
      try { semiProductRecipes.set(s.id, JSON.parse(r.ingredients_json)); } catch (e) {}
      semiProductYields.set(s.id, r.yield_quantity ? Number(r.yield_quantity) : 1);
    }
  }
  const semiContext: MacSemiProductContext = { semiProductRecipes, semiProductYields };
  
  const now = new Date().toISOString();
  const activeBaseIngredients = activeBaseIngredientsRaw.map(b => ({
    ...b,
    current_mac: getMacUnitCostWithRecipeFallback(b.id, ledger, now, semiContext)
  }));
  const activeSemiProducts = activeSemiProductsRaw.map(s => ({
    ...s,
    current_mac: getMacUnitCostWithRecipeFallback(s.id, ledger, now, semiContext)
  }));

  // Build the rich data for the form
  const enhancedProducts = activeProducts.map(p => {
    const productVariants = activeVariants.filter(v => v.product_id === p.id);
    const variantsWithRecipes = productVariants.map(v => {
      const recipe = recipes.find(r => r.target_type === "PRODUCT_VARIANT" && r.target_id === v.id);
      let ingredients = [];
      if (recipe && recipe.ingredients_json) {
        try { ingredients = JSON.parse(recipe.ingredients_json); } catch(e){}
      }
      return { ...v, ingredients };
    });
    
    // Thu thập toàn bộ lịch sử giá của các variants thuộc Product này
    const pPriceHistory = allPriceHistory
      .filter((ph: PriceHistory) => productVariants.some(v => v.id === ph.variant_id))
      .sort((a: PriceHistory, b: PriceHistory) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Thu thập toàn bộ lịch sử công thức của các variants thuộc Product này
    const pRecipeHistory = recipes
      .filter((r: Recipe) => r.target_type === "PRODUCT_VARIANT" && productVariants.some(v => v.id === r.target_id))
      .map((r: Recipe) => {
        let ings: RecipeIngredient[] = [];
        if (r.ingredients_json) {
          try { ings = JSON.parse(r.ingredients_json); } catch(e){}
        }
        const enrichedIngs = ings.map((ing: RecipeIngredient) => {
          let ingName = "Unknown";
          let ingUnit = "";
          if (ing.ingredient_type === "BASE_INGREDIENT") {
            const found = baseIngredients.find(b => b.id === ing.ingredient_id);
            if (found) { 
              ingName = found.name; 
              ingUnit = units.find((u: Unit) => u.id === found.base_unit)?.name || found.base_unit; 
            }
          } else {
            const found = activeSemiProducts.find(s => s.id === ing.ingredient_id);
            if (found) { 
              ingName = found.name; 
              ingUnit = units.find((u: Unit) => u.id === found.base_unit)?.name || found.base_unit; 
            }
          }
          return { ...ing, name: ingName, unitName: ingUnit };
        });
        
        const vName = productVariants.find(v => v.id === r.target_id)?.size_name || "";
        return { ...r, ingredients: enrichedIngs, size_name: vName };
      })
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { ...p, variants: variantsWithRecipes, priceHistory: pPriceHistory, recipeHistory: pRecipeHistory };
  });

  return (
    <div className="space-y-6">
      <ProductsClient 
        enhancedProducts={enhancedProducts}
        activeCategories={activeCategories}
        activeBaseIngredients={activeBaseIngredients}
        activeSemiProducts={activeSemiProducts}
        units={units}
        categories={activeCategories} // Passing for the form inside ProductsClient
      />
    </div>
  );
}
