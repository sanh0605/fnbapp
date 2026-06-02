"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export async function saveSemiProduct(formData: FormData) {
  const isEdit = formData.get("is_edit") === "true";
  const name = formData.get("name") as string;
  const base_unit = formData.get("base_unit") as string;
  const batch_yield = formData.get("batch_yield") as string;
  const status = formData.get("status") as string || "ACTIVE";
  const ingredientsJson = formData.get("ingredients_json") as string;
  const effectiveDateStr = formData.get("effective_date") as string;

  if (!name || !base_unit || !batch_yield || !ingredientsJson) {
    return { error: "Vui lòng nhập đầy đủ thông tin" };
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
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteSemiProduct(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await update("Semi_Products", id, { status: "DELETED" });
    revalidatePath("/admin/inventory/semi-products");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
