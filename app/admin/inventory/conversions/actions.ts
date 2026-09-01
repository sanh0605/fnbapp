"use server";

import { findAll, findAllWhere, insert, update, remove, generateNewId, getCacheTag } from "@/lib/sheets_db";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import type { DBUOMConversion, DBPurchasedItem, DBUnit } from "@/types/db";
import { requireAdmin } from "@/lib/auth";
import { wouldLeaveNoCountableConversion } from "@/lib/conversion-countability";
import { resolveUnitLock, unitChangeIsRefused, unitLockRefusalMessage } from "@/lib/unit-lock";

// docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md section 4:
// the same check as app/admin/inventory/items/actions.ts's
// updatePurchasedItem -- this screen used to be "safe" only because the
// base unit here was always derived from the item's tier-2 group, so every
// row agreed by construction (verified at the line before this task:
// ConversionForm.tsx always read baseIngredient.base_unit). Once that
// derivation is removed (section 5.2), a base_unit submitted here needs its
// own check -- addConversion in particular had none at all before this.
async function checkUnitLockBeforeSave(
  purchasedItemId: string,
  submittedBaseUnit: string,
): Promise<string | null> {
  const [itemConversions, poLines, stockIssues] = await Promise.all([
    findAllWhere<DBUOMConversion>("UOM_Conversions", { eq: { purchased_item_id: purchasedItemId } }),
    findAllWhere("Purchase_Order_Lines", { eq: { purchased_item_id: purchasedItemId } }),
    findAllWhere("Stock_Issues", { eq: { purchased_item_id: purchasedItemId } }),
  ]);
  const lock = resolveUnitLock({
    itemConversions,
    hasPurchaseOrderLine: poLines.length > 0,
    hasStockIssue: stockIssues.length > 0,
  });
  if (!unitChangeIsRefused(lock, submittedBaseUnit)) return null;

  const units = await findAll("Units");
  const currentUnitName = (units as any[]).find(u => u.id === lock.currentBaseUnitId)?.name || lock.currentBaseUnitId || "";
  return unitLockRefusalMessage(currentUnitName);
}

const SHEET = "UOM_Conversions";
const PATH = "/admin/inventory/conversions";

function readConversionText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeConversionRate(value: string): string | null {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? String(rate) : null;
}

// Plan D D15, P4-P6: refuse to leave a purchased item with zero countable
// (ACTIVE, not purchase_only) conversions -- the C17-shaped freezing trap
// the owner flagged before any migration was written. excludeConversionId
// is the conversion being saved (omitted for a brand-new one via
// addConversion, since it cannot yet be "another" conversion of itself).
async function checkStillCountableAfterSave(
  purchasedItemId: string,
  savingPurchaseOnly: boolean,
  excludeConversionId: string | null,
): Promise<string | null> {
  if (!savingPurchaseOnly) return null; // P7: turning it off never needs this check

  const [allConversions, items] = await Promise.all([
    findAll(SHEET) as Promise<DBUOMConversion[]>,
    findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
  ]);
  const otherActivePurchaseOnly = allConversions
    .filter(c =>
      c.purchased_item_id === purchasedItemId &&
      c.status === "ACTIVE" &&
      c.id !== excludeConversionId,
    )
    .map(c => c.purchase_only === true);

  if (!wouldLeaveNoCountableConversion(otherActivePurchaseOnly, true)) return null;

  const itemName = items.find(i => i.id === purchasedItemId)?.name ?? purchasedItemId;
  return (
    `Không thể đánh dấu quy đổi này là "chỉ là cách mua" -- đây là quy đổi cuối cùng còn đếm được của ` +
    `${itemName}. Nếu đánh dấu, tồn kho nguyên liệu chứa mặt hàng này sẽ không bao giờ kiểm kê được nữa.`
  );
}

export async function getConversionsData(): Promise<{
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    // docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md section
    // 5.2: Base_Ingredients is no longer fetched here -- ConversionForm.tsx
    // used to derive base_unit from an item's linked group; now it reads
    // the item's own conversions instead, so this screen has no remaining
    // use for the group data at all.
    const [items, conversions, allUnits] = await Promise.all([
      findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
      findAll(SHEET) as Promise<DBUOMConversion[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { items, conversions, units };
  } catch (error) {
    // docs/superpowers/plans/2026-08-27-stop-reporting-failures-as-empty.md:
    // rethrow instead of a fabricated empty result -- app/error.tsx handles it.
    console.error("Loi getConversionsData:", error);
    throw error;
  }
}

export async function addConversion(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const purchased_item_id = readConversionText(formData, "purchased_item_id");
  const purchased_unit = readConversionText(formData, "purchased_unit");
  const rawConversionRate = readConversionText(formData, "conversion_rate");
  const base_unit = readConversionText(formData, "base_unit");
  const purchase_only = readConversionText(formData, "purchase_only") === "true";

  if (!purchased_item_id || !purchased_unit || !rawConversionRate || !base_unit) {
    return fail("Thiếu thông tin quy đổi");
  }
  const conversion_rate = normalizeConversionRate(rawConversionRate);
  if (!conversion_rate) return fail("Tỷ lệ quy đổi phải là số hữu hạn lớn hơn 0");

  try {
    const unitLockError = await checkUnitLockBeforeSave(purchased_item_id, base_unit);
    if (unitLockError) return fail(unitLockError);

    // D15/P4: a brand-new conversion has no "other" copy of itself yet, so
    // excludeConversionId is null -- the check runs against every existing
    // ACTIVE conversion of the item as-is.
    const countableError = await checkStillCountableAfterSave(purchased_item_id, purchase_only, null);
    if (countableError) return fail(countableError);

    const id = await generateNewId(SHEET, "QD");
    await insert(SHEET, {
      id,
      purchased_item_id,
      purchased_unit,
      conversion_rate,
      base_unit,
      status: "ACTIVE",
      purchase_only,
      created_at: new Date().toISOString(),
    });
    // docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
    // section 1.3/2: UOM_Conversions is cached 10 min, keyed by table --
    // Hàng Mua Vào, Đơn nhập, Kiểm kê all read it through that cache. This
    // file was missed by that plan's own file-list measurement (the dead
    // duplicate addConversion/updateConversion in
    // app/admin/inventory/actions.ts was counted instead of this, the real,
    // live one) -- fixed here as the same class of bug, not a new one.
    revalidateTag(getCacheTag("UOM_Conversions"));
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function updateConversion(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = readConversionText(formData, "id");
  const purchased_item_id = readConversionText(formData, "purchased_item_id");
  const purchased_unit = readConversionText(formData, "purchased_unit");
  const rawConversionRate = readConversionText(formData, "conversion_rate");
  const base_unit = readConversionText(formData, "base_unit");
  const purchase_only = readConversionText(formData, "purchase_only") === "true";
  const update_history = formData.get("update_history") === "true";

  if (!id || !purchased_item_id || !purchased_unit || !rawConversionRate || !base_unit) {
    return fail("Thiếu thông tin");
  }
  const conversion_rate = normalizeConversionRate(rawConversionRate);
  if (!conversion_rate) return fail("Tỷ lệ quy đổi phải là số hữu hạn lớn hơn 0");

  // D15/P4-P6: exclude this conversion's own id -- otherwise it would count
  // as "another" countable conversion of itself and the guard could never
  // fire.
  const countableError = await checkStillCountableAfterSave(purchased_item_id, purchase_only, id);
  if (countableError) return fail(countableError);

  const unitLockError = await checkUnitLockBeforeSave(purchased_item_id, base_unit);
  if (unitLockError) return fail(unitLockError);

  try {
    const [allConvs, poLines] = await Promise.all([
      findAll(SHEET),
      findAll("Purchase_Order_Lines"),
    ]);
    const oldConv = allConvs.find((c: DBUOMConversion) => c.id === id);
    const isReferenced = poLines.some((line: any) => line.conversion_id === id);
    const coreFieldsChanged = oldConv && (
      oldConv.purchased_item_id !== purchased_item_id ||
      oldConv.purchased_unit !== purchased_unit ||
      String(oldConv.conversion_rate) !== String(conversion_rate) ||
      oldConv.base_unit !== base_unit
    );

    if (isReferenced && coreFieldsChanged) {
      return fail("Quy đổi này đã được dùng trong phiếu nhập lịch sử. Hãy tạo quy đổi mới thay vì sửa trực tiếp.");
    }

    // Preserve update_history logic for unused conversions only.
    if (update_history) {
      if (oldConv && oldConv.purchased_unit !== purchased_unit) {
        for (const line of poLines) {
          if (line.purchased_item_id === purchased_item_id && line.unit === oldConv.purchased_unit) {
            await update("Purchase_Order_Lines", line.id, { ...line, unit: purchased_unit });
          }
        }
      }
    }

    await update(SHEET, id, { purchased_item_id, purchased_unit, conversion_rate, base_unit, purchase_only });
    revalidateTag(getCacheTag("UOM_Conversions"));
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function deleteConversionAction(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  if (!id) return fail("ID không hợp lệ");

  try {
    const poLines = await findAll("Purchase_Order_Lines");
    const isReferenced = poLines.some((line: any) => line.conversion_id === id);
    if (isReferenced) {
      await update(SHEET, id, { status: "INACTIVE" });
    } else {
      await remove(SHEET, id);
    }
    revalidateTag(getCacheTag("UOM_Conversions"));
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
