export type RecipeHistoryRow = {
  id: string;
  target_type?: string;
  target_id?: string;
  status?: string;
  ingredients_json?: string | unknown[];
  created_at?: string;
  end_date?: string | null;
};

type IngredientRow = {
  ingredient_type?: string;
  ingredient_id?: string;
  quantity?: string | number;
};

type NamedEntity = {
  id: string;
  name?: string;
};

type VariantRow = {
  id: string;
  product_id?: string;
  size_name?: string;
};

export type RecipeTypeReplacement = {
  name: string;
  fromIngredientId: string;
  toIngredientId: string;
  fromIngredientType: string;
  toIngredientType: string;
};

export type RecipeTrueDrop = {
  name: string;
  ingredientId: string;
  ingredientType: string;
};

export type RecipeQuantityChange = {
  name: string;
  ingredientId: string;
  fromQuantity: number;
  toQuantity: number;
};

export type RecipeHistoryTransition = {
  fromRecipeId: string;
  toRecipeId: string;
  typeReplacements: RecipeTypeReplacement[];
  quantityChanges: RecipeQuantityChange[];
  trueDrops: RecipeTrueDrop[];
  additions: RecipeTrueDrop[];
  ambiguousNames: string[];
};

export type RecipeVariantAudit = {
  targetId: string;
  productName: string;
  sizeName: string;
  activeRecipeCount: number;
  timeline: RecipeHistoryRow[];
  transitions: RecipeHistoryTransition[];
};

export type RecipeCleanupRecommendation = {
  targetId: string;
  recipeId: string;
  reasons: string[];
};

export type RecipeHistoryAuditReport = {
  variants: RecipeVariantAudit[];
  cleanupRecommendations: RecipeCleanupRecommendation[];
  errors: string[];
};

export function auditRecipeHistory(input: {
  recipes: RecipeHistoryRow[];
  variants: VariantRow[];
  products: NamedEntity[];
  baseIngredients: NamedEntity[];
  semiProducts: NamedEntity[];
}): RecipeHistoryAuditReport {
  const namesById = new Map(
    [...input.baseIngredients, ...input.semiProducts]
      .map(entity => [entity.id, entity.name || entity.id]),
  );
  const variantsById = new Map(input.variants.map(variant => [variant.id, variant]));
  const productsById = new Map(input.products.map(product => [product.id, product]));
  const recipesByTarget = new Map<string, RecipeHistoryRow[]>();
  const invalidRecipeIds = new Set<string>();
  const errors: string[] = [];

  for (const recipe of input.recipes) {
    if (recipe.target_type !== "PRODUCT_VARIANT" || !recipe.target_id) continue;
    try {
      parseIngredients(recipe.ingredients_json);
    } catch {
      invalidRecipeIds.add(recipe.id);
      errors.push(`${recipe.id}: invalid ingredients JSON`);
    }
    const recipes = recipesByTarget.get(recipe.target_id) || [];
    recipes.push(recipe);
    recipesByTarget.set(recipe.target_id, recipes);
  }

  const variants = [...recipesByTarget.entries()].map(([targetId, recipes]) => {
    const timeline = [...recipes].sort(compareRecipeChronologically);
    const variant = variantsById.get(targetId);
    const product = productsById.get(variant?.product_id || "");
    const transitions: RecipeHistoryTransition[] = [];
    for (let index = 1; index < timeline.length; index += 1) {
      if (
        invalidRecipeIds.has(timeline[index - 1].id)
        || invalidRecipeIds.has(timeline[index].id)
      ) {
        continue;
      }
      transitions.push(compareRecipeTransition(
        timeline[index - 1],
        timeline[index],
        namesById,
      ));
    }

    return {
      targetId,
      productName: product?.name || variant?.product_id || targetId,
      sizeName: variant?.size_name || "",
      activeRecipeCount: timeline.filter(recipe => (
        !recipe.end_date
        && (!recipe.status || recipe.status === "ACTIVE")
      )).length,
      timeline,
      transitions,
    };
  }).sort((left, right) => (
    `${left.productName}:${left.sizeName}:${left.targetId}`
      .localeCompare(`${right.productName}:${right.sizeName}:${right.targetId}`, "vi")
  ));
  const cleanupRecommendations = variants.flatMap(variant => {
    const reasons = variant.transitions.flatMap(transition => (
      [
        ...transition.trueDrops.map(drop => `TRUE_DROP: ${drop.name}`),
        ...transition.ambiguousNames.map(name => `AMBIGUOUS_NAME: ${name}`),
      ]
    ));
    if (variant.activeRecipeCount > 1) {
      reasons.push(`MULTIPLE_ACTIVE: ${variant.activeRecipeCount} open recipes`);
    }
    for (const recipe of variant.timeline) {
      if (invalidRecipeIds.has(recipe.id)) {
        reasons.push(`INVALID_JSON: ${recipe.id}`);
      }
    }
    if (reasons.length === 0) return [];
    const latestActiveRecipe = [...variant.timeline]
      .reverse()
      .find(recipe => (
        !recipe.end_date
        && (!recipe.status || recipe.status === "ACTIVE")
      ));

    return [{
      targetId: variant.targetId,
      recipeId: latestActiveRecipe?.id
        || variant.timeline[variant.timeline.length - 1]?.id
        || "",
      reasons,
    }];
  });

  return {
    variants,
    cleanupRecommendations,
    errors,
  };
}

export function renderRecipeAuditMarkdown(
  report: RecipeHistoryAuditReport,
  generatedAt: string,
): string {
  const multipleActiveCount = report.variants.filter(
    variant => variant.activeRecipeCount > 1,
  ).length;
  const transitions = report.variants.flatMap(variant => variant.transitions);
  const trueDropCount = transitions.reduce(
    (sum, transition) => sum + transition.trueDrops.length,
    0,
  );
  const replacementCount = transitions.reduce(
    (sum, transition) => sum + transition.typeReplacements.length,
    0,
  );
  const quantityChangeCount = transitions.reduce(
    (sum, transition) => sum + transition.quantityChanges.length,
    0,
  );
  const ambiguousCount = transitions.reduce(
    (sum, transition) => sum + transition.ambiguousNames.length,
    0,
  );
  const lines = [
    "# Recipe History Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "**READ ONLY:** This audit does not modify recipe data.",
    "",
    "## Summary",
    "",
    `- Product variants with history: ${report.variants.length}`,
    `- MULTIPLE_ACTIVE: ${multipleActiveCount}`,
    `- TRUE_DROP: ${trueDropCount}`,
    `- TYPE_REPLACEMENT: ${replacementCount}`,
    `- QUANTITY_CHANGE: ${quantityChangeCount}`,
    `- Ambiguous name matches: ${ambiguousCount}`,
    `- Invalid recipe JSON: ${report.errors.length}`,
    `- Cleanup recommendations: ${report.cleanupRecommendations.length}`,
    "",
    "## Cleanup Recommendations",
    "",
  ];

  if (report.cleanupRecommendations.length === 0) {
    lines.push("No automatic cleanup recommendations.");
  } else {
    for (const recommendation of report.cleanupRecommendations) {
      const variant = report.variants.find(
        candidate => candidate.targetId === recommendation.targetId,
      );
      lines.push(
        `### ${variant?.productName || recommendation.targetId}`
        + `${variant?.sizeName ? ` / ${variant.sizeName}` : ""}`,
        "",
        `- Target: \`${recommendation.targetId}\``,
        `- Review recipe: \`${recommendation.recipeId}\``,
        `- Reasons: ${recommendation.reasons.join("; ")}`,
        "",
        "- Option A: keep the latest reviewed entry and close older open entries.",
        "- Option B: restore a reviewed historical entry as current and close or deactivate the corrupt newer entry.",
        "- Option C: perform manual review when intent remains ambiguous.",
        "",
      );
    }
  }

  lines.push("## Per-Variant Timeline", "");
  for (const variant of report.variants) {
    lines.push(
      `### ${variant.productName}${variant.sizeName ? ` / ${variant.sizeName}` : ""}`,
      "",
      `Target: \`${variant.targetId}\` | Open recipes: ${variant.activeRecipeCount}`,
      "",
      "| Recipe | Created | End | Ingredients |",
      "| --- | --- | --- | --- |",
    );
    for (const recipe of variant.timeline) {
      lines.push(`| ${[
        `\`${recipe.id}\``,
        recipe.created_at || "",
        recipe.end_date || "OPEN",
        formatIngredientList(recipe.ingredients_json),
      ].join(" | ")} |`);
    }
    lines.push("");

    for (const transition of variant.transitions) {
      const details = [
        ...transition.typeReplacements.map(replacement => (
          `TYPE_REPLACEMENT ${replacement.name}: `
          + `${replacement.fromIngredientId} -> ${replacement.toIngredientId}`
        )),
        ...transition.quantityChanges.map(change => (
          `QUANTITY_CHANGE ${change.name}: `
          + `${change.fromQuantity} -> ${change.toQuantity}`
        )),
        ...transition.trueDrops.map(drop => `TRUE_DROP ${drop.name}`),
        ...transition.additions.map(addition => `ADDED ${addition.name}`),
        ...transition.ambiguousNames.map(name => `AMBIGUOUS_NAME ${name}`),
      ];
      if (details.length === 0) continue;
      lines.push(
        `- \`${transition.fromRecipeId}\` -> \`${transition.toRecipeId}\`: `
        + details.join("; "),
      );
    }
    lines.push("");
  }

  if (report.errors.length > 0) {
    lines.push("## Errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function formatIngredientList(value: string | unknown[] | undefined): string {
  try {
    return parseIngredients(value)
      .map(ingredient => (
        `${ingredient.ingredient_id || "(missing id)"} `
        + `(${ingredient.ingredient_type || "BASE_INGREDIENT"}) `
        + `x ${Number(ingredient.quantity)}`
      ))
      .join("<br>");
  } catch {
    return "INVALID JSON";
  }
}

function compareRecipeChronologically(
  left: RecipeHistoryRow,
  right: RecipeHistoryRow,
): number {
  const timeDelta = (
    new Date(left.created_at || 0).getTime()
    - new Date(right.created_at || 0).getTime()
  );
  if (timeDelta !== 0) return timeDelta;
  return left.id.localeCompare(right.id);
}

function compareRecipeTransition(
  fromRecipe: RecipeHistoryRow,
  toRecipe: RecipeHistoryRow,
  namesById: Map<string, string>,
): RecipeHistoryTransition {
  const oldIngredients = parseIngredients(fromRecipe.ingredients_json);
  const newIngredients = parseIngredients(toRecipe.ingredients_json);
  const unmatchedOld = [...oldIngredients];
  const unmatchedNew = [...newIngredients];
  const quantityChanges: RecipeQuantityChange[] = [];

  for (let oldIndex = unmatchedOld.length - 1; oldIndex >= 0; oldIndex -= 1) {
    const oldIngredient = unmatchedOld[oldIndex];
    const newIndex = unmatchedNew.findIndex(newIngredient => (
      ingredientKey(newIngredient) === ingredientKey(oldIngredient)
    ));
    if (newIndex < 0) continue;
    const newIngredient = unmatchedNew[newIndex];
    const oldQuantity = Number(oldIngredient.quantity);
    const newQuantity = Number(newIngredient.quantity);
    if (oldQuantity !== newQuantity) {
      quantityChanges.push({
        name: namesById.get(oldIngredient.ingredient_id || "")
          || oldIngredient.ingredient_id
          || "",
        ingredientId: oldIngredient.ingredient_id || "",
        fromQuantity: oldQuantity,
        toQuantity: newQuantity,
      });
    }
    unmatchedOld.splice(oldIndex, 1);
    unmatchedNew.splice(newIndex, 1);
  }

  const oldByName = groupIngredientIndexesByName(unmatchedOld, namesById);
  const newByName = groupIngredientIndexesByName(unmatchedNew, namesById);
  const ambiguousNameKeys = new Set<string>();
  const ambiguousNames: string[] = [];
  for (const [normalizedName, oldIndexes] of oldByName) {
    const newIndexes = newByName.get(normalizedName) || [];
    if (newIndexes.length === 0) continue;
    if (oldIndexes.length === 1 && newIndexes.length === 1) continue;
    ambiguousNameKeys.add(normalizedName);
    const ingredient = unmatchedNew[newIndexes[0]] || unmatchedOld[oldIndexes[0]];
    ambiguousNames.push(ingredientName(ingredient, namesById));
  }
  removeIngredientsWithNames(unmatchedOld, ambiguousNameKeys, namesById);
  removeIngredientsWithNames(unmatchedNew, ambiguousNameKeys, namesById);

  const typeReplacements: RecipeTypeReplacement[] = [];
  for (let oldIndex = unmatchedOld.length - 1; oldIndex >= 0; oldIndex -= 1) {
    const oldIngredient = unmatchedOld[oldIndex];
    const oldName = namesById.get(oldIngredient.ingredient_id || "")
      || oldIngredient.ingredient_id
      || "";
    const normalizedOldName = normalizeIngredientName(oldName);
    const candidates = unmatchedNew
      .map((ingredient, index) => ({ ingredient, index }))
      .filter(({ ingredient }) => {
        const newName = namesById.get(ingredient.ingredient_id || "")
          || ingredient.ingredient_id
          || "";
        return normalizeIngredientName(newName) === normalizedOldName;
      });
    if (candidates.length !== 1) continue;

    const replacement = candidates[0];
    typeReplacements.push({
      name: namesById.get(replacement.ingredient.ingredient_id || "") || oldName,
      fromIngredientId: oldIngredient.ingredient_id || "",
      toIngredientId: replacement.ingredient.ingredient_id || "",
      fromIngredientType: oldIngredient.ingredient_type || "BASE_INGREDIENT",
      toIngredientType: replacement.ingredient.ingredient_type || "BASE_INGREDIENT",
    });
    const oldQuantity = Number(oldIngredient.quantity);
    const newQuantity = Number(replacement.ingredient.quantity);
    if (oldQuantity !== newQuantity) {
      quantityChanges.push({
        name: namesById.get(replacement.ingredient.ingredient_id || "") || oldName,
        ingredientId: replacement.ingredient.ingredient_id || "",
        fromQuantity: oldQuantity,
        toQuantity: newQuantity,
      });
    }
    unmatchedOld.splice(oldIndex, 1);
    unmatchedNew.splice(replacement.index, 1);
  }

  const trueDrops = unmatchedOld.map(ingredient => ({
    name: namesById.get(ingredient.ingredient_id || "")
      || ingredient.ingredient_id
      || "",
    ingredientId: ingredient.ingredient_id || "",
    ingredientType: ingredient.ingredient_type || "BASE_INGREDIENT",
  }));
  const additions = unmatchedNew.map(ingredient => ({
    name: namesById.get(ingredient.ingredient_id || "")
      || ingredient.ingredient_id
      || "",
    ingredientId: ingredient.ingredient_id || "",
    ingredientType: ingredient.ingredient_type || "BASE_INGREDIENT",
  }));

  return {
    fromRecipeId: fromRecipe.id,
    toRecipeId: toRecipe.id,
    typeReplacements,
    quantityChanges,
    trueDrops,
    additions,
    ambiguousNames,
  };
}

function parseIngredients(value: string | unknown[] | undefined): IngredientRow[] {
  const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
  if (!Array.isArray(parsed)) {
    throw new Error("Recipe ingredients must be an array");
  }
  return parsed as IngredientRow[];
}

function ingredientKey(ingredient: IngredientRow): string {
  return [
    ingredient.ingredient_type || "BASE_INGREDIENT",
    ingredient.ingredient_id || "",
  ].join(":");
}

function ingredientName(
  ingredient: IngredientRow,
  namesById: Map<string, string>,
): string {
  return namesById.get(ingredient.ingredient_id || "")
    || ingredient.ingredient_id
    || "";
}

function groupIngredientIndexesByName(
  ingredients: IngredientRow[],
  namesById: Map<string, string>,
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  ingredients.forEach((ingredient, index) => {
    const name = normalizeIngredientName(ingredientName(ingredient, namesById));
    const indexes = result.get(name) || [];
    indexes.push(index);
    result.set(name, indexes);
  });
  return result;
}

function removeIngredientsWithNames(
  ingredients: IngredientRow[],
  names: Set<string>,
  namesById: Map<string, string>,
): void {
  for (let index = ingredients.length - 1; index >= 0; index -= 1) {
    const name = normalizeIngredientName(
      ingredientName(ingredients[index], namesById),
    );
    if (names.has(name)) ingredients.splice(index, 1);
  }
}

function normalizeIngredientName(name: string): string {
  return name
    .normalize("NFC")
    .toLocaleLowerCase("vi-VN")
    .trim()
    .replace(/\s+/g, " ");
}
