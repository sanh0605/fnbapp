import { getSupabaseClient } from "@/lib/supabase";

export type PosOrderPaymentInput = {
  id: string;
  method: string;
  amount: number;
  reference?: string;
};

export type PosOrderAtomicInput = {
  brandCode: string;
  order: object;
  lines: object[];
  event: object;
  ledgerRows: object[];
  clientRequestId?: string;
  payments?: PosOrderPaymentInput[];
};

type PosOrderAtomicResult = {
  order_id: string;
  order_no: string;
  line_count: number;
  ledger_count: number;
  payment_count?: number;
};

export async function savePosOrderAtomic(
  input: PosOrderAtomicInput,
): Promise<{
  orderId: string;
  orderNo: string;
  lineCount: number;
  ledgerCount: number;
  paymentCount: number;
}> {
  const clientRequestId = normalizeClientRequestId(input.clientRequestId);
  const payments = input.payments ?? [];
  const rpcArgs: Record<string, unknown> = {
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
  };
  if (clientRequestId) {
    rpcArgs.p_client_request_id = clientRequestId;
  }
  if (payments.length > 0) {
    rpcArgs.p_payments = payments;
  }

  const { data, error } = await getSupabaseClient().rpc(
    "create_pos_order_atomic",
    rpcArgs,
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
  const paymentCount = Number(result.payment_count) || 0;
  if (
    lineCount !== input.lines.length ||
    ledgerCount !== input.ledgerRows.length
  ) {
    throw new Error("create_pos_order_atomic persisted row count mismatch");
  }
  if (payments.length > 0 && paymentCount !== payments.length) {
    throw new Error("create_pos_order_atomic persisted row count mismatch");
  }
  return {
    orderId: result.order_id,
    orderNo: result.order_no,
    lineCount,
    ledgerCount,
    paymentCount,
  };
}

function normalizeClientRequestId(value: string | undefined): string | null {
  const normalized = value?.trim() || "";
  if (!normalized) return null;
  if (normalized.length > 128) {
    throw new Error("POS checkout request token exceeds 128 characters");
  }
  return normalized;
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
