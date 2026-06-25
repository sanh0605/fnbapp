"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBPurchasedItem, DBUOMConversion, DBItemCategory, DBBaseIngredient, DBUnit } from "@/types/db";

const SHEET = "Purchased_Items";
const PATH = "/admin/inventory/items";

export async function getItemsData(): Promise<{
  categories: DBItemCategory[];
  baseIngredients: DBBaseIngredient[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}> {
  try {
    const [categories, baseIngredients, items, conversions, allUnits] = await Promise.all([
      findAll("Item_Categories") as Promise<DBItemCategory[]>,
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll(SHEET) as Promise<DBPurchasedItem[]>,
      findAll("UOM_Conversions") as Promise<DBUOMConversion[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { categories, baseIngredients, items, conversions, units };
  } catch (error) {
    console.error("Loi getItemsData:", error);
    return { categories: [], baseIngredients: [], items: [], conversions: [], units: [] };
  }
}

export async function addPurchasedItem(formData: FormData): Promise<ActionResponse> {
  const name = formData.get("name") as string;
  const item_category_id = formData.get("item_category_id") as string;
  const base_ingredient_id = formData.get("base_ingredient_id") as string;
  const unitsJson = formData.get("units_json") as string;
  const base_unit = formData.get("base_unit") as string;

  if (!name || !item_category_id) return fail("Vui lòng nhập Tên và chọn Phân loại");

  try {
    const id = await generateNewId("Purchased_Items", "SPM");
    await insert("Purchased_Items", { 
      id, 
      name, 
      item_category_id, 
      base_ingredient_id: base_ingredient_id || "" 
    });

    // Nếu có chọn nhóm nguyên liệu và có truyền array units thì tạo quy đổi luôn
    if (base_ingredient_id && unitsJson && base_unit) {
      const units = JSON.parse(unitsJson);
      for (const u of units) {
        if (u.name && u.conversion_rate) {
          const convId = await generateNewId("UOM_Conversions", "QD");
          await insert("UOM_Conversions", {
            id: convId,
            purchased_item_id: id,
            purchased_unit: u.name,
            base_unit: base_unit,
            conversion_rate: u.conversion_rate
          });
        }
      }
    }

    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/conversions");
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function updatePurchasedItem(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const item_category_id = formData.get("item_category_id") as string;
  const base_ingredient_id = formData.get("base_ingredient_id") as string;
  const unitsJson = formData.get("units_json") as string;
  const base_unit = formData.get("base_unit") as string;
  const update_history = formData.get("update_history") === "true";

  try {
    await update("Purchased_Items", id, { 
      name, 
      item_category_id, 
      base_ingredient_id: base_ingredient_id || "" 
    });

    if (base_ingredient_id && unitsJson && base_unit) {
      const newUnits = JSON.parse(unitsJson);
      
      const allConversions = await findAll("UOM_Conversions");
      const poLines = await findAll("Purchase_Order_Lines");
      const existingConversions = allConversions.filter((c: any) => c.purchased_item_id === id);
      const referencedConversionIds = new Set(
        poLines
          .filter((line: any) => line.conversion_id)
          .map((line: any) => line.conversion_id)
      );
      
      const newUnitIds: string[] = [];
      for (const u of newUnits) {
        if (!u.name || !u.conversion_rate) continue;
        
        if (u.id) {
          const oldConv = existingConversions.find((c: any) => c.id === u.id);
          const isReferenced = referencedConversionIds.has(u.id);
          const coreFieldsChanged = oldConv && (
            oldConv.purchased_unit !== u.name ||
            String(oldConv.conversion_rate) !== String(u.conversion_rate) ||
            oldConv.base_unit !== base_unit
          );

          if (isReferenced && coreFieldsChanged) {
            return fail("Một quy đổi đã được dùng trong phiếu nhập lịch sử. Hãy tạo quy đổi mới thay vì sửa trực tiếp.");
          }

          if (update_history) {
            if (oldConv && oldConv.purchased_unit !== u.name) {
              const linesToUpdate = poLines.filter((p: any) => p.purchased_item_id === id && p.unit === oldConv.purchased_unit);
              for (const line of linesToUpdate) {
                 await update("Purchase_Order_Lines", line.id, { ...line, unit: u.name });
              }
            }
          }
          // Cập nhật record cũ
          await update("UOM_Conversions", u.id, {
            purchased_item_id: id,
            purchased_unit: u.name,
            base_unit: base_unit,
            conversion_rate: u.conversion_rate
          });
          newUnitIds.push(u.id);
        } else {
          // Tạo mới record
          const convId = await generateNewId("UOM_Conversions", "QD");
          await insert("UOM_Conversions", {
            id: convId,
            purchased_item_id: id,
            purchased_unit: u.name,
            base_unit: base_unit,
            conversion_rate: u.conversion_rate
          });
          newUnitIds.push(convId);
        }
      }

      // Xoá những record đã bị xoá khỏi UI
      for (const ex of existingConversions) {
        if (!newUnitIds.includes(ex.id)) {
          if (referencedConversionIds.has(ex.id)) {
            await update("UOM_Conversions", ex.id, { status: "INACTIVE" });
          } else {
            await remove("UOM_Conversions", ex.id);
          }
        }
      }
    }

    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/conversions");
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}

export async function deletePurchasedItemAction(formData: FormData): Promise<ActionResponse> {
  const id = formData.get("id") as string;
  try {
    await remove(SHEET, id);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
