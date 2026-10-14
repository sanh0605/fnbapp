import { Suspense } from "react";
import { getOrdersV2 } from "./actions";
import OrderTable from "./OrderTable";
import { toSaigonUtcRange } from "@/lib/shared/report-time";
import { saigonToday } from "@/lib/shared/datetime";
import { readRangeParams } from "@/lib/shared/date-range-params";

export const dynamic = "force-dynamic";

// "from"/"to" arrive as date-only (yyyy-mm-dd) from OrderTable's URL sync;
// expand to full-day bounds so a selected day is inclusive on both ends,
// whole days in Asia/Saigon (BR-DATA-006), whatever zone the server runs in.
function toStartOfDayIso(dateOnly: string): string {
  return toSaigonUtcRange(dateOnly, dateOnly)!.startUtc.toISOString();
}
function toEndOfDayIso(dateOnly: string): string {
  return toSaigonUtcRange(dateOnly, dateOnly)!.endUtc.toISOString();
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const getParam = (key: string) => {
    const val = searchParams?.[key];
    return typeof val === "string" ? val : Array.isArray(val) ? val[0] : undefined;
  };

  const today = saigonToday();
  const range = readRangeParams(searchParams ?? {}, today, "THIS_MONTH");

  const page = parseInt(getParam("page") || "1", 10) || 1;
  const q = getParam("q");
  const searching = Boolean(q?.trim());

  const payment = getParam("payment") || undefined;
  const brand = getParam("brand") || undefined;
  const status = getParam("status");

  const { orders, totalCount, totals, itemsPerPage, brands } = await getOrdersV2({
    page,
    q: q || undefined,
    from: searching ? undefined : toStartOfDayIso(range.start),
    to: searching ? undefined : toEndOfDayIso(range.end),
    payment,
    brand,
    status,
  });

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="text-text-muted py-8 text-center text-sm font-semibold">Đang tải danh sách đơn hàng...</div>}>
        <OrderTable
          initialOrders={orders as any}
          totalCount={totalCount}
          totals={totals}
          itemsPerPage={itemsPerPage}
          brands={brands}
          range={range}
          today={today}
          searching={searching}
        />
      </Suspense>
    </div>
  );
}
