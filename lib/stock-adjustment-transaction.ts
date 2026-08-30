import { getSupabaseClient } from "@/lib/supabase";

export async function submitStockAdjustmentAtomic(
  adjustment: Record<string, unknown>,
): Promise<{ adjustmentId: string }> {
  const { data, error } = await getSupabaseClient().rpc(
    "submit_stock_adjustment_atomic",
    { p_adjustment: adjustment },
  );
  if (error) {
    throw new Error(`submit_stock_adjustment_atomic: ${error.message}`);
  }
  const result = parseResult(data, "submit_stock_adjustment_atomic");
  return {
    adjustmentId: result.adjustmentId,
  };
}

export async function approveStockAdjustmentAtomic(
  input: { adjustmentId: string; approvedBy: string; approvedAt: string },
): Promise<{
  adjustmentId: string;
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
  return parseResult(data, "approve_stock_adjustment_atomic");
}

function parseResult(
  data: unknown,
  rpcName: string,
): { adjustmentId: string; alreadyCompleted: boolean } {
  const result = data as {
    adjustment_id?: string;
    already_completed?: boolean;
  } | null;
  if (!result?.adjustment_id) {
    throw new Error(`${rpcName} returned no adjustment_id`);
  }
  return {
    adjustmentId: result.adjustment_id,
    alreadyCompleted: Boolean(result.already_completed),
  };
}
