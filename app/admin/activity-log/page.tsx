import { Suspense } from "react";

import { getActivityLogEvents } from "./actions";
import ActivityLogClient from "./components/ActivityLogClient";
import { toSaigonUtcRange } from "@/lib/shared/report-time";
import { saigonToday } from "@/lib/shared/datetime";
import { readRangeParams } from "@/lib/shared/date-range-params";

export const dynamic = "force-dynamic";

function toStartOfDayIso(dateOnly: string): string {
  return toSaigonUtcRange(dateOnly, dateOnly)!.startUtc.toISOString();
}

function toEndOfDayIso(dateOnly: string): string {
  return toSaigonUtcRange(dateOnly, dateOnly)!.endUtc.toISOString();
}

export default async function ActivityLogPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const getParam = (key: string) => {
    const value = searchParams?.[key];
    return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  };

  const today = saigonToday();
  const range = readRangeParams(searchParams ?? {}, today, "THIS_MONTH");
  const q = getParam("q");
  const searching = Boolean(q?.trim());

  const page = parseInt(getParam("page") || "1", 10) || 1;

  const result = await getActivityLogEvents({
    page,
    q,
    type: getParam("type"),
    actor: getParam("actor"),
    from: searching ? undefined : toStartOfDayIso(range.start),
    to: searching ? undefined : toEndOfDayIso(range.end),
  });

  return (
    <Suspense fallback={<div className="py-8 text-center text-sm font-semibold text-text-muted">Đang tải nhật ký...</div>}>
      <ActivityLogClient
        initialEvents={result.events}
        actors={result.actors}
        totalCount={result.totalCount}
        itemsPerPage={result.itemsPerPage}
        range={range}
        today={today}
        searching={searching}
      />
    </Suspense>
  );
}
