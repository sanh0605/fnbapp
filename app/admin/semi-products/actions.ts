"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit } from "@/types/db";

const SP_SHEET = "Semi_Products";
const RECIPE_SHEET = "Recipes";
const PATH = "/admin/semi-products";

export async function getSemiProductsData(): Promise<{
  semiProducts: Array<DBSemiProduct & { activeRecipe?: DBRecipe; recipeHistory: any[] }>;
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}> {
  try {
    const [semiProducts, recipes, baseIngredients, allUnits] = await Promise.all([
      findAll(SP_SHEET) as Promise<DBSemiProduct[]>,
      findAll(RECIPE_SHEET) as Promise<DBRecipe[]>,
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const activeSP = semiProducts.filter(sp => sp.status !== "DELETED");
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

    const enriched = activeSP.map(sp => {
      const spRecipes = recipes.filter(r => r.target_type === "SEMI_PRODUCT" && r.target_id === sp.id);
      const activeRecipe = spRecipes.find(r => !r.end_date || r.end_date === "");
      const recipeHistory = spRecipes.map(r => {
        let ings: any[] = [];
        try { ings = JSON.parse(r.ingredients_json || "[]"); } catch {}
        return {
          ...r,
          ingredients: ings.map((ing: any) => {
            const bi = baseIngredients.find(b => b.id === ing.ingredient_id);
            const otherSP = activeSP.find(s => s.id === ing.ingredient_id);
            const source = bi || otherSP;
            const unitObj = units.find((u: any) => u.id === source?.base_unit);
            return { ...ing, name: source?.name || ing.ingredient_id, unit: unitObj?.name || "" };
          }),
        };
      }).sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""));
      return { ...sp, activeRecipe, recipeHistory };
    });

    return { semiProducts: enriched, baseIngredients, units };
  } catch (error) {
    console.error("Loi getSemiProductsData:", error);
    return { semiProducts: [], baseIngredients: [], units: [] };
  }
}

export async function saveSemiProduct(formData: FormData): Promise<ActionResponse> {
  const isEdit = formData.get("is_edit") === "true";
  const name = formData.get("name") as string;
  const base_unit = formData.get("base_unit") as string;
  const batch_yield = formData.get("batch_yield") as string;
  const status = formData.get("status") as string || "ACTIVE";
  const ingredientsJson = formData.get("ingredients_json") as string;
  const effectiveDateStr = formData.get("effective_date") as string;

  if (!name || !base_unit || !batch_yield || !ingredientsJson) {
    return fail("Vui lòng nhập đầy đủ thông tin");
  }

  try {
    let semi_product_id = formData.get("id") as string;

    if (isEdit) {
      await update("Semi_Products", semi_product_id, {
        name,
        base_unit,
        batch_yield,
        status,
      });
    } else {
      semi_product_id = await generateNewId("Semi_Products", "BTP");
      await insert("Semi_Products", {
        id: semi_product_id,
        name,
        base_unit,
        batch_yield,
        status,
        created_at: new Date().toISOString()
      });
    }

    // Xử lý Recipe
    const allRecipes = await findAll("Recipes");
    const existingActiveRecipe = allRecipes.find((r: any) => 
      r.target_type === "SEMI_PRODUCT" && 
      r.target_id === semi_product_id &&
      (!r.end_date || r.end_date === "")
    );

    // Xử lý ngày áp dụng
    let nowIso = new Date().toISOString();
    if (effectiveDateStr) {
      nowIso = new Date(effectiveDateStr).toISOString();
    }

    if (existingActiveRecipe) {
      // Chỉ tạo version mới nếu công thức thực sự thay đổi
      if (existingActiveRecipe.ingredients_json !== ingredientsJson) {
        // Đóng công thức cũ
        await update("Recipes", existingActiveRecipe.id, {
          end_date: nowIso
        });

        // Tạo công thức mới
        const recipe_id = await generateNewId("Recipes", "RC");
        await insert("Recipes", {
          id: recipe_id,
          target_type: "SEMI_PRODUCT",
          target_id: semi_product_id,
          ingredients_json: ingredientsJson,
          created_at: nowIso,
          end_date: ""
        });
      }
    } else {
      // Tạo công thức đầu tiên
      const recipe_id = await generateNewId("Recipes", "RC");
      await insert("Recipes", {
        id: recipe_id,
        target_type: "SEMI_PRODUCT",
        target_id: semi_product_id,
        ingredients_json: ingredientsJson,
        created_at: nowIso,
        end_date: ""
      });
    }

    revalidatePath("/admin/semi-products");
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteSemiProductAction(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  try {
    await update("Semi_Products", id, { status: "DELETED" });
    revalidatePath("/admin/inventory/semi-products");
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
