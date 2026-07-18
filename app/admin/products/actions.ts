"use server";

import { requireAdmin } from "@/lib/auth";
import { saveProductAtomic } from "@/lib/product-save-transaction";
import { planRecipeSave } from "@/lib/recipe-selection";
import { fail, ok, type ActionResponse } from "@/lib/shared-actions";
import { findAll, update } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

const PRODUCT_SHEET = "Products";
const VARIANT_SHEET = "Product_Variants";
const RECIPE_SHEET = "Recipes";
const PATH = "/admin/products";

type VariantFormInput = {
  id?: unknown;
  size_name?: unknown;
  price?: unknown;
  ingredients?: unknown;
};

export async function saveProduct(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") || "");
  const categoryId = String(formData.get("category_id") || "");
  const name = String(formData.get("name") || "");
  const imageUrl = String(formData.get("image_url") || "");
  const variantsJson = String(formData.get("variants_json") || "");
  const effectiveDate = String(formData.get("effective_date") || "");
  if (!name || !categoryId || !variantsJson) {
    return fail("Thiếu thông tin bắt buộc");
  }

  try {
    const parsedVariants: unknown = JSON.parse(variantsJson);
    if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
      return fail("Sản phẩm phải có ít nhất một biến thể");
    }
    const variants = parsedVariants as VariantFormInput[];
    const isEdit = Boolean(id);
    const [allVariants, allRecipes] = await Promise.all([
      isEdit ? findAll(VARIANT_SHEET) : Promise.resolve([]),
      findAll(RECIPE_SHEET),
    ]);
    const existingVariants = allVariants.filter((variant: Record<string, unknown>) =>
      variant.product_id === id && variant.status !== "DELETED"
    );
    const effectiveAt = effectiveDate
      ? new Date(effectiveDate).toISOString()
      : new Date().toISOString();

    let expectedPriceHistoryCount = 0;
    let expectedRecipeCount = 0;
    const keepVariantIds: string[] = [];
    const variantPlans = variants.map((variant, index) => {
      const variantId = typeof variant.id === "string" && variant.id
        ? variant.id
        : null;
      const existing = variantId
        ? existingVariants.find((row: Record<string, unknown>) => row.id === variantId)
        : null;
      if (variantId && !existing) {
        throw new Error(`Không tìm thấy biến thể ${variantId} của sản phẩm`);
      }
      if (variantId) keepVariantIds.push(variantId);

      const sizeName = String(variant.size_name || "");
      const price = Number(variant.price);
      if (!sizeName || !Number.isFinite(price) || price < 0) {
        throw new Error("Dữ liệu biến thể không hợp lệ");
      }
      const ingredients = Array.isArray(variant.ingredients)
        ? variant.ingredients
        : [];
      const recipeTargetId = variantId || `__NEW_VARIANT_${index}`;
      const recipePlan = planRecipeSave(
        allRecipes,
        "PRODUCT_VARIANT",
        recipeTargetId,
        ingredients,
      );
      if (recipePlan.decision !== "UNCHANGED") expectedRecipeCount += 1;
      if (!existing || Number(existing.price) !== price) {
        expectedPriceHistoryCount += 1;
      }

      return {
        id: variantId,
        size_name: sizeName,
        price,
        recipe_decision: recipePlan.decision,
        active_recipe_id: recipePlan.activeRecipe?.id || null,
        ingredients_json: ingredients,
      };
    });
    const removedVariantIds = isEdit
      ? existingVariants
        .filter((variant: Record<string, unknown>) =>
          !keepVariantIds.includes(String(variant.id || ""))
        )
        .map((variant: Record<string, unknown>) => String(variant.id))
      : [];

    await saveProductAtomic({
      isEdit,
      product: {
        ...(isEdit ? { id } : {}),
        category_id: categoryId,
        name,
        image_url: imageUrl,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
      },
      variants: variantPlans,
      removedVariantIds,
      effectiveAt,
      expectedPriceHistoryCount,
      expectedRecipeCount,
    });

    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "Unknown error");
  }
}

export async function deleteProduct(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") || "");
  if (!id) return fail("ID không hợp lệ");
  try {
    await update(PRODUCT_SHEET, id, { status: "DELETED" });
    const variants = await findAll(VARIANT_SHEET);
    for (const variant of variants) {
      if (variant.product_id === id) {
        await update(VARIANT_SHEET, variant.id, { status: "DELETED" });
      }
    }
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "Unknown error");
  }
}
