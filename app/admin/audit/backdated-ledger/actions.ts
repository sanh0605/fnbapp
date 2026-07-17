"use server";

import { recomputeEventApply } from "@/lib/backdated-ledger/recompute-event";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function approveAndRecomputeAction(eventId: string, _reviewer: string) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const result = await recomputeEventApply(eventId, auth.actor.name);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function rejectEventAction(eventId: string, _reviewer: string, reason: string) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("reject_backdated_event", {
    p_event_id: eventId,
    p_reviewer: auth.actor.name,
    p_reason: reason,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
