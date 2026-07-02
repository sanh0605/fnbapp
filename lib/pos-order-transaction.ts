import { getSupabaseClient } from "@/lib/supabase";

export type PosOrderAtomicInput = {
  brandCode: string;
  order: object;
  lines: object[];
  event: object;
  ledgerRows: object[];
};

type PosOrderAtomicResult = {
  order_id: string;
  order_no: string;
  line_count: number;
  ledger_count: number;
};

export async function savePosOrderAtomic(
  input: PosOrderAtomicInput,
): Promise<{
  orderId: string;
  orderNo: string;
  lineCount: number;
  ledgerCount: number;
}> {
  const { data, error } = await getSupabaseClient().rpc(
    "create_pos_order_atomic",
    {
      p_brand_code: input.brandCode,
      p_order: parseJsonColumns(input.order, [
        "applied_promotion_snapshot_json",
        "pos_snapshot_json",
      ]),
      p_lines: input.lines.map(line => parseJsonColumns(line, [
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
    throw new Error(`create_pos_order_atomic: ${error.message}`);
  }
  const result = data as PosOrderAtomicResult | null;
  if (!result?.order_id || !result.order_no) {
    throw new Error("create_pos_order_atomic returned an invalid result");
  }
  const lineCount = Number(result.line_count) || 0;
  const ledgerCount = Number(result.ledger_count) || 0;
  if (
    lineCount !== input.lines.length ||
    ledgerCount !== input.ledgerRows.length
  ) {
    throw new Error("create_pos_order_atomic persisted row count mismatch");
  }
  return {
    orderId: result.order_id,
    orderNo: result.order_no,
    lineCount,
    ledgerCount,
  };
}

function parseJsonColumns(
  row: object,
  columns: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };
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
