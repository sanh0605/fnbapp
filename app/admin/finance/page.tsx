import { Suspense } from "react";
import { getFinancePageData, getCashBookMonths } from "./actions";
import CashBookClient from "./components/CashBookClient";
import CashBookMonthsClient from "./components/CashBookMonthsClient";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { Button } from "@/components/ui/Button";
import { saigonToday } from "@/lib/shared/datetime";
import {
  readRangeParams,
  readMonthRangeParams,
  writeRangeParams,
} from "@/lib/shared/date-range-params";

export const dynamic = "force-dynamic";

const readParam = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

function tabHref(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  targetView: "list" | "months",
): string {
  const p = new URLSearchParams();
  if (targetView === "months") {
    p.set("view", "months");
  }
  const rawRange = readParam(searchParams?.range);
  const rawFrom = readParam(searchParams?.from);
  const rawTo = readParam(searchParams?.to);
  const rawYear = readParam(searchParams?.year);

  if (rawRange) p.set("range", rawRange);
  if (rawFrom) p.set("from", rawFrom);
  if (rawTo) p.set("to", rawTo);
  if (rawYear) p.set("year", rawYear);

  const qs = p.toString();
  return qs ? `/admin/finance?${qs}` : "/admin/finance";
}

export default async function FinancePage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const today = saigonToday();
  const rawView = readParam(searchParams?.view);
  const isMonthsView = rawView === "months";

  const listTabHref = tabHref(searchParams, "list");
  const monthsTabHref = tabHref(searchParams, "months");

  const rawQ = readParam(searchParams?.q);
  const rawKind = readParam(searchParams?.kind);
  const rawStatus = readParam(searchParams?.status);
  const rawPage = readParam(searchParams?.page);
  const rawSort = readParam(searchParams?.sort);
  const rawDir = readParam(searchParams?.dir);

  const monthRange = isMonthsView
    ? readMonthRangeParams(searchParams ?? {}, today)
    : null;

  const dayRange = !isMonthsView
    ? readRangeParams(searchParams ?? {}, today, "THIS_MONTH")
    : null;

  const [monthsData, financeData] = await Promise.all([
    isMonthsView ? getCashBookMonths() : Promise.resolve(null),
    dayRange
      ? getFinancePageData(dayRange.start, dayRange.end)
      : Promise.resolve(null),
  ]);

  const p = new URLSearchParams();
  if (isMonthsView && monthRange) {
    p.set("view", "months");
    writeRangeParams(p, monthRange);
  } else if (dayRange) {
    writeRangeParams(p, dayRange);
    if (rawQ && rawQ.trim()) p.set("q", rawQ.trim());
    if (rawKind && rawKind !== "ALL") p.set("kind", rawKind);
    if (rawStatus && rawStatus !== "ACTIVE") p.set("status", rawStatus);
    if (rawPage && rawPage !== "1") p.set("page", rawPage);
    if (rawSort) p.set("sort", rawSort);
    if (rawDir) p.set("dir", rawDir);
  }
  const qs = p.toString();
  const currentUrl = qs ? `/admin/finance?${qs}` : "/admin/finance";

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Thu chi"
        title="Sổ thu chi"
        action={
          <div className="flex items-center gap-2">
            <Button
              href={`/admin/finance/transfers/new?returnTo=${encodeURIComponent(currentUrl)}`}
              variant="secondary"
            >
              Chuyển tiền
            </Button>
            <Button
              href={`/admin/finance/new?returnTo=${encodeURIComponent(currentUrl)}`}
              variant="primary"
            >
              Tạo
            </Button>
          </div>
        }
      />

      <div className="flex gap-2">
        <Button
          href={listTabHref}
          variant={isMonthsView ? "secondary" : "primary"}
          className="flex-1 md:flex-none"
        >
          Sổ thu chi
        </Button>
        <Button
          href={monthsTabHref}
          variant={isMonthsView ? "primary" : "secondary"}
          className="flex-1 md:flex-none"
        >
          Theo tháng
        </Button>
      </div>

      {isMonthsView && monthsData && monthRange ? (
        <Suspense fallback={<div>Đang tải...</div>}>
          <CashBookMonthsClient
            months={monthsData}
            range={monthRange}
            today={today}
          />
        </Suspense>
      ) : financeData && dayRange ? (
        <Suspense fallback={<div>Đang tải...</div>}>
          <CashBookClient
            rows={financeData.rows}
            summary={financeData.summary}
            today={today}
            resolvedRange={dayRange}
            initialSearch={rawQ}
            initialKind={rawKind}
            initialStatus={rawStatus}
            initialPage={rawPage}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
