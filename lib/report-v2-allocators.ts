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
import { computeLineCostFIFO } from "@/lib/order-cogs-fifo";
import { FIFOTracker } from "@/lib/fifo-tracker";

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
 * Break down COGS across raw ingredients (Base_Ingredients only — SEMI_PRODUCTs resolved).
 *
 * WS-11 fix: replaced proportional-qty split (mixed units like ml + miếng
 * gave garbage results — e.g., đào miếng showed 37đ/piece). Now consumes
 * each ingredient from FIFO tracker directly. Each ingredient's COGS =
 * its own FIFO consumption, NOT a share of line total.
 *
 * @param lines - V2 order lines
 * @param orders - V2 orders (for chronological sort)
 * @param ledger - Stock_Ledger for FIFO batches
 * @param spContext - SEMI_PRODUCT recipes + yields (for resolving SP to base ingredients)
 */
export function breakdownCOGSByIngredient(
  lines: OrderLineV2[],
  orders: any[] = [],
  ledger: any[] = [],
  spContext?: any,
): IngredientCOGSRow[] {
  const map = new Map<string, IngredientCOGSRow>();

  // Build order lookup for chronological sort
  const orderById = new Map<string, any>();
  for (const o of orders) orderById.set(o.id, o);

  // WS-11: FIFO tracker shared across lines (must process chronologically)
  const tracker = new FIFOTracker();
  tracker.init(ledger);

  // Sort lines by order.created_at for FIFO correctness
  const sortedLines = [...lines].sort((a, b) => {
    const oa = orderById.get(a.order_id);
    const ob = orderById.get(b.order_id);
    const ta = oa?.created_at ? new Date(oa.created_at).getTime() : 0;
    const tb = ob?.created_at ? new Date(ob.created_at).getTime() : 0;
    return ta - tb;
  });

  for (const line of sortedLines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    const lineQty = line.qty;

    // Collect all BASE ingredients needed (resolve SEMI_PRODUCTs)
    const baseIngredients: Array<{ id: string; qty: number }> = [];

    // Variant recipe
    for (const ing of lineRecipe.variant.ingredients) {
      if (ing.quantity <= 0) continue;
      if (ing.ingredient_type === "SEMI_PRODUCT" && spContext) {
        const spRecipe = spContext.recipes.find((r: any) => r.target_id === ing.ingredient_id);
        if (!spRecipe || !spRecipe.ingredients_json) continue;
        try {
          const spIngs = JSON.parse(spRecipe.ingredients_json);
          const yieldQty = spContext.yields.get(ing.ingredient_id) || 1;
          if (yieldQty <= 0) continue;
          for (const spIng of spIngs) {
            baseIngredients.push({
              id: spIng.ingredient_id,
              qty: (Number(spIng.quantity || 0) / yieldQty) * ing.quantity * lineQty,
            });
          }
        } catch {}
      } else if (ing.ingredient_type === "BASE_INGREDIENT") {
        baseIngredients.push({ id: ing.ingredient_id, qty: ing.quantity * lineQty });
      }
    }

    // Modifier recipes (same resolution)
    for (const modEntry of lineRecipe.modifiers) {
      for (const ing of modEntry.recipe.ingredients) {
        if (ing.quantity <= 0) continue;
        if (ing.ingredient_type === "SEMI_PRODUCT" && spContext) {
          const spRecipe = spContext.recipes.find((r: any) => r.target_id === ing.ingredient_id);
          if (!spRecipe || !spRecipe.ingredients_json) continue;
          try {
            const spIngs = JSON.parse(spRecipe.ingredients_json);
            const yieldQty = spContext.yields.get(ing.ingredient_id) || 1;
            if (yieldQty <= 0) continue;
            for (const spIng of spIngs) {
              baseIngredients.push({
                id: spIng.ingredient_id,
                qty: (Number(spIng.quantity || 0) / yieldQty) * ing.quantity * lineQty,
              });
            }
          } catch {}
        } else if (ing.ingredient_type === "BASE_INGREDIENT") {
          baseIngredients.push({ id: ing.ingredient_id, qty: ing.quantity * lineQty });
        }
      }
    }

    // Consume each base ingredient from FIFO tracker, attribute cost directly
    for (const ing of baseIngredients) {
      if (ing.qty <= 0) continue;
      const cost = tracker.consume(ing.id, ing.qty);
      if (!map.has(ing.id)) {
        map.set(ing.id, { ingredient_id: ing.id, cogs: 0, qty_consumed: 0 });
      }
      const row = map.get(ing.id)!;
      row.cogs += cost;
      row.qty_consumed += ing.qty;
    }
  }

  return Array.from(map.values());
}

export interface ModifierCOGSRow {
  modifier_id: string;
  modifier_name: string;
  cogs: number;
  qty_consumed: number;
}

/**
 * Break down COGS by source: variant recipe ingredients vs modifier recipe ingredients.
 * Used by PnL report to attribute COGS to toppings (modifiers), not just drinks (variants).
 *
 * WS-10 fix: replaced proportional-qty split (which under-attributed expensive toppings
 * like 20ml cốt cà phê) with accurate MAC per source. Resolves SEMI_PRODUCT ingredients
 * via spContext.
 *
 * @param lines - V2 order lines
 * @param orders - V2 orders (for sale time lookup)
 * @param ledger - Stock_Ledger for MAC computation
 * @param spContext - Semi-product recipes + yields (for SP resolution)
 */
export function breakdownCOGSBySource(
  lines: OrderLineV2[],
  orders: any[] = [],
  ledger: any[] = [],
  spContext?: any,
): { variantRows: IngredientCOGSRow[]; modifierRows: ModifierCOGSRow[] } {
  const variantMap = new Map<string, { cogs: number; qty: number }>();
  const modifierMap = new Map<string, { cogs: number; qty: number; name: string }>();

  // Build order lookup for sale time
  const orderById = new Map<string, any>();
  for (const o of orders) orderById.set(o.id, o);

  // WS-11: build FIFO tracker + sort lines by order.created_at so batches consumed chronologically
  const tracker = new FIFOTracker();
  tracker.init(ledger);

  // Sort lines by their order's created_at ascending for FIFO correctness
  const sortedLines = [...lines].sort((a, b) => {
    const oa = orderById.get(a.order_id);
    const ob = orderById.get(b.order_id);
    const ta = oa?.created_at ? new Date(oa.created_at).getTime() : 0;
    const tb = ob?.created_at ? new Date(ob.created_at).getTime() : 0;
    return ta - tb;
  });

  for (const line of sortedLines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    const qty = line.qty;

    // Compute variant-only FIFO for this line
    const variantRecipeOnly = { variant: lineRecipe.variant, modifiers: [] };
    const variantCost = computeLineCostFIFO(variantRecipeOnly, tracker, qty, spContext);

    if (variantCost > 0) {
      // Distribute variant cost across ingredients proportionally by their contribution
      const totalIngQty = lineRecipe.variant.ingredients.reduce((s, i) => s + i.quantity * qty, 0);
      for (const ing of lineRecipe.variant.ingredients) {
        const ingQty = ing.quantity * qty;
        const share = totalIngQty > 0 ? ingQty / totalIngQty : 0;
        if (!variantMap.has(ing.ingredient_id)) {
          variantMap.set(ing.ingredient_id, { cogs: 0, qty: 0 });
        }
        const row = variantMap.get(ing.ingredient_id)!;
        row.cogs += Math.round(variantCost * share);
        row.qty += ingQty;
      }
    }

    // Compute modifier-only FIFO for each modifier
    for (const modEntry of lineRecipe.modifiers) {
      const modOnlyRecipe = {
        variant: { target_type: "PRODUCT_VARIANT" as const, target_id: "", ingredients: [] as any[] },
        modifiers: [modEntry],
      };
      const modCost = computeLineCostFIFO(modOnlyRecipe, tracker, qty, spContext);

      if (!modifierMap.has(modEntry.modifier_id)) {
        modifierMap.set(modEntry.modifier_id, {
          cogs: 0, qty: 0, name: modEntry.modifier_name,
        });
      }
      const modRow = modifierMap.get(modEntry.modifier_id)!;
      modRow.cogs += modCost;
      modRow.qty += qty * Number(
        JSON.parse(line.modifiers_snapshot_json || "[]").find((m: any) => m.id === modEntry.modifier_id)?.qty || 1
      );
    }
  }

  return {
    variantRows: Array.from(variantMap.entries()).map(([id, v]) => ({
      ingredient_id: id, cogs: v.cogs, qty_consumed: v.qty,
    })),
    modifierRows: Array.from(modifierMap.entries()).map(([id, m]) => ({
      modifier_id: id, modifier_name: m.name, cogs: m.cogs, qty_consumed: m.qty,
    })),
  };
}
