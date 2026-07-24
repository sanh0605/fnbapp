"use server";

import { requireAdmin } from "@/lib/auth";
import { findAllWhereInBatches } from "@/lib/sheets_db";
import { getSupabaseClient } from "@/lib/supabase";

const ACTIVITY_LOG_ITEMS_PER_PAGE = 20;

export type ActivityLogFilters = {
  page?: number;
  q?: string;
  type?: string;
  actor?: string;
  from?: string;
  to?: string;
};

export type ActivityLogEvent = {
  id: string;
  order_id: string;
  order_no: string;
  event_type: "CREATED" | "EDITED" | "VOIDED" | "REOPENED" | "MIGRATED";
  event_at: string;
  actor_id: string;
  actor_name: string;
  from_version?: number | string;
  to_version?: number | string;
  reason?: string;
  delta_json?: string;
};

export type ActivityLogResult = {
  events: ActivityLogEvent[];
  totalCount: number;
  itemsPerPage: number;
  actors: string[];
};

function sanitizeSearch(value: string | undefined): string {
  return String(value || "").replace(/[(),]/g, "").trim();
}

export async function getActivityLogEvents(
  filters: ActivityLogFilters = {},
): Promise<ActivityLogResult> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const page = Math.max(1, Math.floor(filters.page || 1));
  const offset = (page - 1) * ACTIVITY_LOG_ITEMS_PER_PAGE;
  const q = sanitizeSearch(filters.q);
  const supabase = getSupabaseClient();

  let matchingOrderIds: string[] = [];
  if (q) {
    const { data, error } = await supabase
      .from("orders_v2")
      .select("id")
      .ilike("order_no", `%${q}%`)
      .limit(200);
    if (error) throw new Error(`Activity-log order search: ${error.message}`);
    matchingOrderIds = (data || []).map((order: any) => String(order.id));
  }

  let eventsQuery: any = supabase
    .from("order_events")
    .select("*", { count: "exact" });
  if (filters.type) eventsQuery = eventsQuery.eq("event_type", filters.type);
  if (filters.actor) eventsQuery = eventsQuery.eq("actor_name", filters.actor);
  if (filters.from) eventsQuery = eventsQuery.gte("event_at", filters.from);
  if (filters.to) eventsQuery = eventsQuery.lte("event_at", filters.to);
  if (q) {
    const clauses = [
      `id.ilike.%${q}%`,
      `reason.ilike.%${q}%`,
      `actor_name.ilike.%${q}%`,
    ];
    if (matchingOrderIds.length > 0) {
      clauses.push(`order_id.in.(${matchingOrderIds.join(",")})`);
    }
    eventsQuery = eventsQuery.or(clauses.join(","));
  }
  eventsQuery = eventsQuery
    .order("event_at", { ascending: false })
    .range(offset, offset + ACTIVITY_LOG_ITEMS_PER_PAGE - 1);

  // A narrow actor-name scan is acceptable at the current scale. If this
  // becomes material, replace it with a distinct view/RPC rather than loading
  // complete event rows again.
  const actorsQuery = supabase
    .from("order_events")
    .select("actor_name")
    .not("actor_name", "is", null)
    .limit(5_000);

  const [eventResult, actorResult] = await Promise.all([eventsQuery, actorsQuery]);
  if (eventResult.error) throw new Error(`Activity-log events: ${eventResult.error.message}`);
  if (actorResult.error) throw new Error(`Activity-log actors: ${actorResult.error.message}`);

  const pageEvents = eventResult.data || [];
  const pageOrderIds = Array.from(new Set<string>(
    pageEvents.map((event: any) => String(event.order_id || "")).filter(Boolean),
  ));
  const pageOrders = await findAllWhereInBatches(
    "Orders_V2",
    "id",
    pageOrderIds,
  );
  const orderNoById = new Map(
    (pageOrders as any[]).map(order => [String(order.id), String(order.order_no || "")]),
  );

  return {
    events: pageEvents.map((event: any) => ({
      ...event,
      order_no: orderNoById.get(String(event.order_id)) || "Không rõ",
      delta_json: typeof event.delta_json === "string"
        ? event.delta_json
        : event.delta_json
          ? JSON.stringify(event.delta_json)
          : "",
    })),
    totalCount: Number(eventResult.count) || 0,
    itemsPerPage: ACTIVITY_LOG_ITEMS_PER_PAGE,
    actors: Array.from(new Set(
      (actorResult.data || [])
        .map((row: any) => String(row.actor_name || "").trim())
        .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right)),
  };
}
