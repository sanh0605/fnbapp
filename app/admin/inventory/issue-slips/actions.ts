"use server";

import { findAll } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { createManualIssueAtomic, type ManualIssueResult } from "@/lib/manual-issue-transaction";
import { buildPackageLines, type PackageLine, type PurchasedItemConversion } from "@/lib/stocktake-package-lines";
import { computeOnHandByPurchasedItem, filterByC17 } from "@/lib/purchased-item-onhand";

const PATH = "/admin/inventory/issue-slips";

export interface IssueSlipItemView {
  id: string;
  name: string;
  onHand: number;
  unitName: string;
  packageLines: PackageLine[];
}

export async function getIssueSlipFormData(): Promise<IssueSlipItemView[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [purchasedItems, conversions, units, baseIngredients] = await Promise.all([
    findAll("Purchased_Items"),
    findAll("UOM_Conversions"),
    findAll("Units"),
    findAll("Base_Ingredients"),
  ]);
  const unitNameById = new Map<string, string>((units as any[]).map(u => [u.id, u.name]));
  const nameById = new Map<string, string>((purchasedItems as any[]).map(p => [p.id, p.name]));
  // Same exclusion as the stocktake screen (Plan D Gap 1): daily-expense
  // ingredients (đá viên, chanh, quất...) carry is_non_inventory and are
  // never tracked as real stock -- nothing for an issue slip to draw down.
  const nonInventoryBaseIngredientIds = new Set(
    (baseIngredients as any[])
      .filter(b => b.is_non_inventory === true || b.is_non_inventory === "TRUE")
      .map(b => b.id as string),
  );

  const input: PurchasedItemConversion[] = (conversions as any[]).map(c => ({
    conversionId: c.id,
    purchasedItemId: c.purchased_item_id,
    purchasedItemName: nameById.get(c.purchased_item_id) ?? c.purchased_item_id,
    purchasedUnitName: unitNameById.get(c.purchased_unit) ?? c.purchased_unit ?? "",
    baseUnitName: unitNameById.get(c.base_unit) ?? c.base_unit ?? "",
    conversionRate: Number(c.conversion_rate),
    status: c.status,
  }));
  const packageLinesByPurchasedItem = new Map<string, PackageLine[]>();
  for (const line of buildPackageLines(input)) {
    const list = packageLinesByPurchasedItem.get(line.purchasedItemId) ?? [];
    list.push(line);
    packageLinesByPurchasedItem.set(line.purchasedItemId, list);
  }

  const eligiblePurchasedItems = (purchasedItems as any[]).filter(
    p => !nonInventoryBaseIngredientIds.has(p.base_ingredient_id),
  );
  // Same C17 shape as the stocktake screen: an inactive item stays offered
  // while it still has stock to issue out; it is dropped only once it has
  // none left.
  const eligible = await filterByC17(eligiblePurchasedItems);
  const onHandById = await computeOnHandByPurchasedItem();

  return eligible
    .map(p => ({
      id: p.id as string,
      name: p.name as string,
      onHand: onHandById.get(p.id) ?? 0,
      unitName: unitNameById.get(p.default_unit_id) ?? "",
      packageLines: packageLinesByPurchasedItem.get(p.id) ?? [],
    }))
    .filter(item => item.packageLines.length > 0) // nothing to select without at least one active conversion
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function createIssueSlip(input: {
  purchasedItemId: string;
  baseQuantity: number;
  issuedAtIso: string;
  note: string;
}): Promise<ActionResponse & { result?: ManualIssueResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const issuedAt = new Date(input.issuedAtIso);
  if (Number.isNaN(issuedAt.getTime())) {
    return fail("Thời điểm xuất không hợp lệ");
  }
  if (!Number.isFinite(input.baseQuantity) || input.baseQuantity <= 0) {
    return fail("Số lượng xuất phải lớn hơn 0");
  }

  try {
    const result = await createManualIssueAtomic({
      purchasedItemId: input.purchasedItemId,
      baseQuantity: input.baseQuantity,
      issuedAt,
      note: input.note,
      createdById: auth.actor.id,
      createdByName: auth.actor.name,
    });
    revalidatePath(PATH);
    return ok({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
