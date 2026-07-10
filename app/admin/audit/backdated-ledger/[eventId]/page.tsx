import { getSupabaseClient } from "@/lib/supabase";
import { recomputeEventDryRun } from "@/lib/backdated-ledger/recompute-event";
import { EventDetail } from "@/components/backdated-ledger/event-detail";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { eventId: string } }) {
  const supabase = getSupabaseClient();
  const { data: event, error } = await supabase
    .from("backdated_ledger_events")
    .select("*")
    .eq("id", params.eventId)
    .single();

  if (error || !event) {
    notFound();
  }

  let plan = null;
  if (event.status === "PENDING" || event.status === "RECOMPUTED") {
    try {
      plan = await recomputeEventDryRun(event.id);
    } catch (e) {
      console.error("Dry run failed:", e);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-8">
      <div>
        <Link href="/admin/audit/backdated-ledger" className="text-blue-600 hover:underline text-sm font-medium">
          ← Quay lại danh sách
        </Link>
      </div>
      <EventDetail event={event} plan={plan} />
    </div>
  );
}
