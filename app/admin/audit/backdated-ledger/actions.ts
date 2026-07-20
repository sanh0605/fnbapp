"use server";

import { recomputeEventApply } from "@/lib/backdated-ledger/recompute-event";
import { recomputeRecipeEventApply } from "@/lib/backdated-recipe-events/recompute-event";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

async function findEventKind(eventId: string): Promise<"ledger" | "recipe" | null> {
  const supabase = getSupabaseClient();
  const { data: ledgerEvent } = await supabase
    .from("backdated_ledger_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (ledgerEvent) return "ledger";

  const { data: recipeEvent } = await supabase
    .from("backdated_recipe_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (recipeEvent) return "recipe";

  return null;
}

export async function approveAndRecomputeAction(eventId: string, _reviewer: string) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const kind = await findEventKind(eventId);
    if (!kind) return { success: false, error: "Event not found" };

    const result = kind === "ledger"
      ? await recomputeEventApply(eventId, auth.actor.name)
      : await recomputeRecipeEventApply(eventId, auth.actor.name);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function rejectEventAction(eventId: string, _reviewer: string, reason: string) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const kind = await findEventKind(eventId);
  if (!kind) return { success: false, error: "Event not found" };

  const supabase = getSupabaseClient();
  const rpcName = kind === "ledger" ? "reject_backdated_event" : "reject_backdated_recipe_event";
  const { error } = await supabase.rpc(rpcName, {
    p_event_id: eventId,
    p_reviewer: auth.actor.name,
    p_reason: reason,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
