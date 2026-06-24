import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type Issue = {
  severity: "error" | "warn";
  recipeId?: string;
  modifierId?: string;
  message: string;
};

function isActive(row: any): boolean {
  return row.status !== "DELETED" && (!row.end_date || row.end_date === "");
}

function parseIngredients(raw: string): { ok: true; items: any[] } | { ok: false; error: string } {
  if (!raw) return { ok: true, items: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: "ingredients_json is not an array" };
    }
    return { ok: true, items: parsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function sourceLabel(type: string, id: string): string {
  return `${type || "BASE_INGREDIENT"}:${id || "(blank)"}`;
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [modifiers, recipes, baseIngredients, semiProducts] = await Promise.all([
    findAllNoCache("Modifiers"),
    findAllNoCache("Recipes"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
  ]);

  const modifierById = new Map(modifiers.map((m: any) => [m.id, m]));
  const baseById = new Map(baseIngredients.map((item: any) => [item.id, item]));
  const semiById = new Map(semiProducts.map((item: any) => [item.id, item]));
  const modifierRecipes = recipes.filter((recipe: any) => recipe.target_type === "MODIFIER");
  const issues: Issue[] = [];

  const activeRecipeIdsByModifier = new Map<string, string[]>();
  for (const recipe of modifierRecipes) {
    if (!isActive(recipe)) continue;
    const ids = activeRecipeIdsByModifier.get(recipe.target_id) || [];
    ids.push(recipe.id);
    activeRecipeIdsByModifier.set(recipe.target_id, ids);
  }

  for (const [modifierId, ids] of activeRecipeIdsByModifier.entries()) {
    if (ids.length > 1) {
      issues.push({
        severity: "error",
        modifierId,
        message: `multiple active recipes: ${ids.join(", ")}`,
      });
    }
  }

  for (const recipe of modifierRecipes) {
    const modifier = modifierById.get(recipe.target_id);
    if (!modifier) {
      issues.push({
        severity: "error",
        recipeId: recipe.id,
        modifierId: recipe.target_id,
        message: "recipe target modifier does not exist",
      });
    } else if ((modifier as any).status === "DELETED" && isActive(recipe)) {
      issues.push({
        severity: "warn",
        recipeId: recipe.id,
        modifierId: recipe.target_id,
        message: "deleted modifier still has an active recipe",
      });
    }

    const parsed = parseIngredients(recipe.ingredients_json);
    if (!parsed.ok) {
      issues.push({
        severity: "error",
        recipeId: recipe.id,
        modifierId: recipe.target_id,
        message: `invalid ingredients_json: ${parsed.error}`,
      });
      continue;
    }

    const seen = new Set<string>();
    parsed.items.forEach((ingredient, index) => {
      const ingredientType = ingredient.ingredient_type || "BASE_INGREDIENT";
      const ingredientId = ingredient.ingredient_id || "";
      const quantity = Number(ingredient.quantity);
      const key = sourceLabel(ingredientType, ingredientId);

      if (!ingredientId) {
        issues.push({
          severity: "error",
          recipeId: recipe.id,
          modifierId: recipe.target_id,
          message: `line ${index + 1}: blank ingredient_id`,
        });
      }

      if (seen.has(key)) {
        issues.push({
          severity: "error",
          recipeId: recipe.id,
          modifierId: recipe.target_id,
          message: `line ${index + 1}: duplicate ingredient ${key}`,
        });
      }
      seen.add(key);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        issues.push({
          severity: "error",
          recipeId: recipe.id,
          modifierId: recipe.target_id,
          message: `line ${index + 1}: quantity must be greater than 0, got ${JSON.stringify(ingredient.quantity)}`,
        });
      }

      if (typeof ingredient.quantity === "string" && /^0+\d/.test(ingredient.quantity) && !ingredient.quantity.startsWith("0.")) {
        issues.push({
          severity: "warn",
          recipeId: recipe.id,
          modifierId: recipe.target_id,
          message: `line ${index + 1}: quantity has leading zero, got ${JSON.stringify(ingredient.quantity)}`,
        });
      }

      const source =
        ingredientType === "BASE_INGREDIENT"
          ? baseById.get(ingredientId)
          : ingredientType === "SEMI_PRODUCT"
            ? semiById.get(ingredientId)
            : null;

      if (ingredientType !== "BASE_INGREDIENT" && ingredientType !== "SEMI_PRODUCT") {
        issues.push({
          severity: "error",
          recipeId: recipe.id,
          modifierId: recipe.target_id,
          message: `line ${index + 1}: invalid ingredient_type ${JSON.stringify(ingredientType)}`,
        });
      } else if (!source) {
        issues.push({
          severity: "error",
          recipeId: recipe.id,
          modifierId: recipe.target_id,
          message: `line ${index + 1}: source not found ${key}`,
        });
      } else if ((source as any).status === "DELETED" && isActive(recipe)) {
        issues.push({
          severity: "warn",
          recipeId: recipe.id,
          modifierId: recipe.target_id,
          message: `line ${index + 1}: active recipe uses deleted source ${key}`,
        });
      }
    });
  }

  const errorCount = issues.filter(issue => issue.severity === "error").length;
  const warnCount = issues.filter(issue => issue.severity === "warn").length;

  console.log("=== Modifier recipe audit ===");
  console.log(`Modifiers: ${modifiers.length}`);
  console.log(`Modifier recipes: ${modifierRecipes.length}`);
  console.log(`Active modifier recipes: ${Array.from(activeRecipeIdsByModifier.values()).reduce((sum, ids) => sum + ids.length, 0)}`);
  console.log(`Issues: ${errorCount} error(s), ${warnCount} warning(s)`);

  for (const issue of issues) {
    const location = [
      issue.modifierId ? `modifier=${issue.modifierId}` : "",
      issue.recipeId ? `recipe=${issue.recipeId}` : "",
    ].filter(Boolean).join(" ");
    console.log(`[${issue.severity.toUpperCase()}] ${location} ${issue.message}`);
  }

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
