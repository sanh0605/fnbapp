import { getSupabaseClient } from "@/lib/db/supabase";

/**
 * Stops or resumes a topping option in one transaction (migration 0126). Stopping also stops
 * the dish it is sold as on its own, with its sizes. The rpc's Vietnamese refusal is thrown unmodified.
 */
export async function setModifierStatusAtomic(
  modifierId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<{ modifierId: string; productStopped: boolean }> {
  const { data, error } = await getSupabaseClient().rpc("set_modifier_status_atomic", {
    p_modifier_id: modifierId,
    p_status: status,
  });
  if (error) {
    throw new Error(error.message);
  }
  const result = data as { modifier_id?: string; product_stopped?: boolean } | null;
  if (!result?.modifier_id) {
    throw new Error("set_modifier_status_atomic returned no modifier_id");
  }
  return { modifierId: result.modifier_id, productStopped: result.product_stopped === true };
}
