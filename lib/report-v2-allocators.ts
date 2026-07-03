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
import {
  buildLineConsumptionRows,
  type SemiProductConsumptionMaps,
} from "@/lib/inventory-consumption";
import {
  getMacUnitCostWithRecipeFallback,
  type MacLedgerEntry,
  type MacLedgerIndex,
} from "@/lib/mac-cogs";

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
 * Filter ledger entries before passing to FIFOTracker.init().
 *
 * Why: FIFOTracker.init() consumes SALES_CONSUME / PRODUCTION_CONSUME during
 * initialization. If allocator functions pass full ledger, batches are
 * depleted before per-line consumption — causing late-processed lines to
 * see zero stock and report COGS = 0 for their modifiers.
 * Mirrors auditCogsDrift pattern in lib/cogs-drift-audit.ts.
 *
 * Claude code — fix for "Đào miếng" topping showing 0 COGS in P&L.
 */
export function filterLedgerForFifoInit(ledger: any[]): any[] {
  return ledger.filter(e =>
    e.transaction_type !== "SALES_CONSUME" &&
    e.transaction_type !== "EDIT_REVERSAL",
  );
}

function modifierQtyByIdFromLine(line: OrderLineV2): Map<string, number> {
  try {
    const modifiers = JSON.parse(line.modifiers_snapshot_json || "[]");
    if (!Array.isArray(modifiers)) return new Map();
    return new Map(modifiers.map((mod: any) => [String(mod.id || ""), Number(mod.qty || 1)]));
  } catch {
    return new Map();
  }
}

/**
 * Parse SEMI_PRODUCT ingredients JSON. Throws on malformed JSON so callers
 * surface the error instead of silently producing COGS = 0.
 *
 * Claude code — CODE-5 fix.
 */
function parseSpIngredients(ingredientsJson: string, spId: string): any[] {
  let parsed: any;
  try {
    parsed = JSON.parse(ingredientsJson);
  } catch (err) {
    throw new Error(`SEMI_PRODUCT ${spId} has malformed ingredients_json: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`SEMI_PRODUCT ${spId} ingredients_json is not an array`);
  }
  return parsed;
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

export function breakdownCOGSByIngredient(
  lines: OrderLineV2[],
  orders: any[],
  ledger: any[],
  macLedgerIndex: MacLedgerIndex,
  spContext?: any,
): IngredientCOGSRow[] {
  const map = new Map<string, IngredientCOGSRow>();
  const orderById = new Map<string, any>();
  for (const order of orders) orderById.set(order.id, order);

  const consumptionMaps = toConsumptionMaps(spContext);
  const macContext = toMacSemiProductContext(spContext);

  // Claude code — perf Tier 3: pre-sort ledger by created_at once.
  // Sliding window for ledger slice per line: O(n+m) instead of O(n*m).
  const ledgerSorted = [...(ledger as MacLedgerEntry[])].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );
  const ledgerTimes = ledgerSorted.map(row => new Date(row.created_at || 0).getTime());

  const sortedLines = [...lines].sort((a, b) => {
    const aTime = orderById.get(a.order_id)?.created_at || "";
    const bTime = orderById.get(b.order_id)?.created_at || "";
    return new Date(aTime || 0).getTime() - new Date(bTime || 0).getTime();
  });

  let ledgerCursor = 0;
  const runningBalances = new Map<string, number>();
  for (const line of sortedLines) {
    if (line.cost_at_sale <= 0) continue;

    const saleTime = orderById.get(line.order_id)?.created_at || "";
    const saleMs = new Date(saleTime || 0).getTime();

    // Sliding window: advance cursor while ledger time < saleMs.
    while (ledgerCursor < ledgerTimes.length && ledgerTimes[ledgerCursor] < saleMs) {
      const row = ledgerSorted[ledgerCursor];
      const itemReference = row.item_reference;
      const quantity = Number(row.quantity_change || 0);
      if (itemReference && Number.isFinite(quantity) && quantity !== 0) {
        runningBalances.set(itemReference, (runningBalances.get(itemReference) || 0) + quantity);
      }
      ledgerCursor += 1;
    }

    const balances = new Map(runningBalances);
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    const consumptionRows = buildLineConsumptionRows(lineRecipe, line.qty, balances, consumptionMaps);
    const weightedRows = consumptionRows
      .filter(row => row.quantity > 0)
      .map(row => ({
        ...row,
        rawCost: row.quantity * getMacUnitCostWithRecipeFallback(
          row.item_reference,
          macLedgerIndex,
          saleTime,
          macContext,
        ),
      }));
    const rawTotal = weightedRows.reduce((sum, row) => sum + row.rawCost, 0);

    if (rawTotal <= 0) {
      addIngredientCogs(map, "UNALLOCATED", 0, line.cost_at_sale);
      continue;
    }

    let allocatedTotal = 0;
    weightedRows.forEach((row, index) => {
      const isLast = index === weightedRows.length - 1;
      const cogs = isLast
        ? line.cost_at_sale - allocatedTotal
        : Math.round((row.rawCost / rawTotal) * line.cost_at_sale);
      allocatedTotal += cogs;
      addIngredientCogs(map, row.item_reference, row.quantity, cogs);
    });
  }

  return Array.from(map.values());
}

function addIngredientCogs(
  map: Map<string, IngredientCOGSRow>,
  ingredientId: string,
  qty: number,
  cogs: number,
): void {
  if (!ingredientId || cogs === 0) return;
  if (!map.has(ingredientId)) {
    map.set(ingredientId, { ingredient_id: ingredientId, cogs: 0, qty_consumed: 0 });
  }
  const row = map.get(ingredientId)!;
  row.cogs += cogs;
  row.qty_consumed += qty;
}

function toConsumptionMaps(spContext?: any): SemiProductConsumptionMaps {
  const semiProductRecipes = new Map();
  const semiProductYields = new Map();

  if (spContext?.semiProductRecipes instanceof Map) {
    for (const [id, recipe] of spContext.semiProductRecipes.entries()) semiProductRecipes.set(id, recipe);
  }
  if (spContext?.semiProductYields instanceof Map) {
    for (const [id, yieldQty] of spContext.semiProductYields.entries()) semiProductYields.set(id, yieldQty);
  }
  if (Array.isArray(spContext?.recipes)) {
    for (const recipe of spContext.recipes) {
      if (!recipe.target_id || !recipe.ingredients_json) continue;
      semiProductRecipes.set(recipe.target_id, parseSpIngredients(recipe.ingredients_json, recipe.target_id));
    }
  }
  if (spContext?.yields instanceof Map) {
    for (const [id, yieldQty] of spContext.yields.entries()) semiProductYields.set(id, yieldQty);
  }

  return { semiProductRecipes, semiProductYields };
}

function toMacSemiProductContext(spContext?: any) {
  const maps = toConsumptionMaps(spContext);
  return {
    semiProductRecipes: maps.semiProductRecipes,
    semiProductYields: maps.semiProductYields,
  };
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
function breakdownCOGSByIngredientFifoLegacy(
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
  tracker.init(filterLedgerForFifoInit(ledger));

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
    const modifierQtyById = modifierQtyByIdFromLine(line);

    // Collect all BASE ingredients needed (resolve SEMI_PRODUCTs)
    const baseIngredients: Array<{ id: string; qty: number }> = [];

    // Variant recipe
    for (const ing of lineRecipe.variant.ingredients) {
      if (ing.quantity <= 0) continue;
      if (ing.ingredient_type === "SEMI_PRODUCT" && spContext) {
        const spRecipe = spContext.recipes.find((r: any) => r.target_id === ing.ingredient_id);
        if (!spRecipe || !spRecipe.ingredients_json) {
          // Claude code — CODE-5: surface missing SP recipe instead of silent skip.
          throw new Error(`SEMI_PRODUCT ${ing.ingredient_id} has no recipe in spContext (variant)`);
        }
        const spIngs = parseSpIngredients(spRecipe.ingredients_json, ing.ingredient_id);
        const yieldQty = spContext.yields.get(ing.ingredient_id) || 1;
        if (yieldQty <= 0) continue;
        for (const spIng of spIngs) {
          baseIngredients.push({
            id: spIng.ingredient_id,
            qty: (Number(spIng.quantity || 0) / yieldQty) * ing.quantity * lineQty,
          });
        }
      } else if (ing.ingredient_type === "BASE_INGREDIENT") {
        baseIngredients.push({ id: ing.ingredient_id, qty: ing.quantity * lineQty });
      }
    }

    // Modifier recipes (same resolution)
    for (const modEntry of lineRecipe.modifiers) {
      const modifierQty = Number(modEntry.modifier_qty || modifierQtyById.get(modEntry.modifier_id) || 1);
      for (const ing of modEntry.recipe.ingredients) {
        if (ing.quantity <= 0) continue;
        if (ing.ingredient_type === "SEMI_PRODUCT" && spContext) {
          const spRecipe = spContext.recipes.find((r: any) => r.target_id === ing.ingredient_id);
          if (!spRecipe || !spRecipe.ingredients_json) {
            throw new Error(`SEMI_PRODUCT ${ing.ingredient_id} has no recipe in spContext (modifier ${modEntry.modifier_id})`);
          }
          const spIngs = parseSpIngredients(spRecipe.ingredients_json, ing.ingredient_id);
          const yieldQty = spContext.yields.get(ing.ingredient_id) || 1;
          if (yieldQty <= 0) continue;
          for (const spIng of spIngs) {
            baseIngredients.push({
              id: spIng.ingredient_id,
              qty: (Number(spIng.quantity || 0) / yieldQty) * ing.quantity * lineQty * modifierQty,
            });
          }
        } else if (ing.ingredient_type === "BASE_INGREDIENT") {
          baseIngredients.push({ id: ing.ingredient_id, qty: ing.quantity * lineQty * modifierQty });
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
  tracker.init(filterLedgerForFifoInit(ledger));

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
    const modifierQtyById = modifierQtyByIdFromLine(line);

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
      const modifierQty = Number(modEntry.modifier_qty || modifierQtyById.get(modEntry.modifier_id) || 1);
      const modOnlyRecipe = {
        variant: { target_type: "PRODUCT_VARIANT" as const, target_id: "", ingredients: [] as any[] },
        modifiers: [{ ...modEntry, modifier_qty: modifierQty }],
      };
      const modCost = computeLineCostFIFO(modOnlyRecipe, tracker, qty, spContext);

      if (!modifierMap.has(modEntry.modifier_id)) {
        modifierMap.set(modEntry.modifier_id, {
          cogs: 0, qty: 0, name: modEntry.modifier_name,
        });
      }
      const modRow = modifierMap.get(modEntry.modifier_id)!;
      modRow.cogs += modCost;
      modRow.qty += qty * modifierQty;
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
