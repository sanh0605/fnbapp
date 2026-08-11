/**
 * Read-only diagnostic for the semi-product batch-yield hypothesis
 * (docs/superpowers/specs/2026-07-27-inventory-transparency-design.md).
 *
 * batch_yield carries no unit and is only implicitly expressed in the
 * semi-product's base_unit, while recipe quantities are implicitly in each
 * ingredient's own base unit. Nothing in the system validates that these
 * implicit units agree, so a yield entered in the wrong unit silently scales
 * every implicit-production consumption by a power of ten.
 *
 * Pure module: no I/O, no Supabase, no console. Never mutates its inputs.
 */

export interface SemiProductInput {
  id?: string;
  name?: string;
  base_unit?: string | null;
  batch_yield?: string | number | null;
  status?: string | null;
}

export interface RecipeIngredientInput {
  ingredient_id?: string;
  ingredient_type?: string;
  quantity?: string | number;
}

export interface RecipeInput {
  target_type?: string;
  target_id?: string;
  ingredients_json?: RecipeIngredientInput[] | string | null;
  status?: string | null;
}

export function parseRecipeIngredients(recipe: RecipeInput): RecipeIngredientInput[] {
  const raw = recipe.ingredients_json;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Malformed rows must not abort a whole-table diagnostic.
    return [];
  }
}

export type YieldFlag = "NO_COOKING_RECIPE" | "YIELD_DEFAULT_1" | "YIELD_SCALE_SUSPECT" | "OK";

/** A ratio at or above this between largest recipe input and batch yield reads as a unit-scale error. */
export const SCALE_SUSPECT_RATIO = 100;

export interface YieldAuditInput {
  semiProducts: SemiProductInput[];
  recipes: RecipeInput[];
}

export interface SemiProductYieldFinding {
  semiProductId: string;
  semiProductName: string;
  baseUnit: string;
  batchYield: number;
  cookingInputs: Array<{ ingredientId: string; quantity: number }>;
  largestInputQuantity: number;
  scaleRatio: number;
  consumerRecipeCount: number;
  typicalConsumedQuantity: number;
  impliedRawPerServing: Array<{ ingredientId: string; quantity: number }>;
  flag: YieldFlag;
}

function isActive(status: string | null | undefined): boolean {
  return (status || "ACTIVE") === "ACTIVE";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function auditSemiProductYields(input: YieldAuditInput): SemiProductYieldFinding[] {
  const activeRecipes = input.recipes.filter(recipe => isActive(recipe.status));

  const cookingByTarget = new Map<string, RecipeInput>();
  for (const recipe of activeRecipes) {
    if (recipe.target_type === "SEMI_PRODUCT" && recipe.target_id) {
      cookingByTarget.set(recipe.target_id, recipe);
    }
  }

  // Every quantity at which some recipe consumes a given semi-product.
  const consumedQuantities = new Map<string, number[]>();
  for (const recipe of activeRecipes) {
    for (const ingredient of parseRecipeIngredients(recipe)) {
      if (ingredient.ingredient_type !== "SEMI_PRODUCT" || !ingredient.ingredient_id) continue;
      const quantity = Number(ingredient.quantity || 0);
      if (quantity <= 0) continue;
      const bucket = consumedQuantities.get(ingredient.ingredient_id) || [];
      bucket.push(quantity);
      consumedQuantities.set(ingredient.ingredient_id, bucket);
    }
  }

  const findings: SemiProductYieldFinding[] = [];

  for (const semiProduct of input.semiProducts) {
    if (!semiProduct.id || !isActive(semiProduct.status)) continue;

    const quantities = consumedQuantities.get(semiProduct.id);
    // A semi-product nothing consumes cannot trigger implicit production.
    if (!quantities || quantities.length === 0) continue;

    const batchYield = Number(semiProduct.batch_yield) || 1;
    const typicalConsumedQuantity = median(quantities);

    const cookingRecipe = cookingByTarget.get(semiProduct.id);
    const cookingInputs = cookingRecipe
      ? parseRecipeIngredients(cookingRecipe)
          .filter(ingredient => ingredient.ingredient_id && Number(ingredient.quantity || 0) > 0)
          .map(ingredient => ({
            ingredientId: String(ingredient.ingredient_id),
            quantity: Number(ingredient.quantity),
          }))
      : [];

    const largestInputQuantity = cookingInputs.reduce(
      (largest, row) => Math.max(largest, row.quantity),
      0,
    );
    const scaleRatio = batchYield > 0 ? largestInputQuantity / batchYield : 0;

    const impliedRawPerServing = cookingInputs.map(row => ({
      ingredientId: row.ingredientId,
      quantity: (row.quantity / batchYield) * typicalConsumedQuantity,
    }));

    let flag: YieldFlag = "OK";
    if (!cookingRecipe) {
      flag = "NO_COOKING_RECIPE";
    } else if (batchYield === 1 && largestInputQuantity > 1) {
      flag = "YIELD_DEFAULT_1";
    } else if (scaleRatio >= SCALE_SUSPECT_RATIO) {
      flag = "YIELD_SCALE_SUSPECT";
    }

    findings.push({
      semiProductId: semiProduct.id,
      semiProductName: semiProduct.name || semiProduct.id,
      baseUnit: semiProduct.base_unit || "",
      batchYield,
      cookingInputs,
      largestInputQuantity,
      scaleRatio,
      consumerRecipeCount: quantities.length,
      typicalConsumedQuantity,
      impliedRawPerServing,
      flag,
    });
  }

  // Most suspicious first, so the owner reads the real problems at the top.
  const order: Record<YieldFlag, number> = {
    NO_COOKING_RECIPE: 0,
    YIELD_DEFAULT_1: 1,
    YIELD_SCALE_SUSPECT: 2,
    OK: 3,
  };
  return findings.sort(
    (a, b) => order[a.flag] - order[b.flag] || b.scaleRatio - a.scaleRatio,
  );
}
