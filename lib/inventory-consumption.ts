import type { RecipeIngredientSnapshot, LineRecipeSnapshot } from "@/lib/order-types";
import { selectEffectiveRecipe } from "@/lib/recipe-selection";

export type ConsumptionRow = {
  item_reference: string;
  quantity: number;
  source: string;
};

export type ConsumptionAllocationInput = {
  ingredients: RecipeIngredientSnapshot[];
  multiplier: number;
  balances: Map<string, number>;
  semiProductRecipes: Map<string, RecipeIngredientSnapshot[]>;
  semiProductYields: Map<string, number>;
  source?: string;
  // Optional accumulator: when provided, records { shortfallSource ->
  // quantity } every time a semi-product shortfall is exploded into its
  // recipe ingredients -- keyed by the exact tag (e.g.
  // "VARIANT_RECIPE:BTP_SHORTFALL:BTP-013") already attached to the exploded
  // rows below, so the semi-product ID and the originating recipe source
  // can both be recovered from the key. Unused by existing callers (audits/
  // reports/COGS) -- only the live checkout/edit ledger-writing paths pass
  // this, to know how much of each semi-product needs an implicit
  // production step instead of debiting raw ingredients as if sold
  // directly. Does not change the returned ConsumptionRow[] shape or any
  // existing caller's behavior.
  implicitYields?: Map<string, number>;
};

export type SemiProductConsumptionMaps = {
  semiProductRecipes: Map<string, RecipeIngredientSnapshot[]>;
  semiProductYields: Map<string, number>;
};

/**
 * Build consumption rows from a parsed line recipe (variant + modifiers).
 * Shared by cogs-drift-audit, mac-cogs-audit, btp-shortfall-reprocess,
 * POS write path, admin edit write path.
 *
 * Claude code — R12/CODE-18: extract duplicated logic (was 4 copies).
 */
export function buildLineConsumptionRows(
  lineRecipe: LineRecipeSnapshot,
  lineQty: number,
  balances: Map<string, number>,
  consumptionMaps: SemiProductConsumptionMaps,
  implicitYields?: Map<string, number>,
): ConsumptionRow[] {
  const rows: ConsumptionRow[] = [];
  rows.push(...allocateRecipeConsumption({
    ingredients: lineRecipe.variant.ingredients,
    multiplier: lineQty,
    balances,
    ...consumptionMaps,
    source: "VARIANT_RECIPE",
    implicitYields,
  }));

  for (const modEntry of lineRecipe.modifiers) {
    const modifierQty = Number(modEntry.modifier_qty || 1);
    rows.push(...allocateRecipeConsumption({
      ingredients: modEntry.recipe.ingredients,
      multiplier: lineQty * modifierQty,
      balances,
      ...consumptionMaps,
      source: `MODIFIER_RECIPE:${modEntry.modifier_id}`,
      implicitYields,
    }));
  }
  return rows;
}

export function allocateRecipeConsumption(input: ConsumptionAllocationInput): ConsumptionRow[] {
  const rows: ConsumptionRow[] = [];
  const source = input.source || "VARIANT_RECIPE";

  for (const ingredient of input.ingredients) {
    const quantity = Number(ingredient.quantity || 0) * input.multiplier;
    if (!ingredient.ingredient_id || quantity <= 0) continue;

    if (ingredient.ingredient_type !== "SEMI_PRODUCT") {
      consume(input.balances, ingredient.ingredient_id, quantity);
      rows.push({ item_reference: ingredient.ingredient_id, quantity, source });
      continue;
    }

    const available = Math.max(0, input.balances.get(ingredient.ingredient_id) || 0);
    const semiQty = Math.min(available, quantity);
    const shortfallQty = quantity - semiQty;

    if (semiQty > 0) {
      consume(input.balances, ingredient.ingredient_id, semiQty);
      rows.push({ item_reference: ingredient.ingredient_id, quantity: semiQty, source });
    }

    if (shortfallQty <= 0) continue;

    const recipe = input.semiProductRecipes.get(ingredient.ingredient_id) || [];
    const yieldQty = input.semiProductYields.get(ingredient.ingredient_id) || 1;
    if (recipe.length === 0 || yieldQty <= 0) {
      consume(input.balances, ingredient.ingredient_id, shortfallQty);
      rows.push({ item_reference: ingredient.ingredient_id, quantity: shortfallQty, source });
      continue;
    }

    const shortfallSource = `${source}:BTP_SHORTFALL:${ingredient.ingredient_id}`;

    if (input.implicitYields) {
      input.implicitYields.set(
        shortfallSource,
        (input.implicitYields.get(shortfallSource) || 0) + shortfallQty,
      );
    }

    for (const recipeIngredient of recipe) {
      if (recipeIngredient.ingredient_type === "SEMI_PRODUCT") {
        rows.push(...allocateRecipeConsumption({
          ...input,
          ingredients: [{
            ...recipeIngredient,
            quantity: (Number(recipeIngredient.quantity || 0) / yieldQty) * shortfallQty,
          }],
          multiplier: 1,
          source: shortfallSource,
        }));
        continue;
      }

      const baseQty = (Number(recipeIngredient.quantity || 0) / yieldQty) * shortfallQty;
      if (baseQty <= 0) continue;
      consume(input.balances, recipeIngredient.ingredient_id, baseQty);
      rows.push({
        item_reference: recipeIngredient.ingredient_id,
        quantity: baseQty,
        source: shortfallSource,
      });
    }
  }

  return mergeRows(rows);
}

export function buildInventoryBalances(ledger: Array<{
  item_reference?: string;
  quantity_change?: string | number;
  created_at?: string;
  transaction_type?: string;
}>, asOf?: string): Map<string, number> {
  const asOfMs = asOf ? new Date(asOf).getTime() : Number.POSITIVE_INFINITY;
  const balances = new Map<string, number>();
  const rows = [...ledger].sort((a, b) =>
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );

  for (const row of rows) {
    if (!row.item_reference) continue;
    const at = new Date(row.created_at || 0).getTime();
    if (Number.isFinite(asOfMs) && at > asOfMs) continue;
    const quantity = Number(row.quantity_change || 0);
    if (!Number.isFinite(quantity) || quantity === 0) continue;
    balances.set(row.item_reference, (balances.get(row.item_reference) || 0) + quantity);
  }
  return balances;
}

export function buildSemiProductRecipeMaps(
  recipes: Array<{
    id?: string;
    target_type?: string;
    target_id?: string;
    ingredients_json?: string;
    status?: string;
    start_date?: string | null;
    end_date?: string | null;
    created_at?: string;
  }>,
  semiProducts: Array<{ id?: string; batch_yield?: string | number }>,
  asOf = new Date().toISOString(),
) {
  const semiProductRecipes = new Map<string, RecipeIngredientSnapshot[]>();
  for (const semiProduct of semiProducts) {
    if (!semiProduct.id) continue;
    const recipe = selectEffectiveRecipe(
      recipes,
      "SEMI_PRODUCT",
      semiProduct.id,
      asOf,
    );
    if (!recipe) continue;
    try {
      const parsed = JSON.parse(recipe.ingredients_json || "[]");
      if (Array.isArray(parsed)) {
        semiProductRecipes.set(
          semiProduct.id,
          parsed as RecipeIngredientSnapshot[],
        );
      }
    } catch {}
  }

  const semiProductYields = new Map<string, number>();
  for (const semiProduct of semiProducts) {
    if (!semiProduct.id) continue;
    semiProductYields.set(semiProduct.id, Number(semiProduct.batch_yield) || 1);
  }

  return { semiProductRecipes, semiProductYields };
}

function consume(balances: Map<string, number>, itemReference: string, quantity: number): void {
  balances.set(itemReference, (balances.get(itemReference) || 0) - quantity);
}

function mergeRows(rows: ConsumptionRow[]): ConsumptionRow[] {
  const merged = new Map<string, ConsumptionRow>();
  for (const row of rows) {
    const key = `${row.item_reference}\u0000${row.source}`;
    const current = merged.get(key);
    if (current) {
      current.quantity += row.quantity;
    } else {
      merged.set(key, { ...row });
    }
  }
  return [...merged.values()].filter(row => Math.abs(row.quantity) > 0.000001);
}

const SHORTFALL_TAG = ":BTP_SHORTFALL:";

export type ImplicitProductionYield = {
  item_reference: string;
  quantity: number;
};

export type ImplicitProductionSplit = {
  // Rows to write as the normal sale/edit consumption entries. Any
  // semi-product that had a shortfall has its quantity increased by the
  // shortfall amount here (folded in), and the raw-ingredient rows that
  // would previously have been debited directly are excluded -- they move
  // to productionConsumeRows instead.
  saleRows: ConsumptionRow[];
  // Raw-ingredient (or intermediate semi-product, for nested cases) rows
  // consumed to cover the shortfall -- write these as PRODUCTION_CONSUME.
  productionConsumeRows: ConsumptionRow[];
  // One row per distinct shortfall event -- write these as PRODUCTION_YIELD.
  productionYieldRows: ImplicitProductionYield[];
};

/**
 * Converts a shortfall-exploded ConsumptionRow[] (from buildLineConsumptionRows,
 * called with implicitYields tracking enabled) into the ledger-write shape
 * that reflects what actually has to happen physically: raw ingredients get
 * brewed/produced into the semi-product first, then the semi-product is what
 * the sale actually consumes -- instead of debiting raw ingredients as if
 * they were served to the customer directly.
 *
 * Only used by the live checkout/edit ledger-writing paths. Does not affect
 * allocateRecipeConsumption/buildLineConsumptionRows's own output or any of
 * their other callers (audits, reports, COGS calculation), which keep
 * reading the original ConsumptionRow[] exactly as before.
 */
export function splitImplicitProduction(
  rows: ConsumptionRow[],
  implicitYields: Map<string, number>,
): ImplicitProductionSplit {
  if (implicitYields.size === 0) {
    return { saleRows: rows, productionConsumeRows: [], productionYieldRows: [] };
  }

  const saleRows: ConsumptionRow[] = [];
  const productionConsumeRows: ConsumptionRow[] = [];

  for (const row of rows) {
    if (row.source.includes(SHORTFALL_TAG)) {
      productionConsumeRows.push(row);
    } else {
      saleRows.push({ ...row });
    }
  }

  const productionYieldRows: ImplicitProductionYield[] = [];
  for (const [shortfallSource, quantity] of implicitYields) {
    const tagIndex = shortfallSource.lastIndexOf(SHORTFALL_TAG);
    if (tagIndex < 0 || quantity <= 0) continue;
    const parentSource = shortfallSource.slice(0, tagIndex);
    const itemReference = shortfallSource.slice(tagIndex + SHORTFALL_TAG.length);

    productionYieldRows.push({ item_reference: itemReference, quantity });

    const existing = saleRows.find(
      row => row.item_reference === itemReference && row.source === parentSource,
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      saleRows.push({ item_reference: itemReference, quantity, source: parentSource });
    }
  }

  return {
    saleRows: saleRows.filter(row => Math.abs(row.quantity) > 0.000001),
    productionConsumeRows,
    productionYieldRows,
  };
}
