import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function normalizeQuantity(value: unknown): number | unknown {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) return value;
  return quantity;
}

function normalizeIngredientsJson(raw: string): string | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;

  const normalized = parsed.map((ingredient: any) => ({
    ...ingredient,
    ingredient_type: ingredient.ingredient_type || "BASE_INGREDIENT",
    quantity: normalizeQuantity(ingredient.quantity),
  }));

  const normalizedJson = JSON.stringify(normalized);
  return normalizedJson === raw ? null : normalizedJson;
}

async function main() {
  const { findAllNoCache, update } = await import("../lib/sheets_db");
  const recipes = await findAllNoCache("Recipes");
  const modifierRecipes = recipes.filter((recipe: any) => recipe.target_type === "MODIFIER");

  const updates: Array<{ id: string; ingredients_json: string }> = [];
  for (const recipe of modifierRecipes) {
    const normalizedJson = normalizeIngredientsJson(recipe.ingredients_json);
    if (normalizedJson) {
      updates.push({ id: recipe.id, ingredients_json: normalizedJson });
    }
  }

  console.log("=== Apply modifier recipe normalization ===");
  console.log(`Changed recipes: ${updates.length}`);

  for (const item of updates) {
    await update("Recipes", item.id, { ingredients_json: item.ingredients_json });
    console.log(`Updated ${item.id}: ${item.ingredients_json}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
