"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

// --- PRODUCT CATEGORIES ---
export async function saveProductCategory(formData: FormData) {
  const name = formData.get("name") as string;
  if (!name) return { error: "Vui lòng nhập tên danh mục" };

  try {
    const id = await generateNewId("Product_Categories", "CAT");
    await insert("Product_Categories", {
      id,
      name,
      status: "ACTIVE",
      created_at: new Date().toISOString()
    });
    revalidatePath("/admin/products/categories");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateProductCategory(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  if (!id || !name) return { error: "Dữ liệu không hợp lệ" };

  try {
    await update("Product_Categories", id, { name });
    revalidatePath("/admin/products/categories");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteProductCategory(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await update("Product_Categories", id, { status: "DELETED" });
    revalidatePath("/admin/products/categories");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// --- PRODUCTS & VARIANTS & RECIPES (The Product Builder) ---
export async function saveProduct(formData: FormData) {
  const id = formData.get("id") as string;
  const category_id = formData.get("category_id") as string;
  const name = formData.get("name") as string;
  const imageUrl = formData.get("image_url") as string || "";
  const variantsJson = formData.get("variants_json") as string;
  const effectiveDateStr = formData.get("effective_date") as string;
  
  if (!name || !category_id || !variantsJson) return { error: "Thiếu thông tin bắt buộc" };

  try {
    const isEdit = !!id;
    const productId = isEdit ? id : await generateNewId("Products", "PROD");

    // 1. Lưu/Cập nhật Món chính
    if (isEdit) {
      await update("Products", productId, { category_id, name, image_url: imageUrl });
    } else {
      await insert("Products", {
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
    const existingVariants = isEdit ? (await findAll("Product_Variants")).filter((v:any) => v.product_id === productId && v.status !== "DELETED") : [];
    const allRecipes = await findAll("Recipes");
    const allPriceHistory = await findAll("Product_Price_History");
    
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

        await update("Product_Variants", variantId, {
          size_name: v.size_name,
          price: v.price
        });
        keepVariantIds.push(variantId);
      } else {
        variantId = await generateNewId("Product_Variants", "VAR");
        await insert("Product_Variants", {
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
        // Tìm history đang active của variant này
        const activePriceHistory = allPriceHistory.find((h:any) => 
          h.variant_id === variantId && (!h.end_date || h.end_date === "")
        );
        
        if (activePriceHistory) {
          // Đóng history cũ
          await update("Product_Price_History", activePriceHistory.id, {
            end_date: nowIso
          });
        }
        
        // Tạo history mới
        const phId = await generateNewId("Product_Price_History", "PPH");
        await insert("Product_Price_History", {
          id: phId,
          variant_id: variantId,
          price: v.price,
          created_at: nowIso,
          end_date: ""
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
          await update("Recipes", activeRecipe.id, {
            end_date: nowIso
          });
          
          // Tạo công thức mới
          const recipeId = await generateNewId("Recipes", "REC");
          await insert("Recipes", {
            id: recipeId,
            target_type: "PRODUCT_VARIANT",
            target_id: variantId,
            ingredients_json: ingredientsJsonString,
            created_at: nowIso,
            end_date: ""
          });
        }
      } else {
        // Tạo công thức lần đầu
        const recipeId = await generateNewId("Recipes", "REC");
        await insert("Recipes", {
          id: recipeId,
          target_type: "PRODUCT_VARIANT",
          target_id: variantId,
          ingredients_json: ingredientsJsonString,
          created_at: nowIso,
          end_date: ""
        });
      }
    }

    // 3. Xoá mềm (DELETED) các Variant bị user remove khỏi danh sách
    if (isEdit) {
      for (const ev of existingVariants) {
        if (!keepVariantIds.includes(ev.id)) {
          await update("Product_Variants", ev.id, { status: "DELETED" });
        }
      }
    }

    revalidatePath("/admin/products");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteProduct(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await update("Products", id, { status: "DELETED" });
    
    // Cập nhật các variants thành DELETED luôn
    const variants = await findAll("Product_Variants");
    for (const v of variants) {
      if (v.product_id === id) {
        await update("Product_Variants", v.id, { status: "DELETED" });
      }
    }
    
    revalidatePath("/admin/products");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
