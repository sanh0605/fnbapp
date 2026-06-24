"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBModifier, DBRecipe, DBBaseIngredient, DBSemiProduct, DBUnit } from "@/types/db";
import {
  findActiveRecipeIntegrity,
  normalizeModifierIngredients,
  parseModifierIngredients,
  validateModifierIngredients,
} from "@/lib/modifier-recipe";

const MODIFIER_SHEET = "Modifiers";
const RECIPE_SHEET = "Recipes";
const PATH = "/admin/products/modifiers";

export async function getModifiersData(): Promise<{
  modifiers: Array<DBModifier & { activeRecipe?: DBRecipe; recipeHistory: Array<any> }>;
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  units: DBUnit[];
}> {
  try {
    const [modifiers, recipes, baseIngredients, semiProducts, allUnits] = await Promise.all([
      findAll(MODIFIER_SHEET) as Promise<DBModifier[]>,
      findAll(RECIPE_SHEET) as Promise<DBRecipe[]>,
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll("Semi_Products") as Promise<DBSemiProduct[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);

    const activeModifiers = modifiers.filter(m => m.status !== "DELETED");
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    const activeBI = baseIngredients.filter(b => b.status !== "DELETED");
    const activeSP = semiProducts.filter(s => s.status !== "DELETED");

    const enriched = activeModifiers.map(m => {
      const modifierRecipes = recipes.filter(
        r => r.target_type === "MODIFIER" && r.target_id === m.id
      );

      const recipeIntegrity = findActiveRecipeIntegrity(modifierRecipes);
      const activeRecipe = recipeIntegrity.activeRecipe;

      const recipeHistory = modifierRecipes.map(r => {
        const ings = parseModifierIngredients(r.ingredients_json);
        return {
          ...r,
          ingredients: ings.map((ing: any) => {
            const bi = activeBI.find(b => b.id === ing.ingredient_id);
            const sp = activeSP.find(s => s.id === ing.ingredient_id);
            const source = bi || sp;
            const unitObj = units.find((u: any) => u.id === source?.base_unit);
            return {
              ...ing,
              name: source?.name || ing.ingredient_id,
              unit: unitObj?.name || "",
            };
          }),
        };
      }).sort((a: any, b: any) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );

      return {
        ...m,
        activeRecipe,
        recipeHistory,
        activeRecipeCount: recipeIntegrity.activeRecipeCount,
        hasMultipleActiveRecipes: recipeIntegrity.hasMultipleActiveRecipes,
      };
    });

    return { modifiers: enriched, baseIngredients: activeBI, semiProducts: activeSP, units };
  } catch (error) {
    console.error("Loi getModifiersData:", error);
    return { modifiers: [], baseIngredients: [], semiProducts: [], units: [] };
  }
}

export async function saveModifierAction(formData: FormData): Promise<ActionResponse> {
  const isEdit = formData.get("is_edit") === "true";
  const modifier_id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const group_name = formData.get("group_name") as string;
  const price = formData.get("price") as string;
  const ingredientsJson = formData.get("ingredients_json") as string;

  if (!name || !group_name) return fail("Vui lòng nhập đầy đủ thông tin");
  const ingredients = parseModifierIngredients(ingredientsJson);
  const validation = validateModifierIngredients(ingredients);
  if (!validation.ok) return fail(validation.error);
  const normalizedIngredientsJson = JSON.stringify(normalizeModifierIngredients(ingredients));

  try {
    let finalId = modifier_id;
    const nowIso = new Date().toISOString();

    if (isEdit && modifier_id) {
      await update(MODIFIER_SHEET, modifier_id, { name, group_name, price });
    } else {
      finalId = await generateNewId(MODIFIER_SHEET, "MOD");
      await insert(MODIFIER_SHEET, {
        id: finalId,
        group_name,
        name,
        price,
        status: "ACTIVE",
        created_at: nowIso,
      });
    }

    // Recipe versioning -- preserve exactly
    const allRecipes = await findAll(RECIPE_SHEET);
    const existingActive = allRecipes.find(
      (r: DBRecipe) =>
        r.target_type === "MODIFIER" &&
        r.target_id === finalId &&
        (!r.end_date || r.end_date === "")
    );

    if (existingActive) {
      if (existingActive.ingredients_json !== normalizedIngredientsJson) {
        // Close old recipe
        await update(RECIPE_SHEET, existingActive.id, { end_date: nowIso });
        // Create new version
        const recipeId = await generateNewId(RECIPE_SHEET, "RC");
        await insert(RECIPE_SHEET, {
          id: recipeId,
          target_type: "MODIFIER",
          target_id: finalId,
          ingredients_json: normalizedIngredientsJson,
          status: "ACTIVE",
          start_date: nowIso,
          end_date: "",
          created_at: nowIso,
        });
      }
      // else: no change, no-op
    } else {
      // No active recipe, create one
      const recipeId = await generateNewId(RECIPE_SHEET, "RC");
      await insert(RECIPE_SHEET, {
        id: recipeId,
        target_type: "MODIFIER",
        target_id: finalId,
        ingredients_json: normalizedIngredientsJson,
        status: "ACTIVE",
        start_date: nowIso,
        end_date: "",
        created_at: nowIso,
      });
    }

    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteModifierAction(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  try {
    // Soft delete modifier
    await update(MODIFIER_SHEET, id, { status: "DELETED" });

    // Also close the active recipe (fixes current bug where recipe is left open)
    const allRecipes = await findAll(RECIPE_SHEET);
    const activeRecipe = allRecipes.find(
      (r: DBRecipe) =>
        r.target_type === "MODIFIER" &&
        r.target_id === id &&
        (!r.end_date || r.end_date === "")
    );
    if (activeRecipe) {
      await update(RECIPE_SHEET, activeRecipe.id, { end_date: new Date().toISOString() });
    }

    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
