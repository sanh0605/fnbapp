import { getSupabaseClient } from "@/lib/db/supabase";
import {
  parseCancelCheck,
  parseCancelOutcome,
  type CancelCheck,
  type CancelOutcome,
} from "./purchase-order-cancel";

// Thrown when the database does not have the 0108 functions yet (code is
// deployed before the migration), so the page can say so instead of a generic error.
export class CancelFunctionMissingError extends Error {}

type RpcError = { code?: string; message: string };

function rpcFailure(rpcName: string, error: RpcError): Error {
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    return new CancelFunctionMissingError(`${rpcName}: ${error.message}`);
  }
  return new Error(`${rpcName}: ${error.message}`);
}

export async function fetchPurchaseOrderCancelCheck(id: string): Promise<CancelCheck> {
  const { data, error } = await getSupabaseClient().rpc("purchase_order_cancel_check", { p_id: id });
  if (error) throw rpcFailure("purchase_order_cancel_check", error);
  return parseCancelCheck(data);
}

export async function cancelPurchaseOrderAtomic(input: {
  id: string;
  reason: string;
  actorId: string;
  actorName: string;
}): Promise<CancelOutcome> {
  const { data, error } = await getSupabaseClient().rpc("cancel_purchase_order_atomic", {
    p_id: input.id,
    p_reason: input.reason,
    p_actor_id: input.actorId,
    p_actor_name: input.actorName,
  });
  if (error) throw rpcFailure("cancel_purchase_order_atomic", error);
  return parseCancelOutcome(data);
}
