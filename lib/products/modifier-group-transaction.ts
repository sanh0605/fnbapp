import { getSupabaseClient } from "@/lib/db/supabase";

// One RPC (migration 0119's save_modifier_group_atomic) writes the group and its
// dish ticks together, or none of it.
export async function saveModifierGroupAtomic(input: {
  isEdit: boolean;
  group: Record<string, unknown>;
  productIds: string[];
}): Promise<{ groupId: string; productCount: number }> {
  const { data, error } = await getSupabaseClient().rpc("save_modifier_group_atomic", {
    p_is_edit: input.isEdit,
    p_group: input.group,
    p_product_ids: input.productIds,
  });
  if (error) {
    throw new Error(`save_modifier_group_atomic: ${error.message}`);
  }
  const result = data as { group_id?: string; product_count?: number } | null;
  if (!result?.group_id) {
    throw new Error("save_modifier_group_atomic returned no group_id");
  }
  const productCount = Number(result.product_count) || 0;
  if (productCount !== new Set(input.productIds).size) {
    throw new Error("save_modifier_group_atomic persisted row count mismatch");
  }
  return { groupId: result.group_id, productCount };
}
