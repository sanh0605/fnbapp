"use server";

import { findAll, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

// --- ITEM CATEGORIES (Nhóm Hàng Hoá) ---
export async function addItemCategory(formData: FormData) {
  const name = formData.get("name") as string;
  const system_type = formData.get("system_type") as string;

  if (!name || !system_type) return { error: "Vui lòng nhập đầy đủ thông tin" };

  try {
    const id = await generateNewId("Item_Categories", "NHH");
    await insert("Item_Categories", { id, name, system_type });
    revalidatePath("/admin/inventory/categories");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateItemCategory(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const system_type = formData.get("system_type") as string;

  try {
    await update("Item_Categories", id, { name, system_type });
    revalidatePath("/admin/inventory/categories");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteItemCategory(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await remove("Item_Categories", id);
    revalidatePath("/admin/inventory/categories");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// --- BASE INGREDIENTS (Nhóm Nguyên Liệu) ---
export async function addBaseIngredient(formData: FormData) {
  const itemsJson = formData.get("items_json") as string;
  
  if (itemsJson) {
    try {
      const items = JSON.parse(itemsJson);
      for (const item of items) {
        if (!item.name || !item.base_unit) continue;
        const id = await generateNewId("Base_Ingredients", "NNL");
        await insert("Base_Ingredients", { 
          id, 
          name: item.name, 
          base_unit: item.base_unit,
          is_non_inventory: item.is_non_inventory ? "TRUE" : "FALSE"
        });
      }
      revalidatePath("/admin/inventory/base-ingredients");
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  // Fallback for single item (just in case)
  const name = formData.get("name") as string;
  const base_unit = formData.get("base_unit") as string;

  if (!name || !base_unit) return { error: "Vui lòng nhập đầy đủ thông tin" };

  try {
    const id = await generateNewId("Base_Ingredients", "NNL");
    await insert("Base_Ingredients", { id, name, base_unit });
    revalidatePath("/admin/inventory/base-ingredients");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateBaseIngredient(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const base_unit = formData.get("base_unit") as string;
  const is_non_inventory = formData.get("is_non_inventory") === "true";

  try {
    await update("Base_Ingredients", id, { 
      name, 
      base_unit,
      is_non_inventory: is_non_inventory ? "TRUE" : "FALSE"
    });
    revalidatePath("/admin/inventory/base-ingredients");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteBaseIngredient(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await remove("Base_Ingredients", id);
    revalidatePath("/admin/inventory/base-ingredients");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// --- PURCHASED ITEMS (Hàng Hoá Mua Vào) ---
export async function addPurchasedItem(formData: FormData) {
  const name = formData.get("name") as string;
  const item_category_id = formData.get("item_category_id") as string;
  const base_ingredient_id = formData.get("base_ingredient_id") as string;
  const unitsJson = formData.get("units_json") as string;
  const base_unit = formData.get("base_unit") as string;

  if (!name || !item_category_id) return { error: "Vui lòng nhập Tên và chọn Phân loại" };

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
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updatePurchasedItem(formData: FormData) {
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
      const existingConversions = allConversions.filter((c: any) => c.purchased_item_id === id);
      
      const newUnitIds: string[] = [];
      for (const u of newUnits) {
        if (!u.name || !u.conversion_rate) continue;
        
        if (u.id) {
          if (update_history) {
            const oldConv = existingConversions.find((c: any) => c.id === u.id);
            if (oldConv && oldConv.purchased_unit !== u.name) {
              const poLines = await findAll("Purchase_Order_Lines");
              const linesToUpdate = poLines.filter((p: any) => p.purchased_item_id === id && p.unit === oldConv.purchased_unit);
              for (const line of linesToUpdate) {
                 await update("Purchase_Order_Lines", line.id, { unit: u.name }); // Use partial update or full, sheet_db.ts `update` function uses Object.assign internally over existing row if needed, but since we overwrite it, it's better to pass just { unit: u.name }, Wait, `update` expects the full object.
                 // let's pass the full object with modification
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
          await remove("UOM_Conversions", ex.id);
        }
      }
    }

    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/conversions");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deletePurchasedItem(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await remove("Purchased_Items", id);
    revalidatePath("/admin/inventory/items");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// --- UOM CONVERSIONS (Bảng Quy Đổi) ---
export async function addConversion(formData: FormData) {
  const purchased_item_id = formData.get("purchased_item_id") as string;
  const purchased_unit = formData.get("purchased_unit") as string;
  const conversion_rate = formData.get("conversion_rate") as string;
  const base_unit = formData.get("base_unit") as string;

  if (!purchased_item_id || !purchased_unit || !conversion_rate || !base_unit) 
    return { error: "Thiếu thông tin quy đổi" };

  try {
    const id = await generateNewId("UOM_Conversions", "QD");
    await insert("UOM_Conversions", { 
      id, 
      purchased_item_id, 
      purchased_unit, 
      base_unit, 
      conversion_rate 
    });
    revalidatePath("/admin/inventory/conversions");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateConversion(formData: FormData) {
  const id = formData.get("id") as string;
  const purchased_item_id = formData.get("purchased_item_id") as string;
  const purchased_unit = formData.get("purchased_unit") as string;
  const conversion_rate = formData.get("conversion_rate") as string;
  const base_unit = formData.get("base_unit") as string;
  const update_history = formData.get("update_history") === "true";

  try {
    if (update_history) {
      const allConvs = await findAll("UOM_Conversions");
      const oldConv = allConvs.find((c: any) => c.id === id);
      if (oldConv && oldConv.purchased_unit !== purchased_unit) {
        const poLines = await findAll("Purchase_Order_Lines");
        const linesToUpdate = poLines.filter((p: any) => p.purchased_item_id === purchased_item_id && p.unit === oldConv.purchased_unit);
        for (const line of linesToUpdate) {
           await update("Purchase_Order_Lines", line.id, { ...line, unit: purchased_unit });
        }
      }
    }

    await update("UOM_Conversions", id, { 
      purchased_item_id, 
      purchased_unit, 
      base_unit, 
      conversion_rate 
    });
    revalidatePath("/admin/inventory/conversions");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteConversion(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await remove("UOM_Conversions", id);
    revalidatePath("/admin/inventory/conversions");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}


// --- UNITS (Đơn vị) ---
export async function addUnit(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  
  if (!name) return { error: "Vui lòng nhập tên đơn vị" };
  try {
    const id = await generateNewId("Units", "U");
    await insert("Units", {
      id,
      name,
      description,
      created_at: new Date().toISOString()
    });
    revalidatePath("/admin/inventory/units");
    return { success: true };
  } catch (error: any) { return { error: error.message }; }
}

export async function updateUnit(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  
  if (!id || !name) return { error: "Thiếu thông tin" };
  try {
    await update("Units", id, { name, description });
    revalidatePath("/admin/inventory/units");
    return { success: true };
  } catch (error: any) { return { error: error.message }; }
}

export async function deleteUnit(formData: FormData) {
  const id = formData.get("id") as string;
  try {
    const { remove } = await import("@/lib/sheets_db");
    await remove("Units", id);
    revalidatePath("/admin/inventory/units");
    return { success: true };
  } catch (error: any) { return { error: error.message }; }
}
