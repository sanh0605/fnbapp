import { getSupabaseClient } from "@/lib/db/supabase";

// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 2. Turning
// "Bán độc lập" on for a modifier with no linked product (state c, e.g.
// MOD-009 "Hộp sữa chua") creates the CAT-007 product, its single ACTIVE
// variant at the modifier's own price, and the link -- one transaction
// (migration 0100's create_standalone_topping_product_atomic), or none of
// it. Only p_modifier_id is sent: name and price are read from the locked
// modifier row inside the function itself, not forwarded by the caller, so
// a stale client value can never win a race against a concurrent edit.
export async function createStandaloneToppingProductAtomic(input: {
  modifierId: string;
}): Promise<{ productId: string; variantId: string }> {
  const { data, error } = await getSupabaseClient().rpc("create_standalone_topping_product_atomic", {
    p_modifier_id: input.modifierId,
  });
  if (error) {
    throw new Error(`create_standalone_topping_product_atomic: ${error.message}`);
  }
  const result = data as { product_id: string; variant_id: string };
  return { productId: result.product_id, variantId: result.variant_id };
}
