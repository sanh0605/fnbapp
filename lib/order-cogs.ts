/**
 * COGS computation for an order line at sale time.
 *
 * Uses Moving Average Cost across all PO_RECEIPT ledger entries up to
 * (and including) the sale timestamp. Non-PO_RECEIPT entries are ignored
 * to keep MAC stable when sales don't change purchase prices.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 6.4)
 */

import type { RecipeSnapshot } from "@/lib/order-types";

interface LedgerEntry {
  item_reference: string;
  transaction_type: string;
  unit_cost: string | number;
  quantity_change: string | number;
  created_at: string;
}

export function computeLineCostAtSale(
  recipe: RecipeSnapshot,
  ledger: LedgerEntry[],
  lineQty: number,
  saleTime: string = new Date().toISOString(),
): number {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return 0;
  const saleMs = new Date(saleTime).getTime();

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
    const consumeQty = ing.quantity * lineQty;
    total += mac * consumeQty;
  }

  return Math.round(total);
}
