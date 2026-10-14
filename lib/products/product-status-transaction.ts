import { getSupabaseClient } from "@/lib/db/supabase";

/**
 * Stops or resumes selling a dish and its sizes in one transaction
 * (migration 0114): the dish row and its size rows change together or not
 * at all. The rpc's Vietnamese refusal is thrown unmodified.
 */
export async function setProductStatusAtomic(
  productId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<{ productId: string; variantsChanged: number }> {
  const { data, error } = await getSupabaseClient().rpc("set_product_status_atomic", {
    p_product_id: productId,
    p_status: status,
  });
  if (error) {
    throw new Error(error.message);
  }
  const result = data as { product_id?: string; variants_changed?: number } | null;
  if (!result?.product_id) {
    throw new Error("set_product_status_atomic returned no product_id");
  }
  return { productId: result.product_id, variantsChanged: Number(result.variants_changed) || 0 };
}
