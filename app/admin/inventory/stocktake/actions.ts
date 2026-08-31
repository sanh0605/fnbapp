"use server";

import { findAll, findAllWhere } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireOwner } from "@/lib/auth";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import {
  openStocktakeSessionAtomic,
  saveStocktakeLineAtomic,
  cancelStocktakeSessionAtomic,
  applyStocktakeSessionAtomic,
  reverseStocktakeSessionAtomic,
  type StocktakeItemType,
  type StocktakeApplyResult,
  type StocktakeReversalResult,
} from "@/lib/stocktake-transaction";
import { buildPackageLines, type PackageLine, type PurchasedItemConversion } from "@/lib/stocktake-package-lines";
import { filterByC17 } from "@/lib/purchased-item-onhand";

const PATH = "/admin/inventory/stocktake";

export interface StocktakeLineView {
  id: string;
  itemReference: string;
  itemType: StocktakeItemType;
  itemName: string;
  unitName: string;
  countedQty: number | null;
  theoreticalAtCount: number | null;
  countedAt: string | null;
  // Plan D D6: only set for PURCHASED_ITEM lines in a session opened after
  // D4/D6 landed. A legacy BASE_INGREDIENT line from a session opened
  // before D6 (kept alive per C8/C16) has no conversions to show and falls
  // back to the old single base-unit input.
  packageLines: PackageLine[];
}

export interface StocktakeSessionView {
  id: string;
  status: "OPEN" | "CONFIRMED" | "CANCELLED" | "REVERSED";
  createdByName: string;
  createdAt: string;
  notes: string;
  lines: StocktakeLineView[];
}

// Plan D D14: the last CONFIRMED session, shown so the owner can undo it
// (U1-U6) even after no session is OPEN any more. Lightweight -- reversal is
// whole-session, so there is nothing to show per line.
export interface RecentConfirmedStocktakeSessionView {
  id: string;
  confirmedByName: string;
  confirmedAt: string;
  notes: string;
  hasOpenSessionBlocking: boolean;
}

async function loadItemNameMaps() {
  // base_ingredients dropped 2026-09-01
  // (docs/superpowers/plans/2026-09-01-delete-tier-2-ingredient-groups.md).
  // Verified live before removing: every stocktake_lines row in production
  // is item_type PURCHASED_ITEM (50/50) -- no BASE_INGREDIENT-type line has
  // ever existed, so there is no historical name this map needs to resolve
  // through that table.
  const [semiProducts, purchasedItems, units, itemCategories] = await Promise.all([
    findAll("Semi_Products"),
    findAll("Purchased_Items"),
    findAll("Units"),
    findAll("Item_Categories"),
  ]);
  const unitNameById = new Map<string, string>((units as any[]).map(u => [u.id, u.name]));
  const nameById = new Map<string, string>();
  const unitNameByItemId = new Map<string, string>();
  for (const item of semiProducts as any[]) {
    nameById.set(item.id, item.name);
    unitNameByItemId.set(item.id, unitNameById.get(item.base_unit) ?? item.base_unit ?? "");
  }
  for (const item of purchasedItems as any[]) {
    nameById.set(item.id, item.name);
    unitNameByItemId.set(item.id, unitNameById.get(item.default_unit_id) ?? item.default_unit_id ?? "");
  }
  return {
    nameById,
    unitNameById,
    unitNameByItemId,
    semiProducts: semiProducts as any[],
    purchasedItems: purchasedItems as any[],
    itemCategories: itemCategories as any[],
  };
}

// Plan D D6: one input per ACTIVE conversion (lib/stocktake-package-lines.ts,
// D3), grouped under the purchased item that owns them. Built here, once,
// from the same UOM_Conversions table -- the screen must reuse this
// function's labels rather than growing a second label-generator: the same
// string produced two different ways is exactly the defect that broke
// section 9's own worked example earlier in this plan.
async function loadPackageLinesByPurchasedItem(
  nameById: Map<string, string>,
  unitNameById: Map<string, string>,
): Promise<Map<string, PackageLine[]>> {
  const conversions = (await findAll("UOM_Conversions")) as any[];

  const input: PurchasedItemConversion[] = conversions.map(c => ({
    conversionId: c.id,
    purchasedItemId: c.purchased_item_id,
    purchasedItemName: nameById.get(c.purchased_item_id) ?? c.purchased_item_id,
    purchasedUnitName: unitNameById.get(c.purchased_unit) ?? c.purchased_unit ?? "",
    baseUnitName: unitNameById.get(c.base_unit) ?? c.base_unit ?? "",
    conversionRate: Number(c.conversion_rate),
    status: c.status,
    purchaseOnly: c.purchase_only === true,
  }));

  const byPurchasedItem = new Map<string, PackageLine[]>();
  for (const line of buildPackageLines(input)) {
    const list = byPurchasedItem.get(line.purchasedItemId) ?? [];
    list.push(line);
    byPurchasedItem.set(line.purchasedItemId, list);
  }
  return byPurchasedItem;
}

// Plan D D14, U1-U6: the most recently CONFIRMED session, so it can be
// undone even after it stops being the OPEN session shown above. Read-only
// -- requireAdmin() is enough to see it (both ADMIN and MANAGER already see
// everything else on this screen); the stricter owner-only guard applies
// only to the reversal action itself.
export async function getLastConfirmedStocktakeSession(): Promise<RecentConfirmedStocktakeSessionView | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  // Production bug 2026-08-09: this used order.column = "confirmed_at".
  // findAllWhere (lib/sheets_db.ts) only supports 'id' or 'created_at' and
  // throws on anything else -- every load of this page failed, regardless
  // of data. created_at is not a workaround, it is equivalent here: at most
  // one session can ever be OPEN at a time (idx_stocktake_sessions_one_open,
  // 0036), so a session cannot even be created until the previous one has
  // left OPEN status -- created_at order among sessions already matches
  // confirmed_at order for the ones that reach CONFIRMED.
  const [confirmedSessions, openSessions] = await Promise.all([
    findAllWhere<any>("stocktake_sessions", {
      eq: { status: "CONFIRMED" },
      order: { column: "created_at", ascending: false },
      limit: 1,
    }),
    findAllWhere<any>("stocktake_sessions", { eq: { status: "OPEN" }, limit: 1 }),
  ]);
  const session = confirmedSessions[0];
  if (!session) return null;

  return {
    id: session.id,
    confirmedByName: session.confirmed_by_name,
    confirmedAt: session.confirmed_at,
    notes: session.notes ?? "",
    hasOpenSessionBlocking: openSessions.length > 0,
  };
}

export async function getStocktakeSessionData(): Promise<StocktakeSessionView | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const openSessions = await findAllWhere<any>("stocktake_sessions", { eq: { status: "OPEN" }, limit: 1 });
  const session = openSessions[0];
  if (!session) return null;

  const [lines, { nameById, unitNameById, unitNameByItemId }] = await Promise.all([
    findAllWhere<any>("stocktake_lines", { eq: { session_id: session.id } }),
    loadItemNameMaps(),
  ]);
  const packageLinesByPurchasedItem = await loadPackageLinesByPurchasedItem(nameById, unitNameById);

  return {
    id: session.id,
    status: session.status,
    createdByName: session.created_by_name,
    createdAt: session.created_at,
    notes: session.notes ?? "",
    lines: lines
      .map(line => ({
        id: line.id,
        itemReference: line.item_reference,
        itemType: line.item_type as StocktakeItemType,
        itemName: nameById.get(line.item_reference) ?? line.item_reference,
        unitName: unitNameByItemId.get(line.item_reference) ?? "",
        countedQty: line.counted_qty !== null ? Number(line.counted_qty) : null,
        theoreticalAtCount: line.theoretical_at_count !== null ? Number(line.theoretical_at_count) : null,
        countedAt: line.counted_at,
        packageLines: line.item_type === "PURCHASED_ITEM"
          ? (packageLinesByPurchasedItem.get(line.item_reference) ?? [])
          : [],
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName, "vi")),
  };
}

export async function startStocktakeSession(notes?: string): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const { purchasedItems, itemCategories } = await loadItemNameMaps();
    // 2026-08-26 (docs/superpowers/plans/2026-08-26-equipment-out-of-stocktake.md):
    // equipment is never stocktaken -- a fixed property of the EQUIPMENT
    // category (CLAUDE.md section 7), not a per-item judgment. Excluding by
    // category rather than by is_non_inventory keeps that flag free for its
    // other meaning (the future batch-5 "mua dùng ngay" expense line,
    // OPEN-ITEMS 59): equipment must never be expensed on purchase, since it
    // is always depreciated instead, and ticking it per item would let the
    // two collide.
    const equipmentCategoryIds = new Set(
      itemCategories.filter(c => c.system_type === "EQUIPMENT").map(c => c.id as string),
    );
    // Plan D Gap 1: a new session no longer offers BASE_INGREDIENT lines at
    // all. Counting by generic ingredient and counting by purchased item fed
    // different systems (stock_ledger vs stock_issues) with nothing on
    // screen telling them apart -- the owner chose purchased item (Plan D
    // section 3, decision 1). Semi-products carry no stock and no value
    // (BR-INV-006) and were never offered here.
    //
    // 2026-09-01 (docs/superpowers/plans/2026-09-01-read-non-inventory-flag-from-items.md):
    // used to also exclude an item whose linked base_ingredient was
    // flagged. Dropped, not replaced -- docs/superpowers/plans/2026-08-31-
    // move-non-inventory-flag-to-items.md already moved that flag onto
    // every affected item directly (SPM-005, SPM-052), so the item's own
    // flag below covers the same ground the group flag used to. Confirmed
    // live before removing: the eligible set is identical with or without
    // the group check, 69 items either way.
    const eligiblePurchasedItems = purchasedItems.filter(p => {
      const ownFlagged = p.is_non_inventory === true || p.is_non_inventory === "TRUE";
      const isEquipment = equipmentCategoryIds.has(p.item_category_id);
      return !ownFlagged && !isEquipment;
    });
    const includedPurchasedItems = await filterByC17(eligiblePurchasedItems);
    const items = includedPurchasedItems.map(p => ({
      itemReference: p.id as string,
      itemType: "PURCHASED_ITEM" as StocktakeItemType,
    }));
    if (items.length === 0) return fail("Không có mặt hàng nào để kiểm kê");

    await openStocktakeSessionAtomic({
      createdById: auth.actor.id,
      createdByName: auth.actor.name,
      items,
      notes,
    });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function saveStocktakeLine(lineId: string, countedQty: number): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    await saveStocktakeLineAtomic({ lineId, countedQty });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function cancelStocktakeSession(sessionId: string): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    await cancelStocktakeSessionAtomic(sessionId);
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function getStocktakeConfirmPreview(
  sessionId: string,
): Promise<ActionResponse & { preview?: StocktakeApplyResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const preview = await applyStocktakeSessionAtomic({
      sessionId,
      confirmedById: auth.actor.id,
      confirmedByName: auth.actor.name,
      dryRun: true,
    });
    if (!preview.dryRun || preview.status !== "OPEN") {
      throw new Error("Stocktake preview did not return a dry run");
    }
    return ok({ preview });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

export async function confirmStocktakeSession(
  sessionId: string,
  expectedPlanHash: string,
): Promise<ActionResponse & { result?: StocktakeApplyResult }> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (!expectedPlanHash.trim()) {
    return fail("Stocktake preview is required before confirmation");
  }

  try {
    const result = await applyStocktakeSessionAtomic({
      sessionId,
      confirmedById: auth.actor.id,
      confirmedByName: auth.actor.name,
      dryRun: false,
      expectedPlanHash,
    });
    if (result.dryRun || result.status !== "CONFIRMED") {
      throw new Error("Stocktake confirmation did not apply the session");
    }
    revalidatePath(PATH);
    return ok({ result });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}

// Plan D D14, U1-U6: undo a confirmed stocktake session. Owner-only
// (requireOwner, not requireAdmin) -- the one action in the system stricter
// than the usual ADMIN+MANAGER guard, because this is the check on the
// person who counted.
export async function reverseConfirmedStocktakeSession(
  sessionId: string,
  reason: string,
): Promise<ActionResponse & { result?: StocktakeReversalResult }> {
  const auth = await requireOwner();
  if (!auth.ok) return fail(auth.error);
  if (!reason.trim()) {
    return fail("Lý do huỷ phiên kiểm kê là bắt buộc");
  }

  try {
    const result = await reverseStocktakeSessionAtomic({
      sessionId,
      reason: reason.trim(),
      reversedById: auth.actor.id,
      reversedByName: auth.actor.name,
    });
    revalidatePath(PATH);
    return ok({ result });
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
