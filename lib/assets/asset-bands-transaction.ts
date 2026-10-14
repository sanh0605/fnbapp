import { getSupabaseClient } from "@/lib/db/supabase";

export interface BandInput {
  id: string | null;
  min_unit_price: number;
  term_months: number;
}

/**
 * Replaces the whole depreciation-band table in one transaction (migration
 * 0118). The function derives each band's upper bound from the next band's
 * start and mints ids for new rows. Its Vietnamese refusal is thrown
 * unmodified. Returns every band id in price order.
 */
export async function replaceAssetBands(bands: BandInput[]): Promise<string[]> {
  const { data, error } = await getSupabaseClient().rpc("replace_asset_depreciation_bands", {
    p_bands: bands,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!Array.isArray(data)) {
    throw new Error("replace_asset_depreciation_bands returned no id list");
  }
  return data as string[];
}
