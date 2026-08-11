// HISTORICAL (Plan E E3, 2026-08-11) -- see lib/historical/README.md.
// Bounded the ledger lookup for order-edit's sale-time cost recompute,
// until Plan C Task 3 removed checkout's sale-time cost computation
// entirely (docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md). Not
// imported anywhere live.
import type { SemiProductConsumptionMaps } from "../inventory-consumption";
import {
  parseLineRecipeSnapshot,
  type RecipeIngredientSnapshot,
} from "../order-types";

type OrderLineRecipe = {
  recipe_snapshot_json?: string;
};

export function collectOrderConsumptionItemReferences(
  lines: OrderLineRecipe[],
  consumptionMaps: SemiProductConsumptionMaps,
): string[] {
  const references = new Set<string>();
  const expandedSemiProducts = new Set<string>();

  const collectIngredient = (ingredient: RecipeIngredientSnapshot): void => {
    const itemReference = ingredient.ingredient_id;
    if (!itemReference) return;
    references.add(itemReference);

    const canUseSemiProductFallback = ingredient.ingredient_type === "SEMI_PRODUCT"
      || itemReference.startsWith("BTP-");
    if (!canUseSemiProductFallback || expandedSemiProducts.has(itemReference)) {
      return;
    }

    expandedSemiProducts.add(itemReference);
    const recipe = consumptionMaps.semiProductRecipes.get(itemReference) || [];
    for (const nestedIngredient of recipe) {
      collectIngredient(nestedIngredient);
    }
  };

  for (const line of lines) {
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "");
    for (const ingredient of recipe.variant.ingredients) {
      collectIngredient(ingredient);
    }
    for (const modifier of recipe.modifiers) {
      for (const ingredient of modifier.recipe.ingredients) {
        collectIngredient(ingredient);
      }
    }
  }

  return [...references].sort();
}
