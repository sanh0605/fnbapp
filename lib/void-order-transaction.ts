export type VoidOrderAtomicInput = {
  orderId: string;
  event: Record<string, unknown>;
  reversalRows: Array<Record<string, unknown>>;
  voidedAt: string;
  voidedById: string;
  reason: string;
};

export async function voidOrderAtomic(
  input: VoidOrderAtomicInput,
): Promise<{ orderId: string; reversalCount: number; alreadyVoided: boolean }> {
  const { data, error } = await getSupabaseClient().rpc("void_order_atomic", {
    p_order_id: input.orderId,
    p_event: parseJsonColumns(input.event, ["delta_json"]),
    p_reversal_ledger: input.reversalRows,
    p_voided_at: input.voidedAt,
    p_voided_by_id: input.voidedById,
    p_reason: input.reason,
  });
  if (error) {
    throw new Error(`void_order_atomic: ${error.message}`);
  }

  const result = data as {
    order_id?: string;
    reversal_count?: number;
    already_voided?: boolean;
  } | null;
  if (!result?.order_id) {
    throw new Error("void_order_atomic returned an invalid result");
  }
  const reversalCount = Number(result.reversal_count) || 0;
  if (!result.already_voided && reversalCount !== input.reversalRows.length) {
    throw new Error("void_order_atomic persisted reversal count mismatch");
  }

  return {
    orderId: result.order_id,
    reversalCount,
    alreadyVoided: Boolean(result.already_voided),
  };
}

function parseJsonColumns(
  row: Record<string, unknown>,
  columns: string[],
): Record<string, unknown> {
  const result = { ...row };
  for (const column of columns) {
    const value = result[column];
    if (typeof value !== "string") continue;
    try {
      result[column] = JSON.parse(value);
    } catch {
      throw new Error(`Invalid JSON in ${column}`);
    }
  }
  return result;
}
import { getSupabaseClient } from "@/lib/supabase";
