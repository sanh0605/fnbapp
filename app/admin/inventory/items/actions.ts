"use server";

import { findAll, findAllWhere, remove, getCacheTag } from "@/lib/db/tables";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { formatNumber } from "@/lib/shared/format";
import type { DBPurchasedItem, DBUOMConversion, DBItemCategory, DBUnit } from "@/types/db";
import { requireAdmin, requireOwner } from "@/lib/auth/auth";
import {
  computeItemPurchaseHistory,
  type ItemPurchaseHistoryRow,
  type RawPurchaseOrder,
  type RawPurchaseOrderLine,
  type RawSupplier,
} from "@/lib/purchasing/item-purchase-history";
import {
  findDuplicateActiveName,
  duplicateNameErrorMessage,
  findDiacriticStrippedMatch,
  duplicateWarningMessage,
} from "@/lib/shared/duplicate-name-guard";
import {
  decideAssetRemoval,
  assetRemovalAskMessage,
  assetRemovalRefusalMessage,
  type RemovableAsset,
} from "@/lib/assets/asset-removal";
import { computeOnHandByPurchasedItem } from "@/lib/stock/purchased-item-onhand";
import { buildItemStockById, type ItemStockDisplay } from "@/lib/stock/item-stock-display";
import { savePurchasedItemAtomic } from "@/lib/catalog/purchased-item-transaction";
import { resolveUnitLock, unitChangeIsRefused, unitLockRefusalMessage } from "@/lib/catalog/unit-lock";

const SHEET = "Purchased_Items";
const PATH = "/admin/inventory/items";
const RATE_REFUSAL = "Hệ số quy đổi phải là số lớn hơn 0.";
const hasBadRate = (units: Array<{ name?: string; conversion_rate?: unknown }>) =>
  units.some(u => u.name && !(Number(u.conversion_rate) > 0 && Number.isFinite(Number(u.conversion_rate))));

type ConversionInput = { id?: string; name?: string; conversion_rate?: string | number };
// Rows without a name or rate are skipped, as the form's blank rows always were.
const writableConversions = (units: ConversionInput[]) =>
  units.flatMap(u => (u.name && u.conversion_rate ? [{ ...(u.id ? { id: u.id } : {}), name: u.name, conversion_rate: u.conversion_rate }] : []));

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
    // lib/catalog/unit-lock.ts for why.
    const lockedIds = new Set<string>();
    for (const line of poLines) if (line.purchased_item_id) lockedIds.add(line.purchased_item_id);
    for (const issue of stockIssues) if (issue.purchased_item_id) lockedIds.add(issue.purchased_item_id);

    return { categories, items, conversions, units, unitLockedItemIds: Array.from(lockedIds) };
  } catch (error) {
    // this is the exact defect the plan was written to fix -- returning []
    // here is how the owner's real 145-row catalogue rendered as "Chưa có
    // hàng hoá" in production. Rethrow instead; app/error.tsx handles it.
    console.error("Loi getItemsData:", error);
    throw error;
  }
}

// BR-CATALOG-004: the stock text for every item, keyed by item id. The figure
// comes from the shared on-hand formula, never a second sum here.
export async function getItemStockById(): Promise<Record<string, ItemStockDisplay>> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [items, categories, conversions, units, onHandById] = await Promise.all([
    findAll(SHEET) as Promise<DBPurchasedItem[]>,
    findAll("Item_Categories") as Promise<DBItemCategory[]>,
    findAll("UOM_Conversions") as Promise<DBUOMConversion[]>,
    findAll("Units") as Promise<DBUnit[]>,
    computeOnHandByPurchasedItem(),
  ]);

  // base_unit is typed optional on DBUOMConversion; a row without one has no unit to show.
  const conversionsWithUnit = conversions.flatMap(c =>
    c.base_unit ? [{ purchased_item_id: c.purchased_item_id, base_unit: c.base_unit, status: c.status }] : [],
  );

  return buildItemStockById({ items, categories, conversions: conversionsWithUnit, units, onHandById });
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
    if (unitsJson && base_unit && hasBadRate(JSON.parse(unitsJson))) return fail(RATE_REFUSAL);

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

    // Item and conversions are written in one Postgres transaction (0124).
    // base_ingredient_id is no longer required: a consumable has none, only
    // base_unit and units_json.
    await savePurchasedItemAtomic({
      itemId: null,
      name,
      categoryId: item_category_id,
      isNonInventory: is_non_inventory,
      warningConfirmedBy: wasWarningConfirmed ? auth.actor.name : null,
      baseUnit: base_unit,
      conversions: unitsJson && base_unit ? writableConversions(JSON.parse(unitsJson)) : null,
      retireAssetIds: [],
    });

    // section 2: Purchased_Items and UOM_Conversions are cached 10 min,
    // keyed by table -- Đơn nhập, Phiếu xuất kho, Kiểm kê all read them
    // through that cache, not this screen's path.
    revalidateTag(getCacheTag("Purchased_Items"), { expire: 0 });
    revalidateTag(getCacheTag("UOM_Conversions"), { expire: 0 });
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
  const is_non_inventory = formData.get("is_non_inventory") === "true";
  const warningConfirmed = formData.get("duplicate_warning_confirmed") === "true";
  const assetRemovalConfirmed = formData.get("asset_removal_confirmed") === "true";

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

    // Plan 2026-10-03-go-tai-san-khi-doi-loai (BR-COGS-008): an item saved
    // with a category that is not EQUIPMENT must not keep depreciating. State
    // based, so a half-failed save asks again on retry. Decided before any
    // write; refuse and ask both leave the database untouched.
    const itemCategories = (await findAll("Item_Categories")) as Array<{ id: string; system_type?: string }>;
    const systemType = itemCategories.find(c => c.id === item_category_id)?.system_type ?? null;

    // Past Giá vốn counts an item's issues only while it is costed; changing that state either way would add or drop them from closed months (cogs.md).
    const current = (existingItems as any[]).find(p => p.id === id);
    if (current) {
      const wasCosted = itemCategories.find(c => c.id === current.item_category_id)?.system_type !== "EQUIPMENT" && current.is_non_inventory !== true;
      const willBeCosted = systemType !== "EQUIPMENT" && !is_non_inventory;
      if (wasCosted !== willBeCosted && (await findAllWhere("Stock_Issues", { eq: { purchased_item_id: id } })).length > 0) {
        return fail("Hàng này đã có phiếu xuất. Đổi loại sẽ làm sai giá vốn các tháng trước.");
      }
    }
    let assetsToRetire: RemovableAsset[] = [];
    if (systemType !== null && systemType !== "EQUIPMENT") {
      const itemAssets = await findAllWhere<RemovableAsset>("assets", { eq: { purchased_item_id: id } });
      const itemDisposals = itemAssets.length > 0
        ? await findAllWhere<{ asset_id: string }>("asset_disposals", { in: { asset_id: itemAssets.map(a => a.id) } })
        : [];
      const decision = decideAssetRemoval({ systemType, assets: itemAssets, disposals: itemDisposals });
      if (decision.kind === "refuse") return fail(assetRemovalRefusalMessage(decision.assetIds));
      if (decision.kind === "ask") {
        if (!assetRemovalConfirmed) {
          return { needsAssetRemoval: { message: assetRemovalAskMessage(decision) } };
        }
        assetsToRetire = decision.assets;
      }
    }

    // Audit A6: the conversion refusal is decided here, before the first write,
    // so a refusal never leaves the item, its assets or some conversions saved
    // and the rest not. The single save below only writes.
    let newUnits: ConversionInput[] = [];
    if (unitsJson && base_unit) {
      newUnits = JSON.parse(unitsJson);
      if (hasBadRate(newUnits)) return fail(RATE_REFUSAL);
      const allConversions = await findAll("UOM_Conversions");
      const poLines = await findAll("Purchase_Order_Lines");
      const existingConversions = allConversions.filter((c: any) => c.purchased_item_id === id);
      const referencedConversionIds = new Set(
        poLines
          .filter((line: any) => line.conversion_id)
          .map((line: any) => line.conversion_id)
      );
      for (const u of newUnits) {
        if (!u.name || !u.conversion_rate || !u.id) continue;
        const oldConv = existingConversions.find((c: any) => c.id === u.id);
        const coreFieldsChanged = oldConv && (
          oldConv.purchased_unit !== u.name ||
          String(oldConv.conversion_rate) !== String(u.conversion_rate) ||
          oldConv.base_unit !== base_unit
        );
        if (referencedConversionIds.has(u.id) && coreFieldsChanged) {
          return fail("Một quy đổi đã được dùng trong phiếu nhập lịch sử. Hãy tạo quy đổi mới thay vì sửa trực tiếp.");
        }
      }
    }

    // Item, asset retirements and conversions go in one Postgres transaction
    // (0124); it removes or retires the conversions the form no longer lists.
    // base_ingredient_id is intentionally not sent: it keeps its stored value.
    await savePurchasedItemAtomic({
      itemId: id,
      name,
      categoryId: item_category_id,
      isNonInventory: is_non_inventory,
      warningConfirmedBy: wasWarningConfirmed ? auth.actor.name : null,
      baseUnit: base_unit,
      conversions: unitsJson && base_unit ? writableConversions(newUnits) : null,
      retireAssetIds: assetsToRetire.map(a => a.id),
    });

    revalidateTag(getCacheTag("Purchased_Items"), { expire: 0 });
    revalidateTag(getCacheTag("UOM_Conversions"), { expire: 0 });
    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/conversions");
    if (assetsToRetire.length > 0) {
      revalidatePath("/admin/inventory/assets");
      revalidatePath("/admin/reports/pnl");
    }
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function deletePurchasedItemAction(formData: FormData): Promise<ActionResponse> {
  // BR-ACCESS-003: permanent deletion is ADMIN only (owner decision 2026-09-08).
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  try {
    // Refuse up front with a readable reason; the RESTRICT foreign keys
    // would otherwise only surface a generic error.
    const [items, poLines, stockIssues, conversions, assets] = (await Promise.all([
      findAll(SHEET),
      findAll("Purchase_Order_Lines"),
      findAll("Stock_Issues"),
      findAll("UOM_Conversions"),
      findAll("assets"),
    ])) as [DBPurchasedItem[], { purchased_item_id?: string }[], { purchased_item_id?: string }[], { purchased_item_id?: string }[], { purchased_item_id?: string }[]];
    const item = items.find((i) => i.id === id);
    if (!item) return fail("Không tìm thấy hàng hoá.");
    // No named inner arrow here: lib/auth/delete-guard.test.ts would take it
    // for the unit that owns the remove() call below.
    const uses = (
      [
        [poLines, "dòng phiếu nhập"],
        [stockIssues, "lần xuất kho"],
        [conversions, "quy đổi"],
        [assets, "tài sản"],
      ] as Array<[{ purchased_item_id?: string }[], string]>
    ).map(([rows, label]): [number, string] => [rows.filter((r) => r.purchased_item_id === id).length, label]);
    const parts = uses.filter(([n]) => n > 0).map(([n, label]) => `${formatNumber(n)} ${label}`);
    if (parts.length > 0) {
      return fail(`Không xoá được ${item.name}: đã có ${parts.join(", ")}.`);
    }

    await remove(SHEET, id);
    revalidateTag(getCacheTag("Purchased_Items"), { expire: 0 });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
