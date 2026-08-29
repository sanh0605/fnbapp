import { getSupabaseClient } from "@/lib/supabase";

/**
 * Erases a never-sold product for real: price history, then variants, then
 * the product, atomically. Postgres's own RESTRICT foreign keys (not this
 * function) decide whether the product has ever been sold -- see
 * supabase/migrations/0075_erase_never_sold_product.sql. A sold product
 * makes the RPC raise a Vietnamese sentence naming the product; that
 * message is thrown here unmodified so it reaches the owner exactly as
 * written, not wrapped in a technical prefix.
 */
export async function eraseProductAtomic(productId: string): Promise<{
  productId: string;
  productName: string;
  priceHistoryDeleted: number;
  variantsDeleted: number;
}> {
  const { data, error } = await getSupabaseClient().rpc(
    "erase_never_sold_product_atomic",
    { p_product_id: productId },
  );
  if (error) {
    throw new Error(error.message);
  }
  const result = data as {
    product_id?: string;
    product_name?: string;
    price_history_deleted?: number;
    variants_deleted?: number;
  } | null;
  if (!result?.product_id) {
    throw new Error("erase_never_sold_product_atomic returned no product_id");
  }
  return {
    productId: result.product_id,
    productName: result.product_name || "",
    priceHistoryDeleted: Number(result.price_history_deleted) || 0,
    variantsDeleted: Number(result.variants_deleted) || 0,
  };
}
