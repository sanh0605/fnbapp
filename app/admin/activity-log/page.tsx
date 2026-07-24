import { Suspense } from "react";

import { getActivityLogEvents } from "./actions";
import ActivityLogClient from "./components/ActivityLogClient";

export const dynamic = "force-dynamic";

function toStartOfDayIso(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toISOString();
}

function toEndOfDayIso(dateOnly: string): string {
  return new Date(`${dateOnly}T23:59:59.999`).toISOString();
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const getParam = (key: string) => {
    const value = searchParams?.[key];
    return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  };
  const page = parseInt(getParam("page") || "1", 10) || 1;
  const from = getParam("from");
  const to = getParam("to");

  const result = await getActivityLogEvents({
    page,
    q: getParam("q"),
    type: getParam("type"),
    actor: getParam("actor"),
    from: from ? toStartOfDayIso(from) : undefined,
    to: to ? toEndOfDayIso(to) : undefined,
  });

  return (
    <Suspense fallback={<div className="py-8 text-center text-sm font-semibold text-text-muted">Đang tải nhật ký...</div>}>
      <ActivityLogClient
        initialEvents={result.events}
        actors={result.actors}
        totalCount={result.totalCount}
        itemsPerPage={result.itemsPerPage}
      />
    </Suspense>
  );
}
