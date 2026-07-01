import { getSupabaseClient } from "@/lib/supabase";

export type PurchaseOrderAtomicInput = {
  order: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  ledgerRows: Array<Record<string, unknown>>;
  replaceExisting: boolean;
};

type PurchaseOrderAtomicResult = {
  purchase_order_id: string;
  line_count: number;
  ledger_count: number;
};

export async function savePurchaseOrderAtomic(
  input: PurchaseOrderAtomicInput,
): Promise<{
  purchaseOrderId: string;
  lineCount: number;
  ledgerCount: number;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("save_purchase_order_atomic", {
    p_order: input.order,
    p_lines: input.lines,
    p_ledger: input.ledgerRows,
    p_replace_existing: input.replaceExisting,
  });
  if (error) {
    throw new Error(`save_purchase_order_atomic: ${error.message}`);
  }

  const result = data as PurchaseOrderAtomicResult | null;
  if (!result?.purchase_order_id) {
    throw new Error("save_purchase_order_atomic returned no purchase_order_id");
  }
  const lineCount = Number(result.line_count) || 0;
  const ledgerCount = Number(result.ledger_count) || 0;
  if (
    lineCount !== input.lines.length ||
    ledgerCount !== input.ledgerRows.length
  ) {
    throw new Error(
      "save_purchase_order_atomic persisted row count mismatch",
    );
  }
  return {
    purchaseOrderId: result.purchase_order_id,
    lineCount,
    ledgerCount,
  };
}
