import type { ConsumptionRow } from "@/lib/inventory-consumption";
import type { RecipeIngredientSnapshot } from "@/lib/order-types";

export type MacLedgerEntry = {
  id?: string;
  reference_id?: string;
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  created_at?: string;
};

export type MacSemiProductContext = {
  semiProductRecipes: Map<string, RecipeIngredientSnapshot[]>;
  semiProductYields: Map<string, number>;
};

const COST_INPUT_TYPES = new Set(["PO_RECEIPT", "STOCK_ADJUST", "PRODUCTION_YIELD"]);

export function getMacUnitCost(
  ledger: MacLedgerEntry[],
  itemReference: string,
  asOf: string,
): number {
  const asOfMs = new Date(asOf).getTime();
  let totalQty = 0;
  let totalValue = 0;
  let latestKnownMac = 0;

  const rows = [...ledger]
    .filter(row => row.item_reference === itemReference)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  for (const row of rows) {
    const createdAt = new Date(row.created_at || 0).getTime();
    if (Number.isFinite(asOfMs) && createdAt > asOfMs) continue;

    const qty = Number(row.quantity_change || 0);
    const unitCost = Number(row.unit_cost || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) continue;

    if (COST_INPUT_TYPES.has(row.transaction_type || "") && qty > 0 && unitCost > 0) {
      totalQty += qty;
      totalValue += qty * unitCost;
      latestKnownMac = totalQty > 0 ? totalValue / totalQty : latestKnownMac;
      continue;
    }

    if (qty < 0 && totalQty > 0) {
      const consumeQty = Math.min(totalQty, Math.abs(qty));
      totalQty -= consumeQty;
      totalValue -= consumeQty * latestKnownMac;
    }
  }

  return latestKnownMac;
}

export function computeMacCostForConsumptionRows(
  rows: ConsumptionRow[],
  ledger: MacLedgerEntry[],
  saleTime: string,
  semiProductContext?: MacSemiProductContext,
): number {
  const total = rows.reduce((sum, row) => {
    const unitCost = getMacUnitCostWithRecipeFallback(row.item_reference, ledger, saleTime, semiProductContext);
    return sum + unitCost * row.quantity;
  }, 0);
  return Math.round(total);
}

export function computeMacCostFromUnitCosts(
  rows: ConsumptionRow[],
  unitCosts: Map<string, number>,
  semiProductContext?: MacSemiProductContext,
): number {
  const total = rows.reduce((sum, row) => {
    const unitCost = getMacUnitCostFromMap(
      row.item_reference,
      unitCosts,
      semiProductContext,
      new Set(),
    );
    return sum + unitCost * row.quantity;
  }, 0);
  return Math.round(total);
}

export function getMacUnitCostWithRecipeFallback(
  itemReference: string,
  ledger: MacLedgerEntry[],
  saleTime: string,
  semiProductContext?: MacSemiProductContext,
): number {
  const directMac = getMacUnitCost(ledger, itemReference, saleTime);
  if (directMac > 0) return directMac;
  if (!semiProductContext || !itemReference.startsWith("BTP-")) return 0;
  return computeSemiProductUnitCost(itemReference, ledger, saleTime, semiProductContext);
}

function computeSemiProductUnitCost(
  semiProductId: string,
  ledger: MacLedgerEntry[],
  saleTime: string,
  semiProductContext: MacSemiProductContext,
): number {
  const recipe = semiProductContext.semiProductRecipes.get(semiProductId) || [];
  const yieldQty = semiProductContext.semiProductYields.get(semiProductId) || 1;
  if (recipe.length === 0 || yieldQty <= 0) return 0;

  return recipe.reduce((sum, ingredient) => {
    const quantity = Number(ingredient.quantity || 0);
    if (!ingredient.ingredient_id || quantity <= 0) return sum;
    const unitCost = getMacUnitCostWithRecipeFallback(ingredient.ingredient_id, ledger, saleTime, semiProductContext);
    return sum + (quantity / yieldQty) * unitCost;
  }, 0);
}

function getMacUnitCostFromMap(
  itemReference: string,
  unitCosts: Map<string, number>,
  semiProductContext: MacSemiProductContext | undefined,
  visited: Set<string>,
): number {
  const directMac = unitCosts.get(itemReference) || 0;
  if (directMac > 0) return directMac;
  if (
    !semiProductContext ||
    !itemReference.startsWith("BTP-") ||
    visited.has(itemReference)
  ) {
    return 0;
  }

  const recipe = semiProductContext.semiProductRecipes.get(itemReference) || [];
  const yieldQty = semiProductContext.semiProductYields.get(itemReference) || 1;
  if (recipe.length === 0 || yieldQty <= 0) return 0;

  const nextVisited = new Set(visited).add(itemReference);
  return recipe.reduce((sum, ingredient) => {
    const quantity = Number(ingredient.quantity || 0);
    if (!ingredient.ingredient_id || quantity <= 0) return sum;
    const unitCost = getMacUnitCostFromMap(
      ingredient.ingredient_id,
      unitCosts,
      semiProductContext,
      nextVisited,
    );
    return sum + (quantity / yieldQty) * unitCost;
  }, 0);
}
