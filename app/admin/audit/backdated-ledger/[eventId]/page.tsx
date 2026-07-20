import { getSupabaseClient } from "@/lib/supabase";
import { recomputeEventDryRun } from "@/lib/backdated-ledger/recompute-event";
import { recomputeRecipeEventDryRun } from "@/lib/backdated-recipe-events/recompute-event";
import { EventDetail } from "@/components/backdated-ledger/event-detail";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { eventId: string } }) {
  const supabase = getSupabaseClient();

  const { data: ledgerEvent } = await supabase
    .from("backdated_ledger_events")
    .select("*")
    .eq("id", params.eventId)
    .maybeSingle();

  let event = ledgerEvent;
  let kind: "ledger" | "recipe" = "ledger";

  if (!event) {
    const { data: recipeEvent } = await supabase
      .from("backdated_recipe_events")
      .select("*")
      .eq("id", params.eventId)
      .maybeSingle();
    if (recipeEvent) {
      // Normalize to the same shape the existing EventDetail component
      // already renders (see app/admin/audit/backdated-ledger/page.tsx's
      // list-view normalization for the same mapping).
      event = {
        ...recipeEvent,
        source_table: "recipes",
        source_id: recipeEvent.recipe_id,
        item_reference: recipeEvent.target_id,
        quantity_change: null,
        unit_cost: null,
      };
      kind = "recipe";
    }
  }

  if (!event) {
    notFound();
  }

  let plan = null;
  if (event.status === "PENDING" || event.status === "RECOMPUTED") {
    try {
      plan = kind === "ledger"
        ? await recomputeEventDryRun(event.id)
        : await recomputeRecipeEventDryRun(event.id);
    } catch (e) {
      console.error("Dry run failed:", e);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-8">
      <div>
        <Link href="/admin/audit/backdated-ledger" className="text-primary hover:underline text-sm font-medium">
          ← Quay lại danh sách
        </Link>
      </div>
      <EventDetail event={event} plan={plan} />
    </div>
  );
}
