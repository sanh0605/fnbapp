/**
 * COGS computation for an order line at sale time.
 * Iterates ingredients from variant recipe + each modifier recipe.
 * Moving Average Cost across all PO_RECEIPT entries up to sale time.
 */

import type { LineRecipeSnapshot, RecipeSnapshot } from "@/lib/order-types";

interface LedgerEntry {
  item_reference: string;
  transaction_type: string;
  unit_cost: string | number;
  quantity_change: string | number;
  created_at: string;
}

/** Compute MAC cost across a single RecipeSnapshot's ingredients. */
function costForRecipe(
  recipe: RecipeSnapshot,
  ledger: LedgerEntry[],
  lineQty: number,
  saleMs: number,
): number {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return 0;
  let total = 0;
  for (const ing of recipe.ingredients) {
    if (ing.quantity <= 0) continue;
    const purchases = ledger.filter(e =>
      e.item_reference === ing.ingredient_id &&
      e.transaction_type === "PO_RECEIPT" &&
      e.created_at &&
      new Date(e.created_at).getTime() <= saleMs,
    );
    if (purchases.length === 0) continue;
    const totalCost = purchases.reduce((s, e) => s + Number(e.unit_cost) * Number(e.quantity_change), 0);
    const totalQty = purchases.reduce((s, e) => s + Number(e.quantity_change), 0);
    if (totalQty <= 0) continue;
    const mac = totalCost / totalQty;
    total += mac * ing.quantity * lineQty;
  }
  return total;
}

export function computeLineCostAtSale(
  lineRecipe: LineRecipeSnapshot | RecipeSnapshot,
  ledger: LedgerEntry[],
  lineQty: number,
  saleTime: string = new Date().toISOString(),
): number {
  const saleMs = new Date(saleTime).getTime();

  // Backward compat: if caller passes raw RecipeSnapshot (old shape), treat as variant-only
  if ("target_type" in lineRecipe && !("variant" in lineRecipe)) {
    return Math.round(costForRecipe(lineRecipe as RecipeSnapshot, ledger, lineQty, saleMs));
  }

  const snap = lineRecipe as LineRecipeSnapshot;
  let total = costForRecipe(snap.variant, ledger, lineQty, saleMs);
  for (const modEntry of snap.modifiers) {
    total += costForRecipe(modEntry.recipe, ledger, lineQty, saleMs);
  }
  return Math.round(total);
}
