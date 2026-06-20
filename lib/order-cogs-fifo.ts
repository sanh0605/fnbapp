/**
 * FIFO-based COGS computation for an order line.
 *
 * Mirrors lib/order-cogs.ts (MAC version) but uses FIFOTracker.consume
 * instead of mac × qty.
 *
 * Spec: WS-11 (User directive 2026-06-20: switch from MAC to FIFO).
 */

import type { LineRecipeSnapshot, RecipeSnapshot } from "@/lib/order-types";
import type { SemiProductContext } from "@/lib/order-cogs";
import type { FIFOTracker } from "@/lib/fifo-tracker";

function costForRecipeFIFO(
  recipe: RecipeSnapshot,
  tracker: FIFOTracker,
  lineQty: number,
  spContext?: SemiProductContext,
): number {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return 0;
  let total = 0;
  for (const ing of recipe.ingredients) {
    if (ing.quantity <= 0) continue;

    if (ing.ingredient_type === "SEMI_PRODUCT" && spContext) {
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
        const baseQtyNeeded = (Number(spIng.quantity || 0) / yieldQty) * ing.quantity * lineQty;
        total += tracker.consume(spIng.ingredient_id, baseQtyNeeded);
      }
    } else if (ing.ingredient_type === "BASE_INGREDIENT") {
      const qtyNeeded = ing.quantity * lineQty;
      total += tracker.consume(ing.ingredient_id, qtyNeeded);
    }
  }
  return total;
}

export function computeLineCostFIFO(
  lineRecipe: LineRecipeSnapshot | RecipeSnapshot,
  tracker: FIFOTracker,
  lineQty: number,
  spContext?: SemiProductContext,
): number {
  // Backward compat: raw RecipeSnapshot (no "variant" key)
  if ("target_type" in lineRecipe && !("variant" in lineRecipe)) {
    return Math.round(costForRecipeFIFO(lineRecipe as RecipeSnapshot, tracker, lineQty, spContext));
  }

  const snap = lineRecipe as LineRecipeSnapshot;
  let total = costForRecipeFIFO(snap.variant, tracker, lineQty, spContext);
  for (const modEntry of snap.modifiers) {
    total += costForRecipeFIFO(modEntry.recipe, tracker, lineQty, spContext);
  }
  return Math.round(total);
}
