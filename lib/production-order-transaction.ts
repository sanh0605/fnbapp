import { getSupabaseClient } from "@/lib/supabase";

export type ProductionOrderAtomicInput = {
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  ledgerRows: Array<Record<string, unknown>>;
};

export async function saveProductionOrderAtomic(
  input: ProductionOrderAtomicInput,
): Promise<{ productionOrderId: string; itemCount: number; ledgerCount: number }> {
  const { data, error } = await getSupabaseClient().rpc(
    "save_production_order_atomic",
    {
      p_order: input.order,
      p_items: input.items,
      p_ledger: input.ledgerRows,
    },
  );
  if (error) {
    throw new Error(`save_production_order_atomic: ${error.message}`);
  }

  const result = data as {
    production_order_id?: string;
    item_count?: number;
    ledger_count?: number;
  } | null;
  if (!result?.production_order_id) {
    throw new Error(
      "save_production_order_atomic returned no production_order_id",
    );
  }

  const itemCount = Number(result.item_count) || 0;
  const ledgerCount = Number(result.ledger_count) || 0;
  if (
    itemCount !== input.items.length ||
    ledgerCount !== input.ledgerRows.length
  ) {
    throw new Error(
      "save_production_order_atomic persisted row count mismatch",
    );
  }

  return {
    productionOrderId: result.production_order_id,
    itemCount,
    ledgerCount,
  };
}
