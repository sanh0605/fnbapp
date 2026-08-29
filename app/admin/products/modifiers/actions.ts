"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import type { DBModifier } from "@/types/db";
import { requireAdmin } from "@/lib/auth";

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
    // docs/superpowers/plans/2026-08-27-stop-reporting-failures-as-empty.md:
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
      await update(MODIFIER_SHEET, modifier_id, { name, group_name, price });
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
