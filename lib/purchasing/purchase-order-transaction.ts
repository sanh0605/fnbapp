import { getSupabaseClient } from "@/lib/db/supabase";
import type { NewAssetPlan } from "@/lib/assets/asset-purchase-allocation";
import type { AssetPatch } from "@/lib/assets/asset-purchase-reconcile";

// The assets that follow an order, written by the same database function as
// the order itself (audit A7). Omitted for a draft and for an edit that
// changes no asset.
export type PurchaseOrderAssetsInput = {
  create: Array<NewAssetPlan & { acquired_date: string }>;
  update: Array<{ id: string; patch: AssetPatch }>;
  retire: string[];
};

export type PurchaseOrderAtomicInput = {
  order: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  replaceExisting: boolean;
  assets?: PurchaseOrderAssetsInput;
};

type PurchaseOrderAtomicResult = {
  purchase_order_id: string;
  line_count: number;
};

export async function savePurchaseOrderAtomic(
  input: PurchaseOrderAtomicInput,
): Promise<{
  purchaseOrderId: string;
  lineCount: number;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("save_purchase_order_atomic", {
    p_order: input.order,
    p_lines: input.lines,
    p_replace_existing: input.replaceExisting,
    // Left out when absent, so an order without assets also saves before migration 0112 runs.
    ...(input.assets ? { p_assets: input.assets } : {}),
  });
  if (error) {
    throw new Error(`save_purchase_order_atomic: ${error.message}`);
  }

  const result = data as PurchaseOrderAtomicResult | null;
  if (!result?.purchase_order_id) {
    throw new Error("save_purchase_order_atomic returned no purchase_order_id");
  }
  const lineCount = Number(result.line_count) || 0;
  if (lineCount !== input.lines.length) {
    throw new Error(
      "save_purchase_order_atomic persisted row count mismatch",
    );
  }
  return {
    purchaseOrderId: result.purchase_order_id,
    lineCount,
  };
}
