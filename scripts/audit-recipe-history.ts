import * as dotenv from "dotenv";
import { writeFileSync } from "node:fs";
import {
  auditRecipeHistory,
  renderRecipeAuditMarkdown,
  type RecipeHistoryTransition,
} from "../lib/recipe-history-audit";
import { planRecipeSave } from "../lib/recipe-selection";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const OUTPUT_PATH = "docs/audits/2026-07-04-recipe-audit.md";

async function main(): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [
    recipes,
    variants,
    products,
    baseIngredients,
    semiProducts,
  ] = await Promise.all([
    findAllNoCache("Recipes"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Products"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
  ]);

  const report = auditRecipeHistory({
    recipes: recipes as any[],
    variants: variants as any[],
    products: products as any[],
    baseIngredients: baseIngredients as any[],
    semiProducts: semiProducts as any[],
  });
  const generatedAt = new Date().toISOString();
  writeFileSync(
    OUTPUT_PATH,
    renderRecipeAuditMarkdown(report, generatedAt),
    "utf8",
  );

  const transitions = report.variants.flatMap(variant => variant.transitions);
  console.log("=== RECIPE HISTORY AUDIT (READ ONLY) ===");
  console.log(`Variants with history: ${report.variants.length}`);
  console.log(`Multiple active:       ${report.variants.filter(variant => variant.activeRecipeCount > 1).length}`);
  console.log(`True drops:            ${count(transitions, "trueDrops")}`);
  console.log(`Type replacements:     ${count(transitions, "typeReplacements")}`);
  console.log(`Quantity changes:      ${count(transitions, "quantityChanges")}`);
  console.log(`Ambiguous names:       ${count(transitions, "ambiguousNames")}`);
  console.log(`Invalid JSON:          ${report.errors.length}`);
  console.log(`Cleanup candidates:    ${report.cleanupRecommendations.length}`);
  console.log(`Report:                ${OUTPUT_PATH}`);

  const probeVariant = report.variants.find(variant => (
    variant.timeline.some(recipe => !recipe.end_date)
  ));
  const probeRecipe = probeVariant?.timeline.findLast(recipe => !recipe.end_date);
  if (!probeVariant || !probeRecipe) {
    throw new Error("Recipe save probe requires an open product-variant recipe");
  }
  const probeIngredients = parseIngredientArray(probeRecipe.ingredients_json);
  if (probeIngredients.length === 0) {
    throw new Error(`Recipe save probe ${probeRecipe.id} has no ingredients`);
  }
  const changedIngredients = probeIngredients.map((ingredient, index) => (
    index === 0
      ? { ...ingredient, quantity: Number(ingredient.quantity) + 1 }
      : ingredient
  ));
  const samePlan = planRecipeSave(
    recipes as any[],
    "PRODUCT_VARIANT",
    probeVariant.targetId,
    probeIngredients,
  );
  const changedPlan = planRecipeSave(
    recipes as any[],
    "PRODUCT_VARIANT",
    probeVariant.targetId,
    changedIngredients,
  );
  if (samePlan.newRecipeCount !== 0 || changedPlan.newRecipeCount !== 1) {
    throw new Error(
      `Recipe save probe failed: same=${samePlan.newRecipeCount}, `
      + `changed=${changedPlan.newRecipeCount}`,
    );
  }
  console.log(
    `Save decision probe:    same=${samePlan.newRecipeCount}, `
    + `changed=${changedPlan.newRecipeCount} (${probeVariant.targetId})`,
  );

  if (report.cleanupRecommendations.length > 0) {
    console.log("\nCleanup candidates");
    for (const recommendation of report.cleanupRecommendations) {
      const variant = report.variants.find(
        candidate => candidate.targetId === recommendation.targetId,
      );
      console.log([
        `${variant?.productName || recommendation.targetId}`
          + `${variant?.sizeName ? ` / ${variant.sizeName}` : ""}`,
        `target=${recommendation.targetId}`,
        `recipe=${recommendation.recipeId}`,
        recommendation.reasons.join("; "),
      ].join(" | "));
    }
  }

  console.log("\nNo recipe data was written.");
}

function count(
  transitions: RecipeHistoryTransition[],
  field: "trueDrops" | "typeReplacements" | "quantityChanges" | "ambiguousNames",
): number {
  return transitions.reduce(
    (sum, transition) => sum + transition[field].length,
    0,
  );
}

function parseIngredientArray(value: string | unknown[] | undefined): any[] {
  const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
  if (!Array.isArray(parsed)) {
    throw new Error("Recipe save probe ingredients must be an array");
  }
  return parsed;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
