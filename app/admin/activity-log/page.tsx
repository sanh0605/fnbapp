import { findAll } from "@/lib/sheets_db";
import ActivityLogClient from "./components/ActivityLogClient";

export const dynamic = "force-dynamic";

export default async function ActivityLogPage() {
  const [events, orders] = await Promise.all([
    findAll("Order_Events"),
    findAll("Orders_V2"),
  ]);

  // Build a map of order_id -> order_no
  const orderMap: Record<string, string> = {};
  orders.forEach((o: any) => {
    orderMap[o.id] = o.order_no;
  });

  // Enrich events with order numbers
  const enrichedEvents = events.map((evt: any) => ({
    ...evt,
    order_no: orderMap[evt.order_id] || "Không rõ",
  }));

  // Sort by event_at descending (newest first)
  enrichedEvents.sort((a: any, b: any) => {
    return new Date(b.event_at || 0).getTime() - new Date(a.event_at || 0).getTime();
  });

  // Extract unique actors for filtering dropdown
  const uniqueActors: string[] = Array.from(
    new Set(events.map((e: any) => e.actor_name).filter(Boolean))
  );

  return (
    <ActivityLogClient initialEvents={enrichedEvents} actors={uniqueActors} />
  );
}
