import { getSupabaseClient } from "@/lib/db/supabase";

// docs/superpowers/plans/2026-09-07-one-price-per-topping.md. One RPC call
// (migration 0098's sync_topping_price_atomic) updates the modifier and, if
// it is linked to a CAT-007 product, that product's single ACTIVE variant
// and a price-history row -- all in one transaction, so a topping's price
// can never disagree with itself.
export async function syncToppingPriceAtomic(input: {
  modifierId: string;
  price: number;
  name: string;
  groupName: string;
}): Promise<{
  modifierId: string;
  variantId: string | null;
  priceHistory: Array<{ id: string; variant_id: string; old_price: number | null; new_price: number }>;
}> {
  const { data, error } = await getSupabaseClient().rpc("sync_topping_price_atomic", {
    p_modifier_id: input.modifierId,
    p_price: input.price,
    p_name: input.name,
    p_group_name: input.groupName,
  });
  if (error) {
    throw new Error(`sync_topping_price_atomic: ${error.message}`);
  }
  const result = data as {
    modifier_id: string;
    variant_id: string | null;
    price_history: Array<{ id: string; variant_id: string; old_price: number | null; new_price: number }>;
  };
  return {
    modifierId: result.modifier_id,
    variantId: result.variant_id,
    priceHistory: result.price_history,
  };
}
