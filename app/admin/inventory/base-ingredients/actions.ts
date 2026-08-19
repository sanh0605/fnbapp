"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBBaseIngredient, DBUnit } from "@/types/db";
import { requireAdmin } from "@/lib/auth";
import { findDuplicateActiveName, duplicateNameErrorMessage } from "@/lib/duplicate-name-guard";

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

      // Batch 1, section A2: check every row in the batch BEFORE inserting
      // any of them -- against existing ACTIVE rows and against names
      // earlier in this same batch (two new rows in one submission sharing
      // a name is the same duplicate). A single pass that checks and
      // inserts together would let earlier rows save silently while a
      // later one is refused, leaving a partial batch the owner did not
      // ask for and the error message does not mention.
      const existingIngredients = (await findAll(SHEET)) as any[];
      const namesInThisBatch: { id: string; name: string; status: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.name || !item.base_unit) continue;
        const conflict =
          findDuplicateActiveName(existingIngredients, item.name) ??
          findDuplicateActiveName(namesInThisBatch, item.name);
        if (conflict) {
          return fail(`Dòng ${i + 1}: ${duplicateNameErrorMessage(conflict)}`);
        }
        namesInThisBatch.push({ id: `__pending_${i}`, name: item.name, status: "ACTIVE" });
      }

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

    const existingIngredients = (await findAll(SHEET)) as any[];
    const conflict = findDuplicateActiveName(existingIngredients, name);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

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
    const existingIngredients = (await findAll(SHEET)) as any[];
    const conflict = findDuplicateActiveName(existingIngredients, name, id);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

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
