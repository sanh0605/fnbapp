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

export type StocktakeApplyRow = {
  lineId: string;
  itemReference: string;
  itemType: StocktakeItemType;
  countedQty: number;
  theoreticalAtCount: number;
  currentTheoreticalQty: number;
  countVariance: number;
  projectedQty: number;
};

export type StocktakeApplyResult = {
  sessionId: string;
  status: "OPEN" | "CONFIRMED";
  dryRun: boolean;
  ledgerCount: number;
  rows: StocktakeApplyRow[];
  planHash: string;
  ledgerIds: string[];
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

export async function applyStocktakeSessionAtomic(input: {
  sessionId: string;
  confirmedById: string;
  confirmedByName: string;
  dryRun: boolean;
  expectedPlanHash?: string;
}): Promise<StocktakeApplyResult> {
  const { data, error } = await getSupabaseClient().rpc("apply_stocktake_session_atomic", {
    p_session_id: input.sessionId,
    p_confirmed_by_id: input.confirmedById,
    p_confirmed_by_name: input.confirmedByName,
    p_dry_run: input.dryRun,
    p_expected_plan_hash: input.expectedPlanHash ?? null,
  });
  if (error) {
    throw new Error(`apply_stocktake_session_atomic: ${error.message}`);
  }
  const result = parseApplyResult(data);
  if (result.dryRun !== input.dryRun) {
    throw new Error("apply_stocktake_session_atomic returned a dry-run mismatch");
  }
  if (!input.dryRun && result.planHash !== input.expectedPlanHash) {
    throw new Error("apply_stocktake_session_atomic returned a plan hash mismatch");
  }
  return result;
}

function parseApplyResult(data: unknown): StocktakeApplyResult {
  const result = data as {
    session_id?: string;
    status?: string;
    dry_run?: boolean;
    ledger_count?: number;
    rows?: Array<{
      line_id?: string;
      item_reference?: string;
      item_type?: StocktakeItemType;
      counted_qty?: number;
      theoretical_at_count?: number;
      current_theoretical_qty?: number;
      count_variance?: number;
      projected_qty?: number;
    }>;
    ledger_ids?: string[];
    plan_hash?: string;
  } | null;
  if (!result?.session_id || (result.status !== "OPEN" && result.status !== "CONFIRMED")) {
    throw new Error("apply_stocktake_session_atomic returned an invalid result");
  }
  if (!result.plan_hash) {
    throw new Error("apply_stocktake_session_atomic returned no plan hash");
  }

  const rows = (result.rows || []).map(row => ({
    lineId: row.line_id || "",
    itemReference: row.item_reference || "",
    itemType: row.item_type || "BASE_INGREDIENT",
    countedQty: Number(row.counted_qty) || 0,
    theoreticalAtCount: Number(row.theoretical_at_count) || 0,
    currentTheoreticalQty: Number(row.current_theoretical_qty) || 0,
    countVariance: Number(row.count_variance) || 0,
    projectedQty: Number(row.projected_qty) || 0,
  }));
  const ledgerCount = Number(result.ledger_count) || 0;
  if (ledgerCount !== rows.length) {
    throw new Error("apply_stocktake_session_atomic returned a ledger count mismatch");
  }
  if (!result.dry_run && (result.ledger_ids || []).length !== ledgerCount) {
    throw new Error("apply_stocktake_session_atomic returned ledger IDs mismatch");
  }

  return {
    sessionId: result.session_id,
    status: result.status,
    dryRun: Boolean(result.dry_run),
    ledgerCount,
    rows,
    planHash: result.plan_hash,
    ledgerIds: result.ledger_ids || [],
  };
}
