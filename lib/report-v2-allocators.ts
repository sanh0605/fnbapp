/**
 * Report-shape aggregations over V2 orders + lines.
 *
 * Pure functions. Use stored net_line_total and cost_at_sale; do not recompute.
 * Per-product revenue uses allocateLineRevenue (WS-1) for variant/modifier split.
 * Per-ingredient COGS uses parseLineRecipeSnapshot (WS-3) for ingredient walk.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 6.4)
 */

import { allocateLineRevenue } from "@/lib/order-math";
import { parseLineRecipeSnapshot } from "@/lib/order-types";
import type { OrderV2, OrderLineV2, LineForAllocation } from "@/lib/order-types";

export interface ProductRevenueRow {
  product_id: string;
  product_name: string;
  variant_id: string;
  size_name: string;
  qty: number;
  revenue: number;
}

export interface IngredientCOGSRow {
  ingredient_id: string;
  cogs: number;
  qty_consumed: number;
}

/**
 * Break down revenue across products (and modifiers as pseudo-products).
 * Total of all `revenue` fields equals sum of order.net_total values.
 */
export function breakdownRevenueByProduct(
  orders: OrderV2[],
  lines: OrderLineV2[],
): ProductRevenueRow[] {
  const validOrderIds = new Set(orders.map(o => o.id));
  const map = new Map<string, ProductRevenueRow>();

  for (const line of lines) {
    if (!validOrderIds.has(line.order_id)) continue;

    const productSnap = JSON.parse(line.product_snapshot_json || "{}");
    const variantSnap = JSON.parse(line.variant_snapshot_json || "{}");
    const modifiers = JSON.parse(line.modifiers_snapshot_json || "[]");

    const lineForAlloc: LineForAllocation = {
      unit_price: line.unit_price,
      qty: line.qty,
      modifiers,
      gross_line_total: line.gross_line_total,
      promo_discount: line.promo_discount,
      manual_item_discount: line.manual_item_discount,
      order_discount_allocation: line.order_discount_allocation,
    };

    const alloc = allocateLineRevenue(lineForAlloc);

    // Variant row
    const variantKey = `${line.product_id}__${line.variant_id}`;
    if (!map.has(variantKey)) {
      map.set(variantKey, {
        product_id: line.product_id,
        product_name: productSnap.name || line.product_id,
        variant_id: line.variant_id,
        size_name: variantSnap.size_name || "",
        qty: 0,
        revenue: 0,
      });
    }
    const variantRow = map.get(variantKey)!;
    variantRow.qty += line.qty;
    variantRow.revenue += alloc.variantRevenue;

    // Modifier rows (each modifier is its own pseudo-product for revenue attribution)
    for (const mod of modifiers) {
      const modKey = `MOD:${mod.id}`;
      if (!map.has(modKey)) {
        map.set(modKey, {
          product_id: modKey,
          product_name: mod.name || mod.id,
          variant_id: "",
          size_name: "",
          qty: 0,
          revenue: 0,
        });
      }
      const modRow = map.get(modKey)!;
      modRow.qty += line.qty * Number(mod.qty || 1);
      modRow.revenue += alloc.modifierRevenue[mod.id] || 0;
    }
  }

  return Array.from(map.values()).filter(r => r.qty > 0 || r.revenue > 0);
}

/**
 * Break down COGS across raw ingredients (Base_Ingredients + Semi_Products).
 * Uses line.cost_at_sale (pinned at sale time) and splits proportionally
 * by ingredient quantity within the line's recipe snapshot.
 *
 * Total of all `cogs` fields equals sum of line.cost_at_sale values.
 */
export function breakdownCOGSByIngredient(lines: OrderLineV2[]): IngredientCOGSRow[] {
  const map = new Map<string, IngredientCOGSRow>();

  for (const line of lines) {
    if (line.cost_at_sale <= 0) continue;
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);

    // Collect all ingredients for this line with their quantities
    const allIngredients: Array<{ id: string; qty: number }> = [];
    for (const ing of lineRecipe.variant.ingredients) {
      allIngredients.push({ id: ing.ingredient_id, qty: ing.quantity * line.qty });
    }
    for (const modEntry of lineRecipe.modifiers) {
      for (const ing of modEntry.recipe.ingredients) {
        allIngredients.push({ id: ing.ingredient_id, qty: ing.quantity * line.qty });
      }
    }

    const totalQty = allIngredients.reduce((s, i) => s + i.qty, 0);
    if (totalQty <= 0) continue;

    for (const ing of allIngredients) {
      if (!map.has(ing.id)) {
        map.set(ing.id, { ingredient_id: ing.id, cogs: 0, qty_consumed: 0 });
      }
      const row = map.get(ing.id)!;
      const share = ing.qty / totalQty;
      row.cogs += Math.round(line.cost_at_sale * share);
      row.qty_consumed += ing.qty;
    }
  }

  return Array.from(map.values());
}
