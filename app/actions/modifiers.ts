"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export async function saveModifier(formData: FormData) {
  const isEdit = formData.get("is_edit") === "true";
  const name = formData.get("name") as string;
  const group_name = formData.get("group_name") as string;
  const price = formData.get("price") as string;
  const ingredientsJson = formData.get("ingredients_json") as string;

  if (!name || !group_name) {
    return { error: "Vui lòng nhập đầy đủ thông tin" };
  }

  try {
    let modifier_id = formData.get("id") as string;
    const nowIso = new Date().toISOString();

    if (isEdit) {
      await update("Modifiers", modifier_id, {
        name,
        group_name,
        price
      });
    } else {
      modifier_id = await generateNewId("Modifiers", "MOD");
      await insert("Modifiers", {
        id: modifier_id,
        group_name,
        name,
        price,
        status: "ACTIVE",
        created_at: nowIso
      });
    }

    // Xử lý Lịch sử Công thức
    const allRecipes = await findAll("Recipes");
    const existingActiveRecipe = allRecipes.find((r: any) => 
      r.target_type === "MODIFIER" && 
      r.target_id === modifier_id &&
      (!r.end_date || r.end_date === "")
    );

    if (existingActiveRecipe) {
      if (existingActiveRecipe.ingredients_json !== ingredientsJson) {
        await update("Recipes", existingActiveRecipe.id, {
          end_date: nowIso
        });

        const recipe_id = await generateNewId("Recipes", "RC");
        await insert("Recipes", {
          id: recipe_id,
          target_type: "MODIFIER",
          target_id: modifier_id,
          ingredients_json: ingredientsJson,
          created_at: nowIso,
          end_date: ""
        });
      }
    } else {
      const recipe_id = await generateNewId("Recipes", "RC");
      await insert("Recipes", {
        id: recipe_id,
        target_type: "MODIFIER",
        target_id: modifier_id,
        ingredients_json: ingredientsJson,
        created_at: nowIso,
        end_date: ""
      });
    }

    revalidatePath("/admin/products/modifiers");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteModifier(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await update("Modifiers", id, { status: "DELETED" });
    revalidatePath("/admin/products/modifiers");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
