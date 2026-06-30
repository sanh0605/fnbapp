"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";

const PRODUCT_SHEET = "Products";
const VARIANT_SHEET = "Product_Variants";
const PRICE_HISTORY_SHEET = "Product_Price_History";
const RECIPE_SHEET = "Recipes";
const PATH = "/admin/products";

export async function saveProduct(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const category_id = formData.get("category_id") as string;
  const name = formData.get("name") as string;
  const imageUrl = formData.get("image_url") as string || "";
  const variantsJson = formData.get("variants_json") as string;
  const effectiveDateStr = formData.get("effective_date") as string;
  
  if (!name || !category_id || !variantsJson) return fail("Thiếu thông tin bắt buộc");

  try {
    const isEdit = !!id;
    const productId = isEdit ? id : await generateNewId(PRODUCT_SHEET, "PROD");

    // 1. Lưu/Cập nhật Món chính
    if (isEdit) {
      await update(PRODUCT_SHEET, productId, { category_id, name, image_url: imageUrl });
    } else {
      await insert(PRODUCT_SHEET, {
        id: productId,
        category_id,
        name,
        image_url: imageUrl,
        status: "ACTIVE",
        created_at: new Date().toISOString()
      });
    }

    // 2. Xử lý Variants & Recipes
    const variants = JSON.parse(variantsJson);
    const existingVariants = isEdit ? (await findAll(VARIANT_SHEET)).filter((v:any) => v.product_id === productId && v.status !== "DELETED") : [];
    const allRecipes = await findAll(RECIPE_SHEET);
    const allPriceHistory = await findAll(PRICE_HISTORY_SHEET);
    
    const keepVariantIds: string[] = [];
    
    // Xử lý ngày áp dụng
    let nowIso = new Date().toISOString();
    if (effectiveDateStr) {
      nowIso = new Date(effectiveDateStr).toISOString();
    }

    for (const v of variants) {
      let variantId = v.id;
      let priceChanged = false;
      let oldPrice = 0;
      
      // Tạo mới hoặc Cập nhật Variant
      if (variantId) {
        const ev = existingVariants.find((e:any) => e.id === variantId);
        if (ev && Number(ev.price) !== Number(v.price)) {
          priceChanged = true;
          oldPrice = Number(v.price); // Ghi nhận giá mới
        }

        await update(VARIANT_SHEET, variantId, {
          size_name: v.size_name,
          price: v.price
        });
        keepVariantIds.push(variantId);
      } else {
        variantId = await generateNewId(VARIANT_SHEET, "VAR");
        await insert(VARIANT_SHEET, {
          id: variantId,
          product_id: productId,
          size_name: v.size_name,
          price: v.price,
          status: "ACTIVE",
          created_at: nowIso
        });
        keepVariantIds.push(variantId);
        priceChanged = true; // Luôn coi như thay đổi giá khi tạo mới
      }

      // -- XỬ LÝ LỊCH SỬ GIÁ BÁN --
      if (priceChanged) {
        const phId = await generateNewId(PRICE_HISTORY_SHEET, "PPH");
        
        // Lấy giá cũ nếu có (bản ghi gần nhất)
        const sortedHistory = allPriceHistory
          .filter((h: any) => h.variant_id === variantId)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        const oldPrice = sortedHistory.length > 0 ? sortedHistory[0].new_price : null;

        await insert(PRICE_HISTORY_SHEET, {
          id: phId,
          variant_id: variantId,
          old_price: oldPrice,
          new_price: v.price,
          effective_at: nowIso,
          created_at: nowIso
        });
      }

      // -- XỬ LÝ LỊCH SỬ CÔNG THỨC --
      const activeRecipe = allRecipes.find((r:any) => 
        r.target_type === "PRODUCT_VARIANT" && 
        r.target_id === variantId &&
        (!r.end_date || r.end_date === "")
      );
      
      const ingredientsJsonString = JSON.stringify(v.ingredients || []);
      
      if (activeRecipe) {
        if (activeRecipe.ingredients_json !== ingredientsJsonString) {
          // Đóng công thức cũ
          await update(RECIPE_SHEET, activeRecipe.id, {
            end_date: nowIso
          });
          
          // Tạo công thức mới
          const recipeId = await generateNewId(RECIPE_SHEET, "REC");
          await insert(RECIPE_SHEET, {
            id: recipeId,
            target_type: "PRODUCT_VARIANT",
            target_id: variantId,
            ingredients_json: ingredientsJsonString,
            created_at: nowIso,
            end_date: null
          });
        }
      } else {
        // Tạo công thức lần đầu
        const recipeId = await generateNewId(RECIPE_SHEET, "REC");
        await insert(RECIPE_SHEET, {
          id: recipeId,
          target_type: "PRODUCT_VARIANT",
          target_id: variantId,
          ingredients_json: ingredientsJsonString,
          created_at: nowIso,
          end_date: null
        });
      }
    }

    // 3. Xoá mềm (DELETED) các Variant bị user remove khỏi danh sách
    if (isEdit) {
      for (const ev of existingVariants) {
        if (!keepVariantIds.includes(ev.id)) {
          await update(VARIANT_SHEET, ev.id, { status: "DELETED" });
        }
      }
    }

    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteProduct(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");
  try {
    await update(PRODUCT_SHEET, id, { status: "DELETED" });
    
    // Cập nhật các variants thành DELETED luôn
    const variants = await findAll(VARIANT_SHEET);
    for (const v of variants) {
      if (v.product_id === id) {
        await update(VARIANT_SHEET, v.id, { status: "DELETED" });
      }
    }
    
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
