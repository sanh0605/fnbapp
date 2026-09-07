"use server";

import { findAll, insert, update, generateNewId } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import type { DBModifier } from "@/types/db";
import { requireAdmin } from "@/lib/auth/auth";
import { syncToppingPriceAtomic } from "@/lib/products/topping-price-sync";

const MODIFIER_SHEET = "Modifiers";
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
  const group_name = formData.get("group_name") as string;
  const price = formData.get("price") as string;

  if (!name || !group_name) return fail("Vui lòng nhập đầy đủ thông tin");

  try {
    if (isEdit && modifier_id) {
      // docs/superpowers/plans/2026-09-07-one-price-per-topping.md: price
      // goes through the atomic sync RPC, one write, not a plain update()
      // for price plus a second call for name/group_name -- it carries
      // those two along on the same call. A synced price also moves the
      // linked product's variant, so the product caches must not sit stale.
      await syncToppingPriceAtomic({
        modifierId: modifier_id,
        price: Number(price),
        name,
        groupName: group_name,
      });
      revalidateTag("sheets-Products");
      revalidateTag("sheets-Product_Variants");
    } else {
      const finalId = await generateNewId(MODIFIER_SHEET, "MOD");
      await insert(MODIFIER_SHEET, {
        id: finalId,
        group_name,
        name,
        price,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
      });
    }

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
    await update(MODIFIER_SHEET, id, { status: "DELETED" });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
