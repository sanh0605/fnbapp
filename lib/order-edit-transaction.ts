import { getSupabaseClient } from "@/lib/supabase";

export type OrderEditPaymentInput = {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  reference?: string;
};

export async function supersedeOrderAtomic(
  input: {
    oldOrderId: string;
    expectedOldVersion: number;
    newOrder: Record<string, unknown>;
    newLines: Array<Record<string, unknown>>;
    event: Record<string, unknown>;
    payments: OrderEditPaymentInput[];
  },
): Promise<{
  newOrderId: string;
  lineCount: number;
  paymentCount: number;
}> {
  const { data, error } = await getSupabaseClient().rpc(
    "supersede_order_v2_atomic",
    {
      p_old_order_id: input.oldOrderId,
      p_expected_old_version: input.expectedOldVersion,
      p_new_order: parseJsonColumns(input.newOrder, [
        "applied_promotion_snapshot_json",
        "pos_snapshot_json",
      ]),
      p_new_lines: input.newLines.map((line) => parseJsonColumns(line, [
        "product_snapshot_json",
        "variant_snapshot_json",
        "modifiers_snapshot_json",
        "recipe_snapshot_json",
      ])),
      p_event: parseJsonColumns(input.event, ["delta_json"]),
      p_payments: input.payments,
    },
  );
  if (error) {
    throw new Error(`supersede_order_v2_atomic: ${error.message}`);
  }

  const result = data as {
    new_order_id?: string;
    line_count?: number;
    payment_count?: number;
  } | null;
  if (!result?.new_order_id) {
    throw new Error("supersede_order_v2_atomic returned no new_order_id");
  }
  const lineCount = Number(result.line_count) || 0;
  const paymentCount = Number(result.payment_count) || 0;
  if (
    lineCount !== input.newLines.length ||
    paymentCount !== input.payments.length
  ) {
    throw new Error("supersede_order_v2_atomic persisted row count mismatch");
  }
  return {
    newOrderId: result.new_order_id,
    lineCount,
    paymentCount,
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
    if (value === "") {
      result[column] = column.includes("modifiers") ? [] : {};
      continue;
    }
    try {
      result[column] = JSON.parse(value);
    } catch {
      throw new Error(`Invalid JSON in ${column}`);
    }
  }
  return result;
}
