"use server";

import { findAll, findAllNoCache, findAllWhere, insert, update, remove, generateNewId, getCacheTag } from "@/lib/sheets_db";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth";
import {
  approveStockAdjustmentAtomic,
  submitStockAdjustmentAtomic,
} from "@/lib/stock-adjustment-transaction";
import { findDuplicateActiveName, duplicateNameErrorMessage } from "@/lib/duplicate-name-guard";
import { buildUnitDeleteRestrictionMessage, type UnitBlockerFinding } from "@/lib/unit-delete-restriction";

// --- ITEM CATEGORIES (Nhóm Hàng Hoá) ---
export async function addItemCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = formData.get("name") as string;
  const system_type = formData.get("system_type") as string;

  if (!name || !system_type) return fail("Vui lòng nhập đầy đủ thông tin");

  try {
    const existingCategories = (await findAll("Item_Categories")) as any[];
    const conflict = findDuplicateActiveName(existingCategories, name);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    const id = await generateNewId("Item_Categories", "NHH");
    await insert("Item_Categories", { id, name, system_type });
    // docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
    // section 2: Item_Categories is cached 30 min, keyed by table, and other
    // screens (Hàng Mua Vào, Kiểm kê...) read it through that cache.
    // revalidatePath below only refreshes this screen.
    revalidateTag(getCacheTag("Item_Categories"));
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
    const existingCategories = (await findAll("Item_Categories")) as any[];
    const conflict = findDuplicateActiveName(existingCategories, name, id);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    await update("Item_Categories", id, { name, system_type });
    revalidateTag(getCacheTag("Item_Categories"));
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
    revalidateTag(getCacheTag("Item_Categories"));
    revalidatePath("/admin/inventory/categories");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

// --- PURCHASED ITEMS (Hàng Hoá Mua Vào) ---
// Not touched by docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md:
// confirmed dead (grep across app/ and components/, no import found anywhere)
// -- the real, live screen imports addPurchasedItem/updatePurchasedItem from
// app/admin/inventory/items/actions.ts instead, which is what the plan's own
// section 1.3 also names separately. Adding revalidateTag to a function that
// never runs would fix nothing; noted here rather than silently ignored or
// deleted (out of this task's scope).
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
// Same as above: dead, unreferenced anywhere. The real, live screen imports
// addConversion/updateConversion from app/admin/inventory/conversions/actions.ts
// (a DIFFERENT file the plan's own section 1.3 measurement missed entirely
// -- fixed there instead, see that file's own note).
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
    const existingUnits = (await findAll("Units")) as any[];
    const conflict = findDuplicateActiveName(existingUnits, name);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    const id = await generateNewId("Units", "U");
    await insert("Units", {
      id,
      name,
      description,
      created_at: new Date().toISOString()
    });
    // docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
    // section 2: Units is cached 30 min, keyed by table -- Hàng Mua Vào,
    // Phiếu xuất kho, Kiểm kê all read it through that cache, not this path.
    revalidateTag(getCacheTag("Units"));
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
    const existingUnits = (await findAll("Units")) as any[];
    const conflict = findDuplicateActiveName(existingUnits, name, id);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    await update("Units", id, { name, description });
    revalidateTag(getCacheTag("Units"));
    revalidatePath("/admin/inventory/units");
    return ok();
  } catch (error: any) {
    return fail(error.message);
  }
}

// docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
// section A3: 7 RESTRICT foreign keys reference units.id (measured live
// 2026-09-01) -- checked in this order, stopping at the first match, so a
// unit blocked by more than one source still gets one clear sentence rather
// than a merged one. purchase_order_lines and production_items are checked
// last -- historical/production rows are the least likely real-world cause
// today (0 production_items rows exist at all).
async function findUnitDeleteBlocker(unitId: string): Promise<UnitBlockerFinding | null> {
  const conversionsByPurchasedUnit = await findAllWhere<{ purchased_item_id: string }>(
    "UOM_Conversions", { eq: { purchased_unit: unitId }, limit: 1 },
  );
  const conversionsByBaseUnit = conversionsByPurchasedUnit.length > 0
    ? []
    : await findAllWhere<{ purchased_item_id: string }>(
        "UOM_Conversions", { eq: { base_unit: unitId }, limit: 1 },
      );
  const blockingConversion = conversionsByPurchasedUnit[0] || conversionsByBaseUnit[0];
  if (blockingConversion) {
    const items = await findAllWhere<{ name: string }>(
      "Purchased_Items", { eq: { id: blockingConversion.purchased_item_id }, limit: 1 },
    );
    return { kind: "uom_conversions", count: 1, ownerName: items[0]?.name || blockingConversion.purchased_item_id };
  }

  const purchasedItems = await findAllWhere<{ name: string }>(
    "Purchased_Items", { eq: { default_unit_id: unitId }, limit: 1 },
  );
  if (purchasedItems[0]) {
    return { kind: "purchased_items", count: 1, ownerName: purchasedItems[0].name };
  }

  const baseIngredients = await findAllWhere<{ name: string }>(
    "Base_Ingredients", { eq: { base_unit: unitId }, limit: 1 },
  );
  if (baseIngredients[0]) {
    return { kind: "base_ingredients", count: 1, ownerName: baseIngredients[0].name };
  }

  const semiProducts = await findAllWhere<{ name: string }>(
    "Semi_Products", { eq: { base_unit: unitId }, limit: 1 },
  );
  if (semiProducts[0]) {
    return { kind: "semi_products", count: 1, ownerName: semiProducts[0].name };
  }

  const poLines = await findAllWhere<{ purchased_item_id: string }>(
    "Purchase_Order_Lines", { eq: { base_unit: unitId } },
  );
  if (poLines.length > 0) {
    const items = await findAllWhere<{ name: string }>(
      "Purchased_Items", { eq: { id: poLines[0].purchased_item_id }, limit: 1 },
    );
    return { kind: "purchase_order_lines", count: poLines.length, ownerName: items[0]?.name || poLines[0].purchased_item_id };
  }

  const productionItems = await findAllWhere(
    "Production_Items", { eq: { unit_id: unitId } },
  );
  if (productionItems.length > 0) {
    return { kind: "production_items", count: productionItems.length, ownerName: "" };
  }

  return null;
}

export async function deleteUnit(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    const units = await findAllWhere<{ name: string }>("Units", { eq: { id }, limit: 1 });
    const unitName = units[0]?.name || id;

    const blocker = await findUnitDeleteBlocker(id);
    if (blocker) {
      return fail(buildUnitDeleteRestrictionMessage(unitName, blocker));
    }

    await remove("Units", id);
    revalidateTag(getCacheTag("Units"));
    revalidatePath("/admin/inventory/units");
    return ok();
  } catch (error: unknown) {
    // Falls back to describeActionError (not a raw fail(error.message)) for
    // whatever findUnitDeleteBlocker's checks above did not anticipate --
    // e.g. a reference added in the instant between the check and the
    // delete -- so the owner is never shown a raw Postgres string even in
    // that race.
    return describeActionError(error);
  }
}

// --- STOCK (Tồn kho) ---
export async function submitStockAdjustment(data: any, _clientRole?: string, _clientUsername?: string): Promise<ActionResponse> {
  try {
    // Claude code — Phase 4.3: adjustment reason required for audit traceability.
    if (!data?.reason || String(data.reason).trim().length === 0) {
      return fail("Lý do điều chỉnh là bắt buộc");
    }
    // Ignore client-supplied identity and enforce the owner-approved ADMIN policy.
    // Client params remain in the signature for backward compatibility.
    const auth = await requireAdmin();
    if (!auth.ok) return fail(auth.error);
    const username = auth.actor.name;

    const nowIso = new Date().toISOString();
    await submitStockAdjustmentAtomic({
      item_reference: data.item_id,
      theoretical_qty: data.theoretical_qty,
      actual_qty: data.actual_qty,
      difference: data.difference,
      reason: data.reason || "",
      status: "APPROVED",
      created_by_name: username,
      created_by_id: auth.actor.id,
      created_at: nowIso,
      approved_by: username,
      approved_at: nowIso
    });

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

    const nowIso = new Date().toISOString();
    await approveStockAdjustmentAtomic({
      adjustmentId,
      approvedBy: adminUsername,
      approvedAt: nowIso,
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
