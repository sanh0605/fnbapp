"use server";

import { findAll, findAllNoCache, findAllWhere, insert, update, remove, generateNewId, getCacheTag } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { formatNumber } from "@/lib/shared/format";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import { findDuplicateActiveName, duplicateNameErrorMessage } from "@/lib/shared/duplicate-name-guard";
import { buildUnitDeleteRestrictionMessage, type UnitBlockerFinding } from "@/lib/catalog/unit-delete-restriction";

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
    // section 2: Item_Categories is cached 30 min, keyed by table, and other
    // screens (Hàng Mua Vào, Kiểm kê...) read it through that cache.
    // revalidatePath below only refreshes this screen.
    revalidateTag(getCacheTag("Item_Categories"), { expire: 0 });
    revalidatePath("/admin/inventory/categories");
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function updateItemCategory(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const system_type = formData.get("system_type") as string;

  if (!name?.trim()) return fail("Vui lòng nhập tên loại");

  try {
    const existingCategories = (await findAll("Item_Categories")) as any[];
    const conflict = findDuplicateActiveName(existingCategories, name, id);
    if (conflict) return fail(duplicateNameErrorMessage(conflict));

    // Past Giá vốn follows the category's system_type; changing it would re-cost issued stock of closed months (cogs.md).
    if (existingCategories.find(c => c.id === id)?.system_type !== system_type) {
      const itemIds = ((await findAll("Purchased_Items")) as any[]).filter(p => p.item_category_id === id).map(p => p.id);
      const issued = itemIds.length > 0 && (await findAllWhere("Stock_Issues", { in: { purchased_item_id: itemIds } })).length > 0;
      if (issued) return fail("Loại này đã có hàng xuất kho. Đổi sang loại khác sẽ làm sai giá vốn các tháng trước.");
    }

    await update("Item_Categories", id, { name, system_type });
    revalidateTag(getCacheTag("Item_Categories"), { expire: 0 });
    revalidatePath("/admin/inventory/categories");
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function deleteItemCategory(formData: FormData): Promise<ActionResponse> {
  // BR-ACCESS-003: permanent deletion is ADMIN only (owner decision 2026-09-08).
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    // Refuse up front with a readable reason instead of the raw foreign key error.
    const [categories, items] = (await Promise.all([
      findAll("Item_Categories"),
      findAll("Purchased_Items"),
    ])) as [{ id: string; name: string }[], { item_category_id?: string }[]];
    const category = categories.find((c) => c.id === id);
    if (!category) return fail("Không tìm thấy phân loại.");
    const itemCount = items.filter((i) => i.item_category_id === id).length;
    if (itemCount > 0) {
      return fail(`Không xoá được ${category.name}: còn ${formatNumber(itemCount)} hàng hoá thuộc phân loại này.`);
    }

    await remove("Item_Categories", id);
    revalidateTag(getCacheTag("Item_Categories"), { expire: 0 });
    revalidatePath("/admin/inventory/categories");
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
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
    // section 2: Units is cached 30 min, keyed by table -- Hàng Mua Vào,
    // Phiếu xuất kho, Kiểm kê all read it through that cache, not this path.
    revalidateTag(getCacheTag("Units"), { expire: 0 });
    revalidatePath("/admin/inventory/units");
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
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
    revalidateTag(getCacheTag("Units"), { expire: 0 });
    revalidatePath("/admin/inventory/units");
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// section A3: RESTRICT foreign keys reference units.id -- checked in this
// order, stopping at the first match, so a unit blocked by more than one
// source still gets one clear sentence rather than a merged one.
// purchase_order_lines is checked FIRST: since 0133 a line has no base_unit of
// its own, so it counts when its conversion's base_unit is this unit, and such
// a conversion would otherwise be reported with a hint (delete the conversion)
// that is a dead end while history still points at it. semi_products and production_items were dropped
// with their tables (migration 0105, 2026-09-28); their checks were removed
// here in step. base_ingredients was dropped earlier (migration 0090,
// 2026-09-01) but this check still queried it until 2026-09-28 -- deleting
// an otherwise-unused unit reached the dead branch and errored with
// "relation does not exist" instead of succeeding; removed here too.
async function findUnitDeleteBlocker(unitId: string): Promise<UnitBlockerFinding | null> {
  const baseConversions = await findAllWhere<{ id: string }>(
    "UOM_Conversions", { eq: { base_unit: unitId } },
  );
  const poLines = baseConversions.length === 0 ? [] : await findAllWhere<{ purchased_item_id: string }>(
    "Purchase_Order_Lines", { in: { conversion_id: baseConversions.map(c => c.id) } },
  );
  if (poLines.length > 0) {
    const items = await findAllWhere<{ name: string }>(
      "Purchased_Items", { eq: { id: poLines[0].purchased_item_id }, limit: 1 },
    );
    return { kind: "purchase_order_lines", count: poLines.length, ownerName: items[0]?.name || poLines[0].purchased_item_id };
  }

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

  return null;
}

export async function deleteUnit(formData: FormData): Promise<ActionResponse> {
  // BR-ACCESS-003: permanent deletion is ADMIN only (owner decision 2026-09-08).
  const auth = await requireOwner();
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
    revalidateTag(getCacheTag("Units"), { expire: 0 });
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

