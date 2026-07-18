import { getSupabaseClient } from "@/lib/supabase";

export async function submitStockAdjustmentAtomic(
  adjustment: Record<string, unknown>,
): Promise<{ adjustmentId: string; ledgerCount: number }> {
  const { data, error } = await getSupabaseClient().rpc(
    "submit_stock_adjustment_atomic",
    { p_adjustment: adjustment },
  );
  if (error) {
    throw new Error(`submit_stock_adjustment_atomic: ${error.message}`);
  }
  const result = parseResult(data, "submit_stock_adjustment_atomic");
  if (result.ledgerCount !== 1) {
    throw new Error("submit_stock_adjustment_atomic persisted ledger count mismatch");
  }
  return {
    adjustmentId: result.adjustmentId,
    ledgerCount: result.ledgerCount,
  };
}

export async function approveStockAdjustmentAtomic(
  input: { adjustmentId: string; approvedBy: string; approvedAt: string },
): Promise<{
  adjustmentId: string;
  ledgerCount: number;
  alreadyCompleted: boolean;
}> {
  const { data, error } = await getSupabaseClient().rpc(
    "approve_stock_adjustment_atomic",
    {
      p_adjustment_id: input.adjustmentId,
      p_approved_by: input.approvedBy,
      p_approved_at: input.approvedAt,
    },
  );
  if (error) {
    throw new Error(`approve_stock_adjustment_atomic: ${error.message}`);
  }
  const result = parseResult(data, "approve_stock_adjustment_atomic");
  if (result.ledgerCount !== 1) {
    throw new Error("approve_stock_adjustment_atomic persisted ledger count mismatch");
  }
  return result;
}

function parseResult(
  data: unknown,
  rpcName: string,
): { adjustmentId: string; ledgerCount: number; alreadyCompleted: boolean } {
  const result = data as {
    adjustment_id?: string;
    ledger_count?: number;
    already_completed?: boolean;
  } | null;
  if (!result?.adjustment_id) {
    throw new Error(`${rpcName} returned no adjustment_id`);
  }
  return {
    adjustmentId: result.adjustment_id,
    ledgerCount: Number(result.ledger_count) || 0,
    alreadyCompleted: Boolean(result.already_completed),
  };
}
