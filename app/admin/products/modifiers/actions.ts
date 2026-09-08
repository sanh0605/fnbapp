"use server";

import { findAll, insert, update, generateNewId, getCacheTag } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import type { DBModifier } from "@/types/db";
import { requireAdmin } from "@/lib/auth/auth";
import { syncToppingPriceAtomic } from "@/lib/products/topping-price-sync";
import { createStandaloneToppingProductAtomic } from "@/lib/products/create-standalone-topping";

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

    // Opus code review, 2026-09-08 (finding 2): Modifiers.product_id now
    // drives both the P&L/sales report merge and the POS quick-add
    // exclusion (Task 5) -- a stale Modifiers cache is a stale link, not
    // just a stale name/price. revalidatePath(PATH) below does not clear
    // this tag-keyed cache (established fact, see the plan's Caches note).
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
    await update(MODIFIER_SHEET, id, { status: "DELETED" });
    revalidateTag(getCacheTag("Modifiers"));
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 2. Turning
// "Bán độc lập" on for a modifier with no linked product (state c) --
// confirmed in the UI before this is called. All the real guards (already
// linked, wrong group, non-positive price) live in the RPC (migration
// 0100), re-checked under a row lock there rather than trusted from
// whatever the client last rendered. This action forwards the id, shapes
// the result, and revalidates every cache the new link now feeds: Products
// and Product_Variants (the new món must appear immediately, same as
// syncToppingPriceAtomic's edit path above) and Modifiers (code review
// finding on 8b96500 -- product_id now drives the report merge and POS
// quick-add exclusion, Task 5).
export async function createStandaloneToppingAction(modifierId: string): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  if (!modifierId) return fail("Thiếu mã tùy chọn");

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
