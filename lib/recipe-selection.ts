export type EffectiveRecipe = {
  id?: string;
  target_type?: string;
  target_id?: string;
  status?: string;
  ingredients_json?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type RecipeIngredientInput = {
  ingredient_type?: string;
  ingredient_id?: string;
  quantity?: string | number;
};

export type RecipeSaveDecision =
  | "CREATE_INITIAL"
  | "UNCHANGED"
  | "CREATE_VERSION";

export function selectEffectiveRecipe(
  recipes: EffectiveRecipe[],
  targetType: string,
  targetId: string,
  asOf: string,
): EffectiveRecipe | null {
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) {
    throw new Error(`Invalid recipe as-of timestamp: ${asOf}`);
  }

  const candidates = recipes.filter((recipe) => {
    if (recipe.target_type !== targetType || recipe.target_id !== targetId) {
      return false;
    }
    if (recipe.status && recipe.status !== "ACTIVE") {
      return false;
    }

    const startValue = recipe.start_date || recipe.created_at;
    const startMs = startValue ? new Date(startValue).getTime() : 0;
    if (Number.isFinite(startMs) && startMs > asOfMs) {
      return false;
    }

    if (recipe.end_date) {
      const endMs = new Date(recipe.end_date).getTime();
      if (!Number.isFinite(endMs) || endMs <= asOfMs) {
        return false;
      }
    }
    return true;
  });

  candidates.sort((left, right) => {
    const leftEffective = new Date(
      left.start_date || left.created_at || 0,
    ).getTime();
    const rightEffective = new Date(
      right.start_date || right.created_at || 0,
    ).getTime();
    if (leftEffective !== rightEffective) {
      return rightEffective - leftEffective;
    }

    const leftCreated = new Date(left.created_at || 0).getTime();
    const rightCreated = new Date(right.created_at || 0).getTime();
    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }
    return String(right.id || "").localeCompare(String(left.id || ""));
  });

  return candidates[0] || null;
}

export function findLatestActiveRecipe(
  recipes: EffectiveRecipe[],
  targetType: string,
  targetId: string,
): EffectiveRecipe | null {
  const candidates = recipes.filter((recipe) => (
    recipe.target_type === targetType
    && recipe.target_id === targetId
    && (!recipe.status || recipe.status === "ACTIVE")
    && !recipe.end_date
  ));

  candidates.sort((left, right) => {
    const timeDelta = (
      new Date(right.created_at || 0).getTime()
      - new Date(left.created_at || 0).getTime()
    );
    if (timeDelta !== 0) return timeDelta;
    return String(right.id || "").localeCompare(String(left.id || ""));
  });

  return candidates[0] || null;
}

export function planRecipeSave(
  recipes: EffectiveRecipe[],
  targetType: string,
  targetId: string,
  ingredients: RecipeIngredientInput[],
): {
  decision: RecipeSaveDecision;
  activeRecipe: EffectiveRecipe | null;
  newRecipeCount: 0 | 1;
} {
  const activeRecipe = findLatestActiveRecipe(
    recipes,
    targetType,
    targetId,
  );
  if (!activeRecipe) {
    return {
      decision: "CREATE_INITIAL",
      activeRecipe: null,
      newRecipeCount: 1,
    };
  }

  if (
    canonicalizeIngredients(activeRecipe.ingredients_json)
    === canonicalizeIngredients(ingredients)
  ) {
    return {
      decision: "UNCHANGED",
      activeRecipe,
      newRecipeCount: 0,
    };
  }

  return {
    decision: "CREATE_VERSION",
    activeRecipe,
    newRecipeCount: 1,
  };
}

function canonicalizeIngredients(
  input: string | RecipeIngredientInput[] | undefined,
): string {
  let ingredients: RecipeIngredientInput[];
  if (typeof input === "string") {
    const parsed = JSON.parse(input || "[]");
    if (!Array.isArray(parsed)) {
      throw new Error("Recipe ingredients must be an array");
    }
    ingredients = parsed;
  } else {
    ingredients = input || [];
  }

  return JSON.stringify(
    ingredients
      .map(ingredient => ({
        ingredient_type: ingredient.ingredient_type || "BASE_INGREDIENT",
        ingredient_id: ingredient.ingredient_id || "",
        quantity: Number(ingredient.quantity),
      }))
      .sort((left, right) => (
        `${left.ingredient_type}:${left.ingredient_id}`
          .localeCompare(`${right.ingredient_type}:${right.ingredient_id}`)
      )),
  );
}
