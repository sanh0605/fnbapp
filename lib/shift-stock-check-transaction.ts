import { getSupabaseClient } from "@/lib/supabase";

export type ShiftStockCheckResultRow = {
  id: string;
  item_reference: string;
  counted_qty: number;
  theoretical_qty: number;
  variance: number;
};

export type ShiftRow = {
  id: string;
  status: "OPEN" | "CLOSED";
  opened_by_id: string;
  opened_by_name: string;
  opened_at: string;
  closed_by_id?: string | null;
  closed_by_name?: string | null;
  closed_at?: string | null;
  notes: string;
  checks: ShiftStockCheckResultRow[];
};

export type StockCheckInput = {
  itemReference: string;
  countedQty: number;
};

export async function openShiftStockCheckAtomic(input: {
  openedById: string;
  openedByName: string;
  checks: StockCheckInput[];
  notes?: string;
}): Promise<ShiftRow> {
  const { data, error } = await getSupabaseClient().rpc("open_shift_stock_check_atomic", {
    p_opened_by_id: input.openedById,
    p_opened_by_name: input.openedByName,
    p_checks: input.checks.map((c) => ({ item_reference: c.itemReference, counted_qty: c.countedQty })),
    p_notes: input.notes ?? "",
  });
  if (error) {
    throw new Error(`open_shift_stock_check_atomic: ${error.message}`);
  }
  return data as ShiftRow;
}

export async function closeShiftStockCheckAtomic(input: {
  shiftId: string;
  closedById: string;
  closedByName: string;
  checks: StockCheckInput[];
  notes?: string;
}): Promise<ShiftRow> {
  const { data, error } = await getSupabaseClient().rpc("close_shift_stock_check_atomic", {
    p_shift_id: input.shiftId,
    p_closed_by_id: input.closedById,
    p_closed_by_name: input.closedByName,
    p_checks: input.checks.map((c) => ({ item_reference: c.itemReference, counted_qty: c.countedQty })),
    p_notes: input.notes ?? null,
  });
  if (error) {
    throw new Error(`close_shift_stock_check_atomic: ${error.message}`);
  }
  return data as ShiftRow;
}
