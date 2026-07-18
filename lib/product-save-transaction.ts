import { getSupabaseClient } from "@/lib/supabase";

export async function saveProductAtomic(
  input: {
    isEdit: boolean;
    product: Record<string, unknown>;
    variants: Array<Record<string, unknown>>;
    removedVariantIds: string[];
    effectiveAt: string;
    expectedPriceHistoryCount: number;
    expectedRecipeCount: number;
  },
): Promise<{
  productId: string;
  variantCount: number;
  priceHistoryCount: number;
  recipeCount: number;
  removedVariantCount: number;
}> {
  const { data, error } = await getSupabaseClient().rpc("save_product_atomic", {
    p_is_edit: input.isEdit,
    p_product: input.product,
    p_variants: input.variants,
    p_removed_variant_ids: input.removedVariantIds,
    p_effective_at: input.effectiveAt,
  });
  if (error) {
    throw new Error(`save_product_atomic: ${error.message}`);
  }
  const result = data as {
    product_id?: string;
    variant_count?: number;
    price_history_count?: number;
    recipe_count?: number;
    removed_variant_count?: number;
  } | null;
  if (!result?.product_id) {
    throw new Error("save_product_atomic returned no product_id");
  }
  const variantCount = Number(result.variant_count) || 0;
  const priceHistoryCount = Number(result.price_history_count) || 0;
  const recipeCount = Number(result.recipe_count) || 0;
  const removedVariantCount = Number(result.removed_variant_count) || 0;
  if (
    variantCount !== input.variants.length ||
    priceHistoryCount !== input.expectedPriceHistoryCount ||
    recipeCount !== input.expectedRecipeCount ||
    removedVariantCount !== input.removedVariantIds.length
  ) {
    throw new Error("save_product_atomic persisted row count mismatch");
  }
  return {
    productId: result.product_id,
    variantCount,
    priceHistoryCount,
    recipeCount,
    removedVariantCount,
  };
}
