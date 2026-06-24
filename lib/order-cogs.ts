/**
 * COGS computation for an order line at sale time.
 * Iterates ingredients from variant recipe + each modifier recipe.
 * Moving Average Cost across all PO_RECEIPT entries up to sale time.
 *
 * WS-10 fix: resolves SEMI_PRODUCT ingredients via their sub-recipes
 * (which contain BASE_INGREDIENTs with PO_RECEIPT data). Without this,
 * toppings using semi-products (BTP-*) reported 0 COGS.
 */

import type { LineRecipeSnapshot, RecipeSnapshot } from "@/lib/order-types";

interface LedgerEntry {
  item_reference: string;
  transaction_type: string;
  unit_cost: string | number;
  quantity_change: string | number;
  created_at: string;
}

export interface SemiProductContext {
  /** All SEMI_PRODUCT recipes from Recipes sheet. */
  recipes: Array<{ target_id: string; ingredients_json: string }>;
  /** Map of semi_product_id → batch_yield (units produced per batch). */
  yields: Map<string, number>;
}

/** Compute MAC for a single ingredient at sale time. Returns 0 if no PO_RECEIPT data. */
function macForIngredient(ingredientId: string, ledger: LedgerEntry[], saleMs: number): number {
  const purchases = ledger.filter(e =>
    e.item_reference === ingredientId &&
    e.transaction_type === "PO_RECEIPT" &&
    e.created_at &&
    new Date(e.created_at).getTime() <= saleMs,
  );
  if (purchases.length === 0) return 0;
  const totalCost = purchases.reduce((s, e) => s + Number(e.unit_cost) * Number(e.quantity_change), 0);
  const totalQty = purchases.reduce((s, e) => s + Number(e.quantity_change), 0);
  return totalQty > 0 ? totalCost / totalQty : 0;
}

/** Compute MAC cost across a single RecipeSnapshot's ingredients. */
function costForRecipe(
  recipe: RecipeSnapshot,
  ledger: LedgerEntry[],
  lineQty: number,
  saleMs: number,
  spContext?: SemiProductContext,
): number {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return 0;
  let total = 0;
  for (const ing of recipe.ingredients) {
    if (ing.quantity <= 0) continue;

    if (ing.ingredient_type === "SEMI_PRODUCT" && spContext) {
      // WS-10: resolve SEMI_PRODUCT to its base ingredients via sub-recipe
      const spRecipe = spContext.recipes.find(r => r.target_id === ing.ingredient_id);
      if (!spRecipe || !spRecipe.ingredients_json) continue;
      let spIngs: any[] = [];
      try {
        const parsed = JSON.parse(spRecipe.ingredients_json);
        if (Array.isArray(parsed)) spIngs = parsed;
      } catch { continue; }

      const yieldQty = spContext.yields.get(ing.ingredient_id) || 1;
      if (yieldQty <= 0) continue;

      for (const spIng of spIngs) {
        const mac = macForIngredient(spIng.ingredient_id, ledger, saleMs);
        if (mac <= 0) continue;
        // Per unit of SP: spIng.quantity / yieldQty
        // Total SP used in this line: ing.quantity × lineQty
        // So total base ingredient = (spIng.quantity / yieldQty) × ing.quantity × lineQty
        const baseQtyUsed = (Number(spIng.quantity || 0) / yieldQty) * ing.quantity * lineQty;
        total += mac * baseQtyUsed;
      }
    } else if (ing.ingredient_type === "BASE_INGREDIENT") {
      const mac = macForIngredient(ing.ingredient_id, ledger, saleMs);
      if (mac <= 0) continue;
      total += mac * ing.quantity * lineQty;
    }
    // Unknown type: skip
  }
  return total;
}

export function computeLineCostAtSale(
  lineRecipe: LineRecipeSnapshot | RecipeSnapshot,
  ledger: LedgerEntry[],
  lineQty: number,
  saleTime: string = new Date().toISOString(),
  spContext?: SemiProductContext,
): number {
  const saleMs = new Date(saleTime).getTime();

  // Backward compat: if caller passes raw RecipeSnapshot (old shape), treat as variant-only
  if ("target_type" in lineRecipe && !("variant" in lineRecipe)) {
    return Math.round(costForRecipe(lineRecipe as RecipeSnapshot, ledger, lineQty, saleMs, spContext));
  }

  const snap = lineRecipe as LineRecipeSnapshot;
  let total = costForRecipe(snap.variant, ledger, lineQty, saleMs, spContext);
  for (const modEntry of snap.modifiers) {
    const modifierQty = Number(modEntry.modifier_qty || 1);
    total += costForRecipe(modEntry.recipe, ledger, lineQty * modifierQty, saleMs, spContext);
  }
  return Math.round(total);
}
