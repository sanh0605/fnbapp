import { getSupabaseClient } from "@/lib/db/supabase";

export interface DisposeAssetInput {
  id: string;
  asset_id: string;
  quantity: number;
  disposed_date: string;
  reason: string | null;
  actor_id: string;
  actor_name: string;
  // 0 = no proceeds row; the entry fields are then null.
  amount: number;
  entry_id: string | null;
  payment_method: "CASH" | "BANK_TRANSFER" | null;
  bank_account_id: string | null;
  note: string | null;
}

/**
 * Records a disposal and, when amount > 0, its income row in the cash book in one
 * transaction (migration 0131). Its Vietnamese refusals (stopped group or bank
 * account, over-quantity from asset_disposals_guard) are thrown unmodified.
 */
export async function disposeAssetAtomic(input: DisposeAssetInput): Promise<void> {
  const { error } = await getSupabaseClient().rpc("dispose_asset_atomic", {
    p_disposal_id: input.id,
    p_asset_id: input.asset_id,
    p_quantity: input.quantity,
    p_disposed_date: input.disposed_date,
    p_reason: input.reason,
    p_actor_id: input.actor_id,
    p_actor_name: input.actor_name,
    p_amount: input.amount,
    p_entry_id: input.entry_id,
    p_payment_method: input.payment_method,
    p_bank_account_id: input.bank_account_id,
    p_note: input.note,
  });
  if (error) {
    throw new Error(error.message);
  }
}
