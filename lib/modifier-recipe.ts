export type ModifierIngredientInput = {
  ingredient_type?: string;
  ingredient_id?: string;
  quantity?: string | number;
};

export type RecipeLike = {
  id?: string;
  end_date?: string;
};

export function parseModifierIngredients(json: string | null | undefined): ModifierIngredientInput[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function validateModifierIngredients(
  ingredients: ModifierIngredientInput[],
): { ok: true } | { ok: false; error: string } {
  const seen = new Set<string>();
  for (let index = 0; index < ingredients.length; index++) {
    const ing = ingredients[index];
    if (!ing.ingredient_id) continue;
    const quantity = Number(ing.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: `Dòng định mức ${index + 1}: số lượng phải lớn hơn 0` };
    }
    const key = `${ing.ingredient_type || "BASE_INGREDIENT"}:${ing.ingredient_id}`;
    if (seen.has(key)) {
      return { ok: false, error: `Dòng định mức ${index + 1}: nguyên liệu bị trùng` };
    }
    seen.add(key);
  }
  return { ok: true };
}

export function normalizeModifierIngredients(ingredients: ModifierIngredientInput[]): Array<{
  ingredient_type: string;
  ingredient_id: string;
  quantity: number;
}> {
  return ingredients
    .filter(ing => ing.ingredient_id)
    .map(ing => ({
      ingredient_type: ing.ingredient_type || "BASE_INGREDIENT",
      ingredient_id: ing.ingredient_id || "",
      quantity: Number(ing.quantity),
    }));
}

export function normalizeQuantityInput(value: string): string {
  if (/^0+\d/.test(value) && !value.startsWith("0.")) {
    return value.replace(/^0+/, "");
  }
  return value;
}

export function findActiveRecipeIntegrity<T extends RecipeLike>(recipes: T[]): {
  activeRecipe?: T;
  activeRecipeCount: number;
  hasMultipleActiveRecipes: boolean;
} {
  const activeRecipes = recipes.filter(recipe => !recipe.end_date || recipe.end_date === "");
  return {
    activeRecipe: activeRecipes[0],
    activeRecipeCount: activeRecipes.length,
    hasMultipleActiveRecipes: activeRecipes.length > 1,
  };
}
