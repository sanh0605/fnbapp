"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBBaseIngredient, DBUnit } from "@/types/db";
import { requireAdmin } from "@/lib/auth";

const SHEET = "Base_Ingredients";
const PATH = "/admin/inventory/base-ingredients";

export async function getBaseIngredientsData(): Promise<{
  ingredients: DBBaseIngredient[];
  units: DBUnit[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const [ingredients, allUnits] = await Promise.all([
      findAll(SHEET) as Promise<DBBaseIngredient[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { ingredients, units };
  } catch (error) {
    console.error("Loi getBaseIngredientsData:", error);
    return { ingredients: [], units: [] };
  }
}

export async function addBaseIngredient(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const itemsJson = formData.get("items_json") as string;

    if (itemsJson) {
      const items = JSON.parse(itemsJson) as Array<{
        name: string;
        base_unit: string;
        is_non_inventory: boolean;
      }>;

      for (const item of items) {
        if (!item.name || !item.base_unit) continue;
        const id = await generateNewId(SHEET, "NNL");
        await insert(SHEET, {
          id,
          name: item.name,
          base_unit: item.base_unit,
          is_non_inventory: item.is_non_inventory ? "TRUE" : "FALSE",
          status: "ACTIVE",
          created_at: new Date().toISOString(),
        });
      }
      revalidatePath(PATH);
      return ok();
    }

    // Fallback single-item path
    const name = formData.get("name") as string;
    const base_unit = formData.get("base_unit") as string;
    if (!name || !base_unit) return fail("Thiếu thông tin nguyên liệu");

    const id = await generateNewId(SHEET, "NNL");
    await insert(SHEET, {
      id,
      name,
      base_unit,
      is_non_inventory: "FALSE",
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function updateBaseIngredient(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const base_unit = formData.get("base_unit") as string;
  const is_non_inventory = formData.get("is_non_inventory") as string;

  if (!id || !name || !base_unit) return fail("Thiếu thông tin");

  try {
    const nonInv = is_non_inventory === "true" ? "TRUE" : "FALSE";
    await update(SHEET, id, { name, base_unit, is_non_inventory: nonInv });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteBaseIngredientAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  try {
    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
