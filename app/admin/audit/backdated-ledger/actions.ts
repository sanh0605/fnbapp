"use server";

import { recomputeEventApply } from "@/lib/backdated-ledger/recompute-event";
import { getSupabaseClient } from "@/lib/supabase";

export async function approveAndRecomputeAction(eventId: string, reviewer: string) {
  try {
    const result = await recomputeEventApply(eventId, reviewer);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function rejectEventAction(eventId: string, reviewer: string, reason: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("reject_backdated_event", {
    p_event_id: eventId,
    p_reviewer: reviewer,
    p_reason: reason,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
