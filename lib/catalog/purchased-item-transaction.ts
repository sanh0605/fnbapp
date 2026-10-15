import { getSupabaseClient } from "@/lib/db/supabase";

// One item, its conversions and (on edit) the assets it retires, written in one
// Postgres transaction (migration 0124). itemId null creates; conversions null
// leaves them alone.
export async function savePurchasedItemAtomic(input: {
  itemId: string | null;
  name: string;
  categoryId: string;
  isNonInventory: boolean;
  warningConfirmedBy: string | null;
  baseUnit: string;
  conversions: Array<{ id?: string; name: string; conversion_rate: string | number }> | null;
  retireAssetIds: string[];
}): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("save_purchased_item_atomic", {
    p_item_id: input.itemId,
    p_name: input.name,
    p_category_id: input.categoryId,
    p_is_non_inventory: input.isNonInventory,
    p_warning_confirmed: input.warningConfirmedBy !== null,
    p_confirmed_by: input.warningConfirmedBy,
    p_base_unit: input.baseUnit,
    p_conversions: input.conversions,
    p_retire_asset_ids: input.retireAssetIds,
  });
  if (error) throw new Error(`save_purchased_item_atomic: ${error.message}`);
  const itemId = (data as { item_id?: string } | null)?.item_id;
  if (!itemId) throw new Error("save_purchased_item_atomic returned no item_id");
  return itemId;
}
