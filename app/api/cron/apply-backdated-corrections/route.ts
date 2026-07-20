import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { recomputeEventApply, recomputeEventDryRun } from "@/lib/backdated-ledger/recompute-event";
import {
  recomputeRecipeEventApply,
  recomputeRecipeEventDryRun,
} from "@/lib/backdated-recipe-events/recompute-event";
import { classifyBackdatedEventPlan } from "@/lib/backdated-ledger/anomaly-threshold";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REVIEWER = "system-auto";

type EventSweepResult = {
  event_id: string;
  kind: "ledger" | "recipe";
  outcome: "applied" | "flagged" | "no_change" | "error";
  change_count: number;
  total_delta_vnd: number;
  reason?: string;
  error?: string;
};

/**
 * Scheduled sweep (see vercel.json) that automatically applies routine-sized
 * backdated-event corrections (both PO_RECEIPT-style and recipe-version-
 * style) with no human approval step, and flags unusually large ones for
 * review instead of applying them -- see docs at
 * C:\Users\Admin\.claude\plans\cuddly-inventing-taco.md for the full design
 * rationale (owner explicitly does not want to be a manual-approval
 * bottleneck, but also does not want fully-silent automation with zero
 * safety net).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const results: EventSweepResult[] = [];

  const { data: ledgerEvents, error: ledgerError } = await supabase
    .from("backdated_ledger_events")
    .select("id")
    .eq("status", "PENDING");
  if (ledgerError) {
    return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  }

  for (const event of ledgerEvents || []) {
    results.push(await processLedgerEvent(supabase, event.id));
  }

  const { data: recipeEvents, error: recipeError } = await supabase
    .from("backdated_recipe_events")
    .select("id")
    .eq("status", "PENDING");
  if (recipeError) {
    return NextResponse.json({ error: recipeError.message }, { status: 500 });
  }

  for (const event of recipeEvents || []) {
    results.push(await processRecipeEvent(supabase, event.id));
  }

  const summary = {
    total_events: results.length,
    applied: results.filter(r => r.outcome === "applied").length,
    flagged: results.filter(r => r.outcome === "flagged").length,
    no_change: results.filter(r => r.outcome === "no_change").length,
    errors: results.filter(r => r.outcome === "error").length,
    total_delta_vnd_applied: results
      .filter(r => r.outcome === "applied")
      .reduce((sum, r) => sum + r.total_delta_vnd, 0),
    results,
  };

  return NextResponse.json(summary);
}

async function processLedgerEvent(
  supabase: ReturnType<typeof getSupabaseClient>,
  eventId: string,
): Promise<EventSweepResult> {
  try {
    const plan = await recomputeEventDryRun(eventId);
    return await settlePlan(supabase, "backdated_ledger_events", eventId, "ledger", plan.changes, () =>
      recomputeEventApply(eventId, REVIEWER),
    );
  } catch (error) {
    return {
      event_id: eventId,
      kind: "ledger",
      outcome: "error",
      change_count: 0,
      total_delta_vnd: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function processRecipeEvent(
  supabase: ReturnType<typeof getSupabaseClient>,
  eventId: string,
): Promise<EventSweepResult> {
  try {
    const plan = await recomputeRecipeEventDryRun(eventId);
    return await settlePlan(supabase, "backdated_recipe_events", eventId, "recipe", plan.changes, () =>
      recomputeRecipeEventApply(eventId, REVIEWER),
    );
  } catch (error) {
    return {
      event_id: eventId,
      kind: "recipe",
      outcome: "error",
      change_count: 0,
      total_delta_vnd: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function settlePlan(
  supabase: ReturnType<typeof getSupabaseClient>,
  table: "backdated_ledger_events" | "backdated_recipe_events",
  eventId: string,
  kind: "ledger" | "recipe",
  changes: Array<{ line_id: string; old_cost_at_sale: number; new_cost_at_sale: number }>,
  apply: () => Promise<unknown>,
): Promise<EventSweepResult> {
  const totalDeltaVnd = changes.reduce((sum, change) => sum + (change.new_cost_at_sale - change.old_cost_at_sale), 0);

  if (changes.length === 0) {
    return { event_id: eventId, kind, outcome: "no_change", change_count: 0, total_delta_vnd: 0 };
  }

  const classification = classifyBackdatedEventPlan(changes);
  if (classification.isAnomalous) {
    const { error } = await supabase
      .from(table)
      .update({ is_anomalous: true, anomaly_reason: classification.reason })
      .eq("id", eventId);
    if (error) throw new Error(error.message);
    return {
      event_id: eventId,
      kind,
      outcome: "flagged",
      change_count: changes.length,
      total_delta_vnd: totalDeltaVnd,
      reason: classification.reason ?? undefined,
    };
  }

  await apply();
  return { event_id: eventId, kind, outcome: "applied", change_count: changes.length, total_delta_vnd: totalDeltaVnd };
}
