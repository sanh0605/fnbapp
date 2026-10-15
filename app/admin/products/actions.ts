"use server";

import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { saveProductAtomic } from "@/lib/products/product-save-transaction";
import { setProductStatusAtomic } from "@/lib/products/product-status-transaction";
import { eraseProductAtomic } from "@/lib/products/product-erase-transaction";
import { fail, ok, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { findAll, findById, update } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  findDuplicateActiveName,
  duplicateNameErrorMessage,
  findDiacriticStrippedMatch,
  duplicateWarningMessage,
} from "@/lib/shared/duplicate-name-guard";

const PRODUCT_SHEET = "Products";
const VARIANT_SHEET = "Product_Variants";
const MODIFIER_SHEET = "Modifiers";
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
    const [allVariants, allProducts, allModifiers] = await Promise.all([
      isEdit ? findAll(VARIANT_SHEET) : Promise.resolve([]),
      findAll(PRODUCT_SHEET),
      isEdit ? findAll(MODIFIER_SHEET) : Promise.resolve([]),
    ]);

    // F6: a dish linked to an ACTIVE topping has one price, synced by
    // sync_topping_price_atomic (migration 0098), which needs exactly one
    // ACTIVE size -- refuse a second size here instead of failing later.
    const linkedTopping = isEdit
      ? (allModifiers as any[]).find((m) => m.status === "ACTIVE" && m.product_id === id)
      : null;
    if (linkedTopping && variants.some((v) => !(typeof v.id === "string" && v.id))) {
      return fail(
        `Món này đang là topping "${linkedTopping.name}" nên chỉ được có một size. Giá đặt ở trang Topping & tuỳ chọn.`,
      );
    }

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
    const effectiveAt = new Date().toISOString();

    let expectedPriceHistoryCount = 0;
    const keepVariantIds: string[] = [];
    const variantPlans = variants.map((variant) => {
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
      if (!existing || Number(existing.price) !== price) {
        expectedPriceHistoryCount += 1;
      }

      return { id: variantId, size_name: sizeName, price };
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
        // F2: the form sends no picture; keep the stored one on edit.
        image_url: imageUrl || (isEdit
          ? String((allProducts as any[]).find((p) => p.id === id)?.image_url || "")
          : ""),
        status: "ACTIVE",
        created_at: new Date().toISOString(),
      },
      variants: variantPlans,
      removedVariantIds,
      effectiveAt,
      expectedPriceHistoryCount,
      // Undefined (no marker) leaves the ticks alone: a form open since before the deploy has no tick list.
      optionGroupIds: formData.get("option_group_ids_sent") === "1"
        ? formData.getAll("option_group_ids").map(String).filter(Boolean)
        : undefined,
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
    // revalidatePath only refreshes this exact screen. lib/db/tables.ts's
    // findAll cache is keyed by TABLE (tag `sheets-<SheetName>`), and POS
    // reads the same tables through a different path -- so without this,
    // POS kept serving a stale Products/Product_Variants read for up to the
    // 10-minute catalog TTL after a save here. The manual "Xoá Cache" button
    // (app/admin/clear-cache/page.tsx) already calls these same two tags;
    // this makes that automatic on the write, not a new mechanism.
    revalidateTag("sheets-Products", { expire: 0 });
    revalidateTag("sheets-Product_Variants", { expire: 0 });
    revalidateTag("sheets-Modifier_Group_Products", { expire: 0 });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// CLAUDE.md "Luật dữ liệu" exception recorded 2026-08-29: pauseProduct/resumeProduct
// replace the old deleteProduct's soft-hide (status = 'DELETED'), which
// announced "Xoá" while doing something reversible -- INACTIVE is now the
// one hidden-but-recoverable state ("Ngừng bán" / "Bán lại", one click,
// reversible). eraseProduct is the only place this codebase writes a real
// SQL DELETE against products/product_variants, scoped by Postgres's own
// RESTRICT foreign keys to products that have never been sold -- see
// supabase/migrations/0075_erase_never_sold_product.sql.
//
// The cascade rules (pause touches only ACTIVE sizes; resume restores only
// INACTIVE sizes unless none is ACTIVE, then every non-ACTIVE one -- Test1,
// PROD-048, 2026-08-29) now live in set_product_status_atomic (migration
// 0114) so the dish and its sizes change in one transaction.
export async function pauseProduct(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  return setStatus(formData, "INACTIVE");
}

export async function resumeProduct(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  return setStatus(formData, "ACTIVE");
}

async function setStatus(formData: FormData, status: "ACTIVE" | "INACTIVE"): Promise<ActionResponse> {
  const id = String(formData.get("id") || "");
  if (!id) return fail("ID không hợp lệ");
  try {
    // The RPC accepts any dish; a deleted one would come back on the till.
    const product = await findById(PRODUCT_SHEET, id);
    if (product?.status === "DELETED") return fail("Món đã xoá, không bán lại hay ngừng bán được");
    await setProductStatusAtomic(id, status);
    // POS reads these two tables through a cache tag, not this screen's path
    // (the owner hit a stale POS right after a resume, 2026-08-31).
    revalidateTag("sheets-Products", { expire: 0 });
    revalidateTag("sheets-Product_Variants", { expire: 0 });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// BR-ACCESS-003 -- a never-sold product is erased for good, price history
// included, so only ADMIN may do it, checked here with requireOwner().
export async function eraseProduct(formData: FormData): Promise<ActionResponse> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") || "");
  if (!id) return fail("ID không hợp lệ");
  try {
    // F3: modifiers.product_id is RESTRICT (migration 0097) whatever the
    // modifier's status, so the database would refuse with the misleading
    // "đã có đơn hàng". Say the real reason first.
    const modifiers = await findAll(MODIFIER_SHEET);
    const link = (modifiers as any[]).find((m) => m.product_id === id);
    if (link) {
      return fail(
        `Món này đang gắn với topping "${link.name}" nên không xoá vĩnh viễn được. Dùng "Ngừng bán" để ẩn khỏi máy bán hàng.`,
      );
    }
    await eraseProductAtomic(id);
    // section 2:
    // same fix as the other three actions above -- an erased (never-sold)
    // product must stop being offered on POS without waiting on the cache
    // TTL, same as a paused or resumed one.
    revalidateTag("sheets-Products", { expire: 0 });
    revalidateTag("sheets-Product_Variants", { expire: 0 });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
