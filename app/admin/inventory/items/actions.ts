"use server";

import { findAll, findAllWhere, insert, update, updateMany, remove, generateNewId, getCacheTag } from "@/lib/sheets_db";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import type { DBPurchasedItem, DBUOMConversion, DBItemCategory, DBUnit } from "@/types/db";
import { requireAdmin } from "@/lib/auth";
import {
  computeItemPurchaseHistory,
  type ItemPurchaseHistoryRow,
  type RawPurchaseOrder,
  type RawPurchaseOrderLine,
  type RawSupplier,
} from "@/lib/item-purchase-history";
import {
  findDuplicateActiveName,
  duplicateNameErrorMessage,
  findDiacriticStrippedMatch,
  duplicateWarningMessage,
} from "@/lib/duplicate-name-guard";
import { resolveUnitLock, unitChangeIsRefused, unitLockRefusalMessage } from "@/lib/unit-lock";

const SHEET = "Purchased_Items";
const PATH = "/admin/inventory/items";

export async function getItemsData(): Promise<{
  categories: DBItemCategory[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
  unitLockedItemIds: string[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const [categories, items, conversions, allUnits, poLines, stockIssues] = await Promise.all([
      findAll("Item_Categories") as Promise<DBItemCategory[]>,
      findAll(SHEET) as Promise<DBPurchasedItem[]>,
      findAll("UOM_Conversions") as Promise<DBUOMConversion[]>,
      findAll("Units") as Promise<DBUnit[]>,
      findAll("Purchase_Order_Lines") as Promise<any[]>,
      findAll("Stock_Issues") as Promise<any[]>,
    ]);
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

    // section 4:
    // both tables checked, not only purchase_order_lines -- see
    // lib/unit-lock.ts for why.
    const lockedIds = new Set<string>();
    for (const line of poLines) if (line.purchased_item_id) lockedIds.add(line.purchased_item_id);
    for (const issue of stockIssues) if (issue.purchased_item_id) lockedIds.add(issue.purchased_item_id);

    return { categories, items, conversions, units, unitLockedItemIds: Array.from(lockedIds) };
  } catch (error) {
    // this is the exact defect the plan was written to fix -- returning []
    // here is how the owner's real 145-row catalogue rendered as "Chưa có
    // hàng hóa" in production. Rethrow instead; app/error.tsx handles it.
    console.error("Loi getItemsData:", error);
    throw error;
  }
}

export async function getItemPurchaseHistory(itemId: string): Promise<ItemPurchaseHistoryRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [lines, orders, suppliers, units] = await Promise.all([
    findAllWhere<RawPurchaseOrderLine>("Purchase_Order_Lines", { eq: { purchased_item_id: itemId } }),
    findAll("Purchase_Orders") as Promise<RawPurchaseOrder[]>,
    findAll("Suppliers") as Promise<RawSupplier[]>,
    findAll("Units") as Promise<DBUnit[]>,
  ]);

  return computeItemPurchaseHistory(itemId, lines, orders, suppliers, units);
}

export async function addPurchasedItem(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const name = formData.get("name") as string;
  const item_category_id = formData.get("item_category_id") as string;
  const unitsJson = formData.get("units_json") as string;
  const base_unit = formData.get("base_unit") as string;
  const is_non_inventory = formData.get("is_non_inventory") === "true";

  const warningConfirmed = formData.get("duplicate_warning_confirmed") === "true";

  if (!name || !item_category_id) return fail("Vui lòng nhập Tên và chọn Phân loại");

  try {
    // Batch 1, section A2: the app-level half of the duplicate-name guard --
    // the database index (0065_duplicate_name_guard.sql) is what actually
    // stops it, this is what turns that into a message naming the row.
    const existingItems = await findAll("Purchased_Items");
    const conflict = findDuplicateActiveName(existingItems as any[], name);
    if (conflict) return fail(duplicateNameErrorMessage(conflict as any));

    // Batch 1 follow-up, level 2 (BR-CATALOG-001): warn, not refuse, on a
    // diacritic-stripped-only match -- "Ca phe" against an existing item
    // named "Cà phê" is a plausible typo, but stripping is not safe to
    // refuse on outright (section A3b).
    const warning = findDiacriticStrippedMatch(existingItems as any[], name);
    if (warning && !warningConfirmed) {
      return {
        needsDuplicateWarning: {
          conflictId: warning.conflict.id,
          conflictName: warning.conflict.name,
          message: duplicateWarningMessage(warning.conflict as any),
        },
      };
    }
    const wasWarningConfirmed = !!warning && warningConfirmed;

    const id = await generateNewId("Purchased_Items", "SPM");
    await insert("Purchased_Items", {
      id,
      name,
      item_category_id,
      is_non_inventory,
      duplicate_warning_confirmed: wasWarningConfirmed,
      duplicate_warning_confirmed_by: wasWarningConfirmed ? auth.actor.name : null,
      duplicate_warning_confirmed_at: wasWarningConfirmed ? new Date().toISOString() : null,
    });

    // Batch 1, item B, gate 3 of 4 (section B1): base_ingredient_id is no
    // longer required here -- a consumable has none, only base_unit (from
    // its own selector, section B2) and units_json. Requiring
    // base_ingredient_id silently dropped every consumable's conversions,
    // which is the defect this task exists to fix.
    if (unitsJson && base_unit) {
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

    // section 2: Purchased_Items and UOM_Conversions are cached 10 min,
    // keyed by table -- Đơn nhập, Phiếu xuất kho, Kiểm kê all read them
    // through that cache, not this screen's path.
    revalidateTag(getCacheTag("Purchased_Items"));
    revalidateTag(getCacheTag("UOM_Conversions"));
    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/conversions");
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function updatePurchasedItem(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const item_category_id = formData.get("item_category_id") as string;
  const unitsJson = formData.get("units_json") as string;
  const base_unit = formData.get("base_unit") as string;
  const update_history = formData.get("update_history") === "true";
  const is_non_inventory = formData.get("is_non_inventory") === "true";
  const warningConfirmed = formData.get("duplicate_warning_confirmed") === "true";

  try {
    const existingItems = await findAll("Purchased_Items");
    const conflict = findDuplicateActiveName(existingItems as any[], name, id);
    if (conflict) return fail(duplicateNameErrorMessage(conflict as any));

    const warning = findDiacriticStrippedMatch(existingItems as any[], name, id);
    if (warning && !warningConfirmed) {
      return {
        needsDuplicateWarning: {
          conflictId: warning.conflict.id,
          conflictName: warning.conflict.name,
          message: duplicateWarningMessage(warning.conflict as any),
        },
      };
    }
    const wasWarningConfirmed = !!warning && warningConfirmed;

    // section 4:
    // the base unit is free to choose until the item has real history --
    // purchase_order_lines.base_quantity and stock_issues.base_quantity are
    // both stored in it, so changing it silently reinterprets every
    // quantity ever recorded. Nothing at the schema level notices this
    // (unlike the product stop-selling rule), so this is the one real
    // check; runs before any write, keyed to the item as a whole, not to a
    // single conversion row.
    if (unitsJson && base_unit) {
      const [itemConversionsForLock, poLinesForLock, stockIssuesForLock] = await Promise.all([
        findAllWhere<DBUOMConversion>("UOM_Conversions", { eq: { purchased_item_id: id } }),
        findAllWhere("Purchase_Order_Lines", { eq: { purchased_item_id: id } }),
        findAllWhere("Stock_Issues", { eq: { purchased_item_id: id } }),
      ]);
      const lock = resolveUnitLock({
        itemConversions: itemConversionsForLock,
        hasPurchaseOrderLine: poLinesForLock.length > 0,
        hasStockIssue: stockIssuesForLock.length > 0,
      });
      if (unitChangeIsRefused(lock, base_unit)) {
        const allUnits = await findAll("Units");
        const currentUnitName = (allUnits as any[]).find(u => u.id === lock.currentBaseUnitId)?.name || lock.currentBaseUnitId || "";
        return fail(unitLockRefusalMessage(currentUnitName));
      }
    }

    // base_ingredient_id is intentionally not written here. The tier-2
    // group link field was removed from the form 2026-09-01
    // (section 2.2) but the column itself is untouched this batch (section
    // 2.3, step 2) -- omitting the key from this partial update leaves
    // whatever value the row already has, rather than overwriting it with
    // an empty string on every edit.
    await update("Purchased_Items", id, {
      name,
      item_category_id,
      is_non_inventory,
      ...(wasWarningConfirmed
        ? {
            duplicate_warning_confirmed: true,
            duplicate_warning_confirmed_by: auth.actor.name,
            duplicate_warning_confirmed_at: new Date().toISOString(),
          }
        : {}),
    });

    // Batch 1, item B, gate 4 of 4 (section B1): same relaxation as the
    // create path above.
    if (unitsJson && base_unit) {
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
              const linesToUpdate = poLines
                .filter((p: any) => p.purchased_item_id === id && p.unit === oldConv.purchased_unit)
                .map((line: any) => ({ id: line.id, unit: u.name }));
              if (linesToUpdate.length > 0) {
                await updateMany("Purchase_Order_Lines", linesToUpdate);
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

    revalidateTag(getCacheTag("Purchased_Items"));
    revalidateTag(getCacheTag("UOM_Conversions"));
    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/conversions");
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function deletePurchasedItemAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    await remove(SHEET, id);
    revalidateTag(getCacheTag("Purchased_Items"));
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
