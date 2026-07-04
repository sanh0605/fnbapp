"use server";

import { findAll, findAllNoCache, insert, update, remove, generateNewId } from "@/lib/sheets_db";
import { revalidatePath, unstable_cache } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { resolveActor, requireAdmin } from "@/lib/auth";

// --- ITEM CATEGORIES (Nhóm Hàng Hoá) ---
export async function addItemCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = formData.get("name") as string;
  const system_type = formData.get("system_type") as string;

  if (!name || !system_type) return fail("Vui lòng nhập đầy đủ thông tin");

  try {
    const id = await generateNewId("Item_Categories", "NHH");
    await insert("Item_Categories", { id, name, system_type });
    revalidatePath("/admin/inventory/categories");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function updateItemCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const system_type = formData.get("system_type") as string;

  try {
    await update("Item_Categories", id, { name, system_type });
    revalidatePath("/admin/inventory/categories");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function deleteItemCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    await remove("Item_Categories", id);
    revalidatePath("/admin/inventory/categories");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

// --- BASE INGREDIENTS (Nhóm Nguyên Liệu) ---
export async function addBaseIngredient(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

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
      return ok();
    } catch (error: any) {
      return fail(error.message);
    }
  }

  // Fallback for single item (just in case)
  const name = formData.get("name") as string;
  const base_unit = formData.get("base_unit") as string;

  if (!name || !base_unit) return fail("Vui lòng nhập đầy đủ thông tin");

  try {
    const id = await generateNewId("Base_Ingredients", "NNL");
    await insert("Base_Ingredients", { id, name, base_unit });
    revalidatePath("/admin/inventory/base-ingredients");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function updateBaseIngredient(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

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
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function deleteBaseIngredient(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    await remove("Base_Ingredients", id);
    revalidatePath("/admin/inventory/base-ingredients");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

// --- PURCHASED ITEMS (Hàng Hoá Mua Vào) ---
export async function addPurchasedItem(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

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
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function updatePurchasedItem(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

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
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function deletePurchasedItem(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    await remove("Purchased_Items", id);
    revalidatePath("/admin/inventory/items");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

// --- UOM CONVERSIONS (Bảng Quy Đổi) ---
export async function addConversion(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const purchased_item_id = formData.get("purchased_item_id") as string;
  const purchased_unit = formData.get("purchased_unit") as string;
  const conversion_rate = formData.get("conversion_rate") as string;
  const base_unit = formData.get("base_unit") as string;

  if (!purchased_item_id || !purchased_unit || !conversion_rate || !base_unit) 
    return fail("Thiếu thông tin quy đổi");

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
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function updateConversion(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

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
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function deleteConversion(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    await remove("UOM_Conversions", id);
    revalidatePath("/admin/inventory/conversions");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

// --- UNITS (Đơn vị) ---
export async function addUnit(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  
  if (!name) return fail("Vui lòng nhập tên đơn vị");
  try {
    const id = await generateNewId("Units", "U");
    await insert("Units", {
      id,
      name,
      description,
      created_at: new Date().toISOString()
    });
    revalidatePath("/admin/inventory/units");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function updateUnit(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  
  if (!id || !name) return fail("Thiếu thông tin");
  try {
    await update("Units", id, { name, description });
    revalidatePath("/admin/inventory/units");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function deleteUnit(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    await remove("Units", id);
    revalidatePath("/admin/inventory/units");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

// --- STOCK (Tồn kho) ---
export const getRealtimeStock = unstable_cache(
  async () => {
    const [stockLedger, baseIngredients, semiProducts, units] = await Promise.all([
      findAllNoCache("Stock_Ledger"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
      findAll("Units")
    ]);

    const stockMap: Record<string, number> = {};

    stockLedger.forEach((entry: any) => {
      const itemId = entry.item_reference;
      const qty = Number(entry.quantity_change || 0);
      if (!stockMap[itemId]) {
        stockMap[itemId] = 0;
      }
      stockMap[itemId] += qty;
    });

    const allItems = [
      // Claude code — Phase 5.4: filter non-inventory items to keep stock UI focused.
      ...baseIngredients
        .filter((b: any) => b.is_non_inventory !== true && b.is_non_inventory !== "TRUE")
        .map((b: any) => ({ ...b, item_type: "BASE_INGREDIENT" })),
      ...semiProducts.map((s: any) => ({ ...s, item_type: "SEMI_PRODUCT" }))
    ];

    return allItems.map(item => {
      const unitName = units.find((u:any) => u.id === item.base_unit)?.name || item.base_unit;
      return {
        id: item.id,
        name: item.name,
        item_type: item.item_type,
        current_stock: stockMap[item.id] || 0,
        unitName
      };
    });
  },
  ["realtime-stock-all"],
  { revalidate: 60, tags: ["sheets-Stock_Ledger", "sheets-Base_Ingredients", "sheets-Semi_Products", "sheets-Units"] }
);

export async function submitStockAdjustment(data: any, _clientRole?: string, _clientUsername?: string): Promise<ActionResponse> {
  try {
    // Claude code — Phase 4.3: adjustment reason required for audit traceability.
    if (!data?.reason || String(data.reason).trim().length === 0) {
      return fail("Lý do điều chỉnh là bắt buộc");
    }
    // Claude code — CODE-22: ignore client-supplied role, use server-side auth.
    // Client params kept in signature for backward compat but no longer trusted.
    const auth = await resolveActor();
    if (!auth.ok) return fail(auth.error);
    const role = auth.actor.role;
    const username = auth.actor.name;

    const nowIso = new Date().toISOString();
    const id = await generateNewId("Stock_Adjustments", "SADJ");
    
    // If admin submits, it's auto-approved
    const isApproved = role === "ADMIN";
    
    await insert("Stock_Adjustments", {
      id,
      item_reference: data.item_id,
      theoretical_qty: data.theoretical_qty,
      actual_qty: data.actual_qty,
      difference: data.difference,
      reason: data.reason || "",
      status: isApproved ? "APPROVED" : "PENDING",
      created_by_name: username,
      created_by_id: auth.actor.id,
      created_at: nowIso,
      approved_by: isApproved ? username : "",
      approved_at: isApproved ? nowIso : ""
    });

    if (isApproved) {
      // Create ledger entry immediately
      const ledger_id = await generateNewId("Stock_Ledger", "STK");
      await insert("Stock_Ledger", {
        id: ledger_id,
        transaction_type: "STOCK_ADJUST",
        reference_id: id,
        item_reference: data.item_id,
        quantity_change: data.difference,
        unit_cost: 0,
        created_at: nowIso
      });
    }

    revalidatePath("/admin/inventory/stock");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function approveStockAdjustment(adjustmentId: string, _clientAdminUsername?: string): Promise<ActionResponse> {
  try {
    // Claude code — CODE-22: require ADMIN server-side; ignore client username.
    const auth = await requireAdmin();
    if (!auth.ok) return fail(auth.error);
    const adminUsername = auth.actor.name;

    const adjustments = await findAll("Stock_Adjustments");
    const adj = adjustments.find((a:any) => a.id === adjustmentId);
    if (!adj) return fail("Không tìm thấy phiếu điều chỉnh");
    if (adj.status === "APPROVED") return fail("Phiếu đã được duyệt");

    const nowIso = new Date().toISOString();
    
    await update("Stock_Adjustments", adjustmentId, {
      status: "APPROVED",
      approved_by: adminUsername,
      approved_at: nowIso
    });

    const ledger_id = await generateNewId("Stock_Ledger", "STK");
    await insert("Stock_Ledger", {
      id: ledger_id,
      transaction_type: "STOCK_ADJUST",
      reference_id: adjustmentId,
      item_reference: adj.item_reference,
      quantity_change: adj.difference,
      unit_cost: 0,
      created_at: nowIso
    });

    revalidatePath("/admin/inventory/stock");
    revalidatePath("/admin/inventory/stock-adjustments");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

export async function rejectStockAdjustment(adjustmentId: string): Promise<ActionResponse> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return fail(auth.error);
    const adminUsername = auth.actor.name;

    const adjustments = await findAll("Stock_Adjustments");
    const adj = adjustments.find((a:any) => a.id === adjustmentId);
    if (!adj) return fail("Không tìm thấy phiếu điều chỉnh");
    if (adj.status !== "PENDING") return fail("Phiếu không ở trạng thái chờ duyệt");

    const nowIso = new Date().toISOString();
    
    await update("Stock_Adjustments", adjustmentId, {
      status: "REJECTED",
      approved_by: adminUsername,
      approved_at: nowIso
    });

    revalidatePath("/admin/inventory/stock");
    revalidatePath("/admin/inventory/stock-adjustments");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}
