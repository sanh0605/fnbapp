import { parseLineRecipeSnapshot } from "../order-types";
import type {
  BackdatedLedgerOrder,
  BackdatedLedgerOrderLine,
} from "../backdated-ledger/find-affected-lines";

export type BackdatedRecipeEvent = {
  id: string;
  target_type: string;
  target_id: string;
  effective_timestamp: string;
  visibility_timestamp: string;
  status?: string;
};

export type AffectedRecipeOrderLine = {
  line_id: string;
  order_id: string;
  order_no: string;
  sale_time: string;
  stored_cost_at_sale: number;
  product_id: string;
  qty: number;
};

export type FindAffectedRecipeLinesInput = {
  event: BackdatedRecipeEvent;
  orders: BackdatedLedgerOrder[];
  lines: BackdatedLedgerOrderLine[];
};

/**
 * Finds order lines affected by a backdated semi-product recipe-version
 * change. Unlike the PO_RECEIPT version (lib/backdated-ledger/find-affected-
 * lines.ts), this doesn't need to walk buildLineConsumptionRows to decide
 * relevance: a line's cost_at_sale depends on target_id's recipe whenever
 * target_id appears anywhere in the line's own frozen recipe_snapshot_json
 * as a SEMI_PRODUCT ingredient -- whether or not a shortfall happened,
 * since the semi-product's own MAC always falls back to its recipe
 * (PRODUCTION_YIELD rows always carry unit_cost 0).
 */
export function findAffectedRecipeLines(input: FindAffectedRecipeLinesInput): AffectedRecipeOrderLine[] {
  const effectiveMs = timestampMs(input.event.effective_timestamp);
  const visibilityMs = timestampMs(input.event.visibility_timestamp);
  if (!input.event.target_id || !Number.isFinite(effectiveMs) || !Number.isFinite(visibilityMs)) return [];

  const ordersInWindow = input.orders.filter(order => {
    if (order.status !== "COMPLETED" || order.superseded_by || !order.created_at) return false;
    const saleMs = timestampMs(order.created_at);
    return saleMs >= effectiveMs && saleMs <= visibilityMs;
  });
  if (ordersInWindow.length === 0) return [];

  const orderById = new Map(ordersInWindow.map(order => [order.id, order]));
  const affected: AffectedRecipeOrderLine[] = [];

  for (const line of input.lines) {
    const order = orderById.get(line.order_id);
    if (!order || !order.created_at) continue;

    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
    if (!lineReferencesTarget(lineRecipe, input.event.target_id)) continue;

    affected.push({
      line_id: line.id,
      order_id: line.order_id,
      order_no: order.order_no || order.id,
      sale_time: order.created_at,
      stored_cost_at_sale: Number(line.cost_at_sale || 0),
      product_id: String(line.product_id || ""),
      qty: Number(line.qty || 0),
    });
  }

  return affected.sort((a, b) =>
    timestampMs(a.sale_time) - timestampMs(b.sale_time) ||
    a.line_id.localeCompare(b.line_id),
  );
}

function lineReferencesTarget(
  lineRecipe: ReturnType<typeof parseLineRecipeSnapshot>,
  targetId: string,
): boolean {
  const inVariant = lineRecipe.variant.ingredients.some(
    ingredient => ingredient.ingredient_type === "SEMI_PRODUCT" && ingredient.ingredient_id === targetId,
  );
  if (inVariant) return true;

  return lineRecipe.modifiers.some(modifier =>
    modifier.recipe.ingredients.some(
      ingredient => ingredient.ingredient_type === "SEMI_PRODUCT" && ingredient.ingredient_id === targetId,
    ),
  );
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}
