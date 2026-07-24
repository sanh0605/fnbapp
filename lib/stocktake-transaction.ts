import { getSupabaseClient } from "@/lib/supabase";

export type StocktakeItemType = "BASE_INGREDIENT" | "SEMI_PRODUCT";

export type StocktakeSessionRow = {
  id: string;
  status: "OPEN" | "CONFIRMED" | "CANCELLED";
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  notes: string;
};

export type StocktakeLineResultRow = {
  id: string;
  session_id: string;
  item_reference: string;
  counted_qty: number;
  theoretical_at_count: number;
  counted_at: string;
};

export async function openStocktakeSessionAtomic(input: {
  createdById: string;
  createdByName: string;
  items: Array<{ itemReference: string; itemType: StocktakeItemType }>;
  notes?: string;
}): Promise<StocktakeSessionRow> {
  const { data, error } = await getSupabaseClient().rpc("open_stocktake_session_atomic", {
    p_created_by_id: input.createdById,
    p_created_by_name: input.createdByName,
    p_items: input.items.map(i => ({ item_reference: i.itemReference, item_type: i.itemType })),
    p_notes: input.notes ?? "",
  });
  if (error) {
    throw new Error(`open_stocktake_session_atomic: ${error.message}`);
  }
  return data as StocktakeSessionRow;
}

export async function saveStocktakeLineAtomic(input: {
  lineId: string;
  countedQty: number;
}): Promise<StocktakeLineResultRow> {
  const { data, error } = await getSupabaseClient().rpc("save_stocktake_line_atomic", {
    p_line_id: input.lineId,
    p_counted_qty: input.countedQty,
  });
  if (error) {
    throw new Error(`save_stocktake_line_atomic: ${error.message}`);
  }
  return data as StocktakeLineResultRow;
}

export async function cancelStocktakeSessionAtomic(sessionId: string): Promise<{ id: string; status: "CANCELLED" }> {
  const { data, error } = await getSupabaseClient().rpc("cancel_stocktake_session_atomic", {
    p_session_id: sessionId,
  });
  if (error) {
    throw new Error(`cancel_stocktake_session_atomic: ${error.message}`);
  }
  return data as { id: string; status: "CANCELLED" };
}
