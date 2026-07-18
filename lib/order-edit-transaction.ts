import { getSupabaseClient } from "@/lib/supabase";

export async function supersedeOrderAtomic(
  input: {
    oldOrderId: string;
    expectedOldVersion: number;
    newOrder: Record<string, unknown>;
    newLines: Array<Record<string, unknown>>;
    event: Record<string, unknown>;
    ledgerRows: Array<Record<string, unknown>>;
  },
): Promise<{ newOrderId: string; lineCount: number; ledgerCount: number }> {
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
      p_ledger: input.ledgerRows,
    },
  );
  if (error) {
    throw new Error(`supersede_order_v2_atomic: ${error.message}`);
  }

  const result = data as {
    new_order_id?: string;
    line_count?: number;
    ledger_count?: number;
  } | null;
  if (!result?.new_order_id) {
    throw new Error("supersede_order_v2_atomic returned no new_order_id");
  }
  const lineCount = Number(result.line_count) || 0;
  const ledgerCount = Number(result.ledger_count) || 0;
  if (
    lineCount !== input.newLines.length ||
    ledgerCount !== input.ledgerRows.length
  ) {
    throw new Error("supersede_order_v2_atomic persisted row count mismatch");
  }
  return { newOrderId: result.new_order_id, lineCount, ledgerCount };
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
