"use server";

import { findAll, findAllWhere } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { resolveActor } from "@/lib/auth";
import { SHIFT_CHECKED_ITEM_NAMES } from "@/lib/shift-stock-check-config";
import {
  openShiftStockCheckAtomic,
  closeShiftStockCheckAtomic,
  type ShiftRow,
  type ShiftStockCheckResultRow,
} from "@/lib/shift-stock-check-transaction";

export type CheckedItem = {
  itemReference: string;
  name: string;
  unitName: string;
};

// Resolves SHIFT_CHECKED_ITEM_NAMES to real items by name, across both
// Semi_Products and Base_Ingredients. A configured name with no matching
// item yet is silently skipped -- see lib/shift-stock-check-config.ts.
export async function getCheckedItems(): Promise<CheckedItem[]> {
  const [semiProducts, baseIngredients, units] = await Promise.all([
    findAll("Semi_Products"),
    findAll("Base_Ingredients"),
    findAll("Units"),
  ]);
  const unitNameById = new Map<string, string>((units as any[]).map((u) => [u.id, u.name]));
  const byName = new Map<string, CheckedItem>();
  for (const item of [...(semiProducts as any[]), ...(baseIngredients as any[])]) {
    if (!byName.has(item.name)) {
      byName.set(item.name, {
        itemReference: item.id,
        name: item.name,
        unitName: unitNameById.get(item.base_unit) ?? item.base_unit ?? "",
      });
    }
  }
  return SHIFT_CHECKED_ITEM_NAMES.map((name) => byName.get(name)).filter((x): x is CheckedItem => !!x);
}

export type ActiveShiftStockCheck = {
  shift: {
    id: string;
    status: "OPEN" | "CLOSED";
    openedByName: string;
    openedAt: string;
    notes: string;
  };
  openChecks: ShiftStockCheckResultRow[];
};

export async function getActiveShiftStockCheck(): Promise<ActiveShiftStockCheck | null> {
  const auth = await resolveActor();
  if (!auth.ok) throw new Error(auth.error);

  const openShifts = await findAllWhere<any>("Shifts", { eq: { status: "OPEN" }, limit: 1 });
  const shift = openShifts[0];
  if (!shift) return null;

  const checks = await findAllWhere<any>("Shift_Stock_Checks", {
    eq: { shift_id: shift.id, checkpoint: "OPEN" },
  });

  return {
    shift: {
      id: shift.id,
      status: shift.status,
      openedByName: shift.opened_by_name,
      openedAt: shift.opened_at,
      notes: shift.notes ?? "",
    },
    openChecks: checks.map((c) => ({
      id: c.id,
      item_reference: c.item_reference,
      counted_qty: Number(c.counted_qty),
      theoretical_qty: Number(c.theoretical_qty),
      variance: Number(c.variance),
    })),
  };
}

export async function openShiftStockCheck(
  counts: Record<string, number>,
  notes?: string,
): Promise<{ success: true; shift: ShiftRow } | { success: false; error: string }> {
  try {
    const auth = await resolveActor();
    if (!auth.ok) return { success: false, error: auth.error };

    const checks = Object.entries(counts).map(([itemReference, countedQty]) => ({ itemReference, countedQty }));
    if (checks.length === 0) return { success: false, error: "Chưa có mặt hàng nào để kiểm" };

    const shift = await openShiftStockCheckAtomic({
      openedById: auth.actor.id,
      openedByName: auth.actor.name,
      checks,
      notes,
    });
    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin/reports/stock");
    }
    return { success: true, shift };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function closeShiftStockCheck(
  shiftId: string,
  counts: Record<string, number>,
  notes?: string,
): Promise<{ success: true; shift: ShiftRow } | { success: false; error: string }> {
  try {
    const auth = await resolveActor();
    if (!auth.ok) return { success: false, error: auth.error };

    const checks = Object.entries(counts).map(([itemReference, countedQty]) => ({ itemReference, countedQty }));
    if (checks.length === 0) return { success: false, error: "Chưa có mặt hàng nào để kiểm" };

    const shift = await closeShiftStockCheckAtomic({
      shiftId,
      closedById: auth.actor.id,
      closedByName: auth.actor.name,
      checks,
      notes,
    });
    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin/reports/stock");
    }
    return { success: true, shift };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
