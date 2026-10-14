"use server";

import { findAll, update, generateNewId, getCacheTag } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import type { DBModifier, DBModifierGroup } from "@/types/db";
import { requireAdmin } from "@/lib/auth/auth";
import { setProductStatusAtomic } from "@/lib/products/product-status-transaction";
import { saveModifierAtomic } from "@/lib/products/modifier-save-transaction";
import { createStandaloneToppingProductAtomic } from "@/lib/products/create-standalone-topping";

const MODIFIER_SHEET = "Modifiers";
const GROUP_SHEET = "Modifier_Groups";
const PATH = "/admin/products/modifiers";

export async function getModifiersData(): Promise<{
  modifiers: DBModifier[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const modifiers = (await findAll(MODIFIER_SHEET)) as DBModifier[];
    const activeModifiers = modifiers.filter(m => m.status !== "DELETED");
    return { modifiers: activeModifiers };
  } catch (error) {
    // rethrow instead of a fabricated empty result -- app/error.tsx handles it.
    console.error("Loi getModifiersData:", error);
    throw error;
  }
}

export async function saveModifierAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const isEdit = formData.get("is_edit") === "true";
  const modifier_id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const group_id = formData.get("group_id") as string;
  const price = Number(formData.get("price"));
  const maxQtyRaw = ((formData.get("max_qty") as string) || "").trim();

  if (!name || !group_id) return fail("Vui lòng nhập đầy đủ thông tin");
  if (!Number.isFinite(price) || price < 0) return fail("Giá không hợp lệ");
  const maxQty = maxQtyRaw ? Number(maxQtyRaw) : null;
  if (maxQty !== null && !(Number.isInteger(maxQty) && maxQty >= 1 && maxQty <= 20)) {
    return fail("Tối đa từ 1 đến 20 phần");
  }

  try {
    const group = ((await findAll(GROUP_SHEET)) as DBModifierGroup[]).find((g) => g.id === group_id);
    if (!group) return fail("Nhóm tuỳ chọn không tồn tại");
    const isDefault = formData.get("is_default") === "on";
    if (isDefault && group.selection_mode !== "ONE") return fail("Chỉ nhóm chọn một mới có lựa chọn có sẵn");
    if (isEdit) {
      // Rule 3 of the Nhóm tuỳ chọn spec: a dish sold on its own needs a group that allows it.
      const existing = ((await findAll(MODIFIER_SHEET)) as DBModifier[]).find((m) => m.id === modifier_id);
      if (existing?.product_id && !group.allow_standalone) {
        return fail(`Món ${existing.name} đang bán riêng; nhóm này không cho bán riêng.`);
      }
    }

    const id = isEdit && modifier_id ? modifier_id : await generateNewId(MODIFIER_SHEET, "MOD");
    // BR-CATALOG-003: one RPC writes the option; on edit it also syncs the price to the
    // linked product, so the product caches must not sit stale.
    await saveModifierAtomic({
      isEdit,
      modifier: { id, name, price, group_id, is_default: isDefault, max_qty: group.selection_mode === "MANY" ? maxQty : null },
    });
    if (isEdit) {
      revalidateTag("sheets-Products");
      revalidateTag("sheets-Product_Variants");
    }

    // Opus code review, 2026-09-08 (finding 2): Modifiers.product_id now
    // drives both the P&L/sales report merge and the POS quick-add
    // exclusion -- a stale Modifiers cache is a stale link, not just a stale
    // name/price. revalidatePath(PATH) below does not clear this tag-keyed cache.
    revalidateTag(getCacheTag("Modifiers"));
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function deleteModifierAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  try {
    // A linked dish that stays ACTIVE would keep selling with no option behind it.
    const linked = ((await findAll(MODIFIER_SHEET)) as DBModifier[]).find((m) => m.id === id)?.product_id;
    if (linked) {
      const dish = ((await findAll("Products")) as any[]).find((p) => p.id === linked);
      if (dish?.status === "ACTIVE") {
        return fail(`Tuỳ chọn này đang bán riêng thành món ${dish.name}. Tắt Bán độc lập trước rồi xoá`);
      }
    }
    await update(MODIFIER_SHEET, id, { status: "DELETED" });
    revalidateTag(getCacheTag("Modifiers"));
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// BR-CATALOG-003. Turning
// "Bán độc lập" on for a modifier with no linked product (state c) --
// confirmed in the UI before this is called. All the real guards (already
// linked, wrong group, non-positive price) live in the RPC (migration
// 0100), re-checked under a row lock there rather than trusted from
// whatever the client last rendered. This action forwards the id, shapes
// the result, and revalidates every cache the new link now feeds: Products
// and Product_Variants (the new món must appear immediately, same as
// syncToppingPriceAtomic's edit path above) and Modifiers (code review
// finding on 8b96500 -- product_id now drives the report merge and POS
// quick-add exclusion).
export async function createStandaloneToppingAction(modifierId: string): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  if (!modifierId) return fail("Thiếu mã tuỳ chọn");

  try {
    await createStandaloneToppingProductAtomic({ modifierId });
    revalidateTag("sheets-Products");
    revalidateTag("sheets-Product_Variants");
    revalidateTag(getCacheTag("Modifiers"));
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// BR-CATALOG-003: the Bán độc lập switch. A standalone topping is identified by its
// modifier link (migration 0097), not by its dish group. The status change runs through
// the same atomic rpc as the dish page, so the dish and its sizes move together.
export async function toggleToppingStandalone(productId: string, enabled: boolean): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const product = ((await findAll("Products")) as any[]).find((p) => p.id === productId);
    if (!product) return fail(`Không tìm thấy sản phẩm ${productId}`);
    // The rpc accepts any dish; a deleted one would come back on the till.
    if (product.status === "DELETED") return fail("Món đã xoá, không bật/tắt bán độc lập được");
    const modifiers = (await findAll(MODIFIER_SHEET)) as DBModifier[];
    if (!modifiers.some((m) => m.status !== "DELETED" && m.product_id === productId)) {
      return fail(`Món "${product.name || productId}" không gắn với topping nào nên không bật/tắt bán độc lập được.`);
    }
    await setProductStatusAtomic(productId, enabled ? "ACTIVE" : "INACTIVE");
    revalidateTag("sheets-Products");
    revalidateTag("sheets-Product_Variants");
    revalidatePath("/pos");
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
