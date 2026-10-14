import { getSupabaseClient } from "@/lib/db/supabase";

// BR-CATALOG-003. One RPC (migration 0119's save_modifier_atomic) writes an option:
// clears the group's other default first, and on edit syncs the price to the linked
// CAT-007 product's single variant (0098), all in one transaction.
export async function saveModifierAtomic(input: {
  isEdit: boolean;
  modifier: Record<string, unknown>;
}): Promise<{
  modifierId: string;
  variantId: string | null;
  priceHistory: Array<{ id: string; variant_id: string; old_price: number | null; new_price: number }>;
}> {
  const { data, error } = await getSupabaseClient().rpc("save_modifier_atomic", {
    p_is_edit: input.isEdit,
    p_modifier: input.modifier,
  });
  if (error) {
    throw new Error(`save_modifier_atomic: ${error.message}`);
  }
  const result = data as {
    modifier_id: string;
    variant_id: string | null;
    price_history: Array<{ id: string; variant_id: string; old_price: number | null; new_price: number }>;
  };
  return { modifierId: result.modifier_id, variantId: result.variant_id, priceHistory: result.price_history };
}
