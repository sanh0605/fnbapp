"use server";

import { requireAdmin } from "@/lib/auth";
import { saveProductAtomic } from "@/lib/product-save-transaction";
import { eraseProductAtomic } from "@/lib/product-erase-transaction";
import { planRecipeSave, findLatestActiveRecipe } from "@/lib/recipe-selection";
import { fail, ok, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import { findAll, update } from "@/lib/sheets_db";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  findDuplicateActiveName,
  duplicateNameErrorMessage,
  findDiacriticStrippedMatch,
  duplicateWarningMessage,
} from "@/lib/duplicate-name-guard";

const PRODUCT_SHEET = "Products";
const VARIANT_SHEET = "Product_Variants";
const RECIPE_SHEET = "Recipes";
const PATH = "/admin/products";

type VariantFormInput = {
  id?: unknown;
  size_name?: unknown;
  price?: unknown;
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
  const warningConfirmed = formData.get("duplicate_warning_confirmed") === "true";
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
    const [allVariants, allRecipes, allProducts] = await Promise.all([
      isEdit ? findAll(VARIANT_SHEET) : Promise.resolve([]),
      findAll(RECIPE_SHEET),
      findAll(PRODUCT_SHEET),
    ]);

    const duplicateName = findDuplicateActiveName(allProducts as any[], name, isEdit ? id : undefined);
    if (duplicateName) return fail(duplicateNameErrorMessage(duplicateName));

    const warning = findDiacriticStrippedMatch(allProducts as any[], name, isEdit ? id : undefined);
    if (warning && !warningConfirmed) {
      return {
        needsDuplicateWarning: {
          conflictId: warning.conflict.id,
          conflictName: warning.conflict.name,
          message: duplicateWarningMessage(warning.conflict),
        },
      };
    }
    const wasWarningConfirmed = !!warning && warningConfirmed;

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
      // The product editor no longer offers a recipe/ingredient picker
      // (Phase 2)
      // -- the form never sends ingredients. save_product_atomic still
      // requires a valid recipe_decision per variant, so feed planRecipeSave
      // the variant's own current active-recipe ingredients back as a
      // no-op: this always resolves to UNCHANGED for an existing variant
      // (never creating a new recipe version or touching recipes table
      // content on an unrelated name/price/size edit) and to CREATE_INITIAL
      // with an empty recipe for a brand-new variant, matching what an
      // empty picker already produced before this change.
      const recipeTargetId = variantId || `__NEW_VARIANT_${index}`;
      const existingRecipe = variantId
        ? findLatestActiveRecipe(allRecipes, "PRODUCT_VARIANT", variantId)
        : null;
      const ingredients = existingRecipe
        ? JSON.parse(existingRecipe.ingredients_json || "[]")
        : [];
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

    const result = await saveProductAtomic({
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

    // A separate, small write rather than plumbing this through the atomic
    // RPC -- the confirmation is metadata about the save decision, not part
    // of what save_product_atomic's own row-count invariants need to know
    // about.
    if (wasWarningConfirmed) {
      await update(PRODUCT_SHEET, result.productId, {
        duplicate_warning_confirmed: true,
        duplicate_warning_confirmed_by: auth.actor.name,
        duplicate_warning_confirmed_at: new Date().toISOString(),
      });
    }

    // section 2:
    // revalidatePath only refreshes this exact screen. lib/sheets_db.ts's
    // findAll cache is keyed by TABLE (tag `sheets-<SheetName>`), and POS
    // reads the same tables through a different path -- so without this,
    // POS kept serving a stale Products/Product_Variants read for up to the
    // 10-minute catalog TTL after a save here. The manual "Xoá Cache" button
    // (app/admin/clear-cache/page.tsx) already calls these same two tags;
    // this makes that automatic on the write, not a new mechanism.
    revalidateTag("sheets-Products");
    revalidateTag("sheets-Product_Variants");
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// CLAUDE.md section 2 exception recorded 2026-08-29: pauseProduct/resumeProduct
// replace the old deleteProduct's soft-hide (status = 'DELETED'), which
// announced "Xoá" while doing something reversible -- INACTIVE is now the
// one hidden-but-recoverable state ("Ngừng bán" / "Bán lại", one click,
// reversible). eraseProduct is the only place this codebase writes a real
// SQL DELETE against products/product_variants, scoped by Postgres's own
// RESTRICT foreign keys to products that have never been sold -- see
// supabase/migrations/0075_erase_never_sold_product.sql.
//
// pauseProduct's cascade only touches ACTIVE variants (-> INACTIVE), never
// a DELETED one -- pausing a product must not resurrect a size the owner
// individually discontinued beforehand.
//
// resumeProduct's cascade is asymmetric, fixed 2026-08-29 after the owner
// hit it in production: Test1 (PROD-048) has one variant, DELETED, so
// resuming it under the old INACTIVE-only rule set the product back to
// ACTIVE with nothing sellable -- "Đang bán" with zero size to add, a
// silent trap (OPEN-ITEMS 73/74). Measured 2026-08-29: 43 products have
// every variant ACTIVE, 4 have none ACTIVE, 0 are mixed -- so "restore
// every non-ACTIVE variant when none is ACTIVE" is safe today, but the
// mixed case is the one this rule exists to protect and is tested even
// though nothing currently exercises it live.
export async function pauseProduct(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") || "");
  if (!id) return fail("ID không hợp lệ");
  try {
    await update(PRODUCT_SHEET, id, { status: "INACTIVE" });
    const variants = await findAll(VARIANT_SHEET);
    for (const variant of variants) {
      if (variant.product_id === id && variant.status === "ACTIVE") {
        await update(VARIANT_SHEET, variant.id, { status: "INACTIVE" });
      }
    }
    // section 2:
    // same fix as saveProduct above -- POS reads these two tables through a
    // cache tag, not this screen's path.
    revalidateTag("sheets-Products");
    revalidateTag("sheets-Product_Variants");
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function resumeProduct(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") || "");
  if (!id) return fail("ID không hợp lệ");
  try {
    await update(PRODUCT_SHEET, id, { status: "ACTIVE" });
    const allVariants = await findAll(VARIANT_SHEET);
    const productVariants = allVariants.filter((v: any) => v.product_id === id);
    const hasActiveVariant = productVariants.some((v: any) => v.status === "ACTIVE");
    for (const variant of productVariants) {
      if (hasActiveVariant) {
        // At least one size is already live -- someone curated sizes
        // individually, so only undo this specific pause; a DELETED size
        // must not come back just because the product resumed.
        if (variant.status === "INACTIVE") {
          await update(VARIANT_SHEET, variant.id, { status: "ACTIVE" });
        }
      } else if (variant.status !== "ACTIVE") {
        // No size is live at all -- there is no curated selection left to
        // protect. Restoring only INACTIVE ones here would resume the
        // product with nothing sellable (Test1's shape in production).
        await update(VARIANT_SHEET, variant.id, { status: "ACTIVE" });
      }
    }
    // section 2:
    // this is the exact case the owner hit -- resumeProduct fixed the data
    // at 02:24:58, POS at 02:25 still read the pre-resume cache.
    revalidateTag("sheets-Products");
    revalidateTag("sheets-Product_Variants");
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function eraseProduct(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") || "");
  if (!id) return fail("ID không hợp lệ");
  try {
    await eraseProductAtomic(id);
    // section 2:
    // same fix as the other three actions above -- an erased (never-sold)
    // product must stop being offered on POS without waiting on the cache
    // TTL, same as a paused or resumed one.
    revalidateTag("sheets-Products");
    revalidateTag("sheets-Product_Variants");
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
