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

export type MacLedgerIndex = {
  rowsByItem: ReadonlyMap<string, readonly MacLedgerEntry[]>;
};

export type MacLedgerSource = MacLedgerEntry[] | MacLedgerIndex;

const COST_INPUT_TYPES = new Set(["PO_RECEIPT", "STOCK_ADJUST", "PRODUCTION_YIELD"]);

export function createMacLedgerIndex(ledger: MacLedgerEntry[]): MacLedgerIndex {
  const rowsByItem = new Map<string, MacLedgerEntry[]>();

  for (const row of ledger) {
    const itemReference = row.item_reference || "";
    const rows = rowsByItem.get(itemReference);
    if (rows) {
      rows.push(row);
    } else {
      rowsByItem.set(itemReference, [row]);
    }
  }

  for (const rows of rowsByItem.values()) {
    rows.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  }

  return { rowsByItem };
}

// Owner correction 2026-07-30: every transaction_type x sign combination
// actually present in production Stock_Ledger is exactly 7 (live sweep,
// 2026-07-30). Each gets its own explicit branch below so none can silently
// fall through again -- the bug this replaces (EDIT_REVERSAL/positive
// matching neither the cost-input branch nor the negative-qty consumption
// branch, so it was silently ignored) was found precisely because the old
// code had no branch to fall into by name, only by shape.
//
// EDIT_REVERSAL rows never carry their own unit_cost (always 0 in
// production) -- undoing a consumption or addition must restore/remove the
// EXACT (qty, value) that the original row moved, tracked per reference_id,
// not today's latestKnownMac (which may have drifted since) and not a
// unit_cost that does not exist on the row. Aggregated per reference_id
// because that is the only correlation key the schema offers; a reference_id
// with a mix of cost-bearing and zero-cost additions/consumptions for the
// same item is not distinguished further, but the aggregate (qty, value)
// removed/restored is still exact.
export function getMacUnitCost(
  ledger: MacLedgerSource,
  itemReference: string,
  asOf: string,
): number {
  const asOfMs = new Date(asOf).getTime();
  let totalQty = 0;
  let totalValue = 0;
  let latestKnownMac = 0;

  const rows = Array.isArray(ledger)
    ? [...ledger]
      .filter(row => row.item_reference === itemReference)
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    : ledger.rowsByItem.get(itemReference) || [];

  const addedByReference = new Map<string, { qty: number; value: number }>();
  const consumedByReference = new Map<string, { qty: number; value: number }>();

  for (const row of rows) {
    const createdAt = new Date(row.created_at || 0).getTime();
    if (Number.isFinite(asOfMs) && createdAt > asOfMs) continue;

    const qty = Number(row.quantity_change || 0);
    const unitCost = Number(row.unit_cost || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) continue;

    const type = row.transaction_type || "";
    const referenceId = row.reference_id || "";
    const sign = qty > 0 ? "positive" : qty < 0 ? "negative" : "zero";
    const combo = `${type}/${sign}`;

    switch (combo) {
      // PO_RECEIPT/positive (real cost, the common case), plus
      // PRODUCTION_YIELD/positive and STOCK_ADJUST/positive on the rare
      // occasion either carries a real unit_cost.
      case "PO_RECEIPT/positive":
      case "PRODUCTION_YIELD/positive":
      case "STOCK_ADJUST/positive": {
        if (unitCost > 0) {
          totalQty += qty;
          totalValue += qty * unitCost;
          latestKnownMac = totalQty > 0 ? totalValue / totalQty : latestKnownMac;
          const prior = addedByReference.get(referenceId) || { qty: 0, value: 0 };
          addedByReference.set(referenceId, { qty: prior.qty + qty, value: prior.value + qty * unitCost });
        }
        // unit_cost 0 (the observed case for PRODUCTION_YIELD and
        // STOCK_ADJUST in production): no-op by design. Semi-products never
        // carry their own accumulated MAC -- cost always comes from
        // exploding the recipe fresh (getMacUnitCostWithRecipeFallback).
        break;
      }

      case "SALES_CONSUME/negative":
      case "PRODUCTION_CONSUME/negative": {
        if (totalQty > 0) {
          const consumeQty = Math.min(totalQty, Math.abs(qty));
          const consumedValue = consumeQty * latestKnownMac;
          totalQty -= consumeQty;
          totalValue -= consumedValue;
          const prior = consumedByReference.get(referenceId) || { qty: 0, value: 0 };
          consumedByReference.set(referenceId, { qty: prior.qty + consumeQty, value: prior.value + consumedValue });
        }
        break;
      }

      case "EDIT_REVERSAL/positive": {
        // Undoes an earlier negative-qty consumption row for the same
        // reference_id -- restore exactly the (qty, value) that
        // consumption removed.
        const consumed = consumedByReference.get(referenceId);
        if (consumed && consumed.qty > 0) {
          const restoreQty = Math.min(qty, consumed.qty);
          const restoreValue = (restoreQty / consumed.qty) * consumed.value;
          totalQty += restoreQty;
          totalValue += restoreValue;
          latestKnownMac = totalQty > 0 ? totalValue / totalQty : latestKnownMac;
          consumed.qty -= restoreQty;
          consumed.value -= restoreValue;
        }
        break;
      }

      case "EDIT_REVERSAL/negative": {
        // Undoes an earlier positive-qty addition row for the same
        // reference_id -- remove exactly the (qty, value) that addition
        // contributed. A no-op when the addition it undoes never had a
        // real unit_cost to begin with (nothing tracked in
        // addedByReference for that reference_id), which is the observed
        // case in production (undoing a zero-cost PRODUCTION_YIELD).
        const added = addedByReference.get(referenceId);
        if (added && added.qty > 0) {
          const removeQty = Math.min(Math.abs(qty), added.qty);
          const removeValue = (removeQty / added.qty) * added.value;
          totalQty -= removeQty;
          totalValue -= removeValue;
          latestKnownMac = totalQty > 0 ? totalValue / totalQty : latestKnownMac;
          added.qty -= removeQty;
          added.value -= removeValue;
        }
        break;
      }

      default: {
        // Not observed in production as of the 2026-07-30 sweep. Matches
        // this function's behavior from before that sweep, so an
        // unobserved combination cannot silently regress: a real-cost
        // addition still counts, negative quantity still consumes.
        if (COST_INPUT_TYPES.has(type) && qty > 0 && unitCost > 0) {
          totalQty += qty;
          totalValue += qty * unitCost;
          latestKnownMac = totalQty > 0 ? totalValue / totalQty : latestKnownMac;
        } else if (qty < 0 && totalQty > 0) {
          const consumeQty = Math.min(totalQty, Math.abs(qty));
          totalQty -= consumeQty;
          totalValue -= consumeQty * latestKnownMac;
        }
      }
    }
  }

  return latestKnownMac;
}

export function computeMacCostForConsumptionRows(
  rows: ConsumptionRow[],
  ledger: MacLedgerSource,
  saleTime: string,
  semiProductContext?: MacSemiProductContext,
): number {
  const total = rows.reduce((sum, row) => {
    const unitCost = getMacUnitCostWithRecipeFallback(row.item_reference, ledger, saleTime, semiProductContext);
    return sum + unitCost * row.quantity;
  }, 0);
  return total;
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
  return total;
}

export function getMacUnitCostWithRecipeFallback(
  itemReference: string,
  ledger: MacLedgerSource,
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
  ledger: MacLedgerSource,
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
