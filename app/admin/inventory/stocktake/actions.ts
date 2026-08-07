"use server";

import { findAll, findAllNoCache, findAllWhere } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import {
  openStocktakeSessionAtomic,
  saveStocktakeLineAtomic,
  cancelStocktakeSessionAtomic,
  applyStocktakeSessionAtomic,
  type StocktakeItemType,
  type StocktakeApplyResult,
} from "@/lib/stocktake-transaction";

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
}

export interface StocktakeSessionView {
  id: string;
  status: "OPEN" | "CONFIRMED" | "CANCELLED";
  createdByName: string;
  createdAt: string;
  notes: string;
  lines: StocktakeLineView[];
}

async function loadItemNameMaps() {
  const [baseIngredients, semiProducts, purchasedItems, units] = await Promise.all([
    findAll("Base_Ingredients"),
    findAll("Semi_Products"),
    findAll("Purchased_Items"),
    findAll("Units"),
  ]);
  const unitNameById = new Map<string, string>((units as any[]).map(u => [u.id, u.name]));
  const nameById = new Map<string, string>();
  const unitNameByItemId = new Map<string, string>();
  for (const item of [...(baseIngredients as any[]), ...(semiProducts as any[])]) {
    nameById.set(item.id, item.name);
    unitNameByItemId.set(item.id, unitNameById.get(item.base_unit) ?? item.base_unit ?? "");
  }
  for (const item of purchasedItems as any[]) {
    nameById.set(item.id, item.name);
    unitNameByItemId.set(item.id, unitNameById.get(item.default_unit_id) ?? item.default_unit_id ?? "");
  }
  return {
    nameById,
    unitNameByItemId,
    baseIngredients: baseIngredients as any[],
    semiProducts: semiProducts as any[],
    purchasedItems: purchasedItems as any[],
  };
}

// Plan D C17: an inactive purchased item stays offered for counting while
// its computed on-hand (purchased minus issued so far, the same formula
// apply_stocktake_session_atomic itself uses at
// 0053_stocktake_purchased_items.sql:244-256) is still above zero. Dropping
// it the moment it goes inactive would freeze its ingredient's quantity
// forever -- S1 can never be satisfied again -- and the leftover would hide
// inside the ingredient total with no way to correct it. Only queries
// purchases/issues when an inactive item actually exists; today (2026-08-07)
// all 52 purchased items are ACTIVE, so this is a landmine guard, not a live
// path.
async function filterByC17(purchasedItems: any[]): Promise<any[]> {
  const active = purchasedItems.filter(p => p.status === "ACTIVE");
  const inactive = purchasedItems.filter(p => p.status !== "ACTIVE");
  if (inactive.length === 0) return active;

  const [purchaseLines, purchaseOrders, issues] = await Promise.all([
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Stock_Issues"),
  ]);
  const completedOrderIds = new Set(
    (purchaseOrders as any[]).filter(o => o.status === "COMPLETED").map(o => o.id),
  );
  const purchasedById = new Map<string, number>();
  for (const line of purchaseLines as any[]) {
    if (!completedOrderIds.has(line.purchase_order_id)) continue;
    purchasedById.set(
      line.purchased_item_id,
      (purchasedById.get(line.purchased_item_id) ?? 0) + Number(line.base_quantity),
    );
  }
  const issuedById = new Map<string, number>();
  for (const issue of issues as any[]) {
    issuedById.set(
      issue.purchased_item_id,
      (issuedById.get(issue.purchased_item_id) ?? 0) + Number(issue.base_quantity),
    );
  }

  const stillOnHand = inactive.filter(p => {
    const onHand = (purchasedById.get(p.id) ?? 0) - (issuedById.get(p.id) ?? 0);
    return onHand > 0;
  });

  return [...active, ...stillOnHand];
}

export async function getStocktakeSessionData(): Promise<StocktakeSessionView | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const openSessions = await findAllWhere<any>("stocktake_sessions", { eq: { status: "OPEN" }, limit: 1 });
  const session = openSessions[0];
  if (!session) return null;

  const [lines, { nameById, unitNameByItemId }] = await Promise.all([
    findAllWhere<any>("stocktake_lines", { eq: { session_id: session.id } }),
    loadItemNameMaps(),
  ]);

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
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName, "vi")),
  };
}

export async function startStocktakeSession(notes?: string): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  try {
    const { baseIngredients, purchasedItems } = await loadItemNameMaps();
    const nonInventoryBaseIngredientIds = new Set(
      baseIngredients
        .filter(b => b.is_non_inventory === true || b.is_non_inventory === "TRUE")
        .map(b => b.id as string),
    );
    // Plan D Gap 1: a new session no longer offers BASE_INGREDIENT lines at
    // all. Counting by generic ingredient and counting by purchased item fed
    // different systems (stock_ledger vs stock_issues) with nothing on
    // screen telling them apart -- the owner chose purchased item (Plan D
    // section 3, decision 1). Semi-products carry no stock and no value
    // (BR-INV-006) and were never offered here.
    const eligiblePurchasedItems = purchasedItems.filter(
      p => !nonInventoryBaseIngredientIds.has(p.base_ingredient_id),
    );
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
