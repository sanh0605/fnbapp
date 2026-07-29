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
