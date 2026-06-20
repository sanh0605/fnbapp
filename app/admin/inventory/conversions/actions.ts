"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBUOMConversion, DBPurchasedItem, DBBaseIngredient, DBUnit } from "@/types/db";

const SHEET = "UOM_Conversions";
const PATH = "/admin/inventory/conversions";

export async function getConversionsData(): Promise<{
  baseIngredients: DBBaseIngredient[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}> {
  try {
    const [baseIngredients, items, conversions, allUnits] = await Promise.all([
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
      findAll(SHEET) as Promise<DBUOMConversion[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { baseIngredients, items, conversions, units };
  } catch (error) {
    console.error("Loi getConversionsData:", error);
    return { baseIngredients: [], items: [], conversions: [], units: [] };
  }
}

export async function addConversion(formData: FormData): Promise<ActionResponse> {
  const purchased_item_id = formData.get("purchased_item_id") as string;
  const purchased_unit = formData.get("purchased_unit") as string;
  const conversion_rate = formData.get("conversion_rate") as string;
  const base_unit = formData.get("base_unit") as string;

  if (!purchased_item_id || !purchased_unit || !conversion_rate || !base_unit) {
    return fail("Thiếu thông tin quy đổi");
  }

  try {
    const id = await generateNewId(SHEET, "QD");
    await insert(SHEET, {
      id,
      purchased_item_id,
      purchased_unit,
      conversion_rate,
      base_unit,
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

export async function updateConversion(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const purchased_item_id = formData.get("purchased_item_id") as string;
  const purchased_unit = formData.get("purchased_unit") as string;
  const conversion_rate = formData.get("conversion_rate") as string;
  const base_unit = formData.get("base_unit") as string;
  const update_history = formData.get("update_history") === "true";

  if (!id || !purchased_item_id || !purchased_unit || !conversion_rate || !base_unit) {
    return fail("Thiếu thông tin");
  }

  try {
    // Preserve update_history logic exactly
    if (update_history) {
      const allConvs = await findAll(SHEET);
      const oldConv = allConvs.find((c: DBUOMConversion) => c.id === id);
      if (oldConv && oldConv.purchased_unit !== purchased_unit) {
        const poLines = await findAll("Purchase_Order_Lines");
        for (const line of poLines) {
          if (line.purchased_item_id === purchased_item_id && line.unit === oldConv.purchased_unit) {
            await update("Purchase_Order_Lines", line.id, { ...line, unit: purchased_unit });
          }
        }
      }
    }

    await update(SHEET, id, { purchased_item_id, purchased_unit, conversion_rate, base_unit });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deleteConversionAction(formData: FormData): Promise<ActionResponse> {
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
