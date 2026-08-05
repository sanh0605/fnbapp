"use server";

import { findAll, findAllWhere } from "@/lib/sheets_db";
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
    const { baseIngredients, semiProducts, purchasedItems } = await loadItemNameMaps();
    const nonInventoryBaseIngredientIds = new Set(
      baseIngredients
        .filter(b => b.is_non_inventory === true || b.is_non_inventory === "TRUE")
        .map(b => b.id as string),
    );
    const items = [
      ...baseIngredients
        .filter(b => b.is_non_inventory !== true && b.is_non_inventory !== "TRUE")
        .map(b => ({ itemReference: b.id as string, itemType: "BASE_INGREDIENT" as StocktakeItemType })),
      ...semiProducts.map(s => ({ itemReference: s.id as string, itemType: "SEMI_PRODUCT" as StocktakeItemType })),
      ...purchasedItems
        .filter(p => !nonInventoryBaseIngredientIds.has(p.base_ingredient_id))
        .map(p => ({ itemReference: p.id as string, itemType: "PURCHASED_ITEM" as StocktakeItemType })),
    ];
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
