import { Suspense } from "react";
import { resolveActor } from "@/lib/auth/auth";
import { getFinancePageData } from "./actions";
import CashBookClient from "./components/CashBookClient";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { Button } from "@/components/ui/Button";
import { saigonToday } from "@/lib/shared/datetime";
import { readRangeParams, writeRangeParams } from "@/lib/shared/date-range-params";

export const dynamic = "force-dynamic";

const readParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function FinancePage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const today = saigonToday();
  const range = readRangeParams(searchParams ?? {}, today, "THIS_MONTH");

  const rawKind = readParam(searchParams?.kind);
  const rawStatus = readParam(searchParams?.status);
  const rawPage = readParam(searchParams?.page);
  const rawSort = readParam(searchParams?.sort);
  const rawDir = readParam(searchParams?.dir);

  const [{ rows, summary, categories, accounts }, auth] = await Promise.all([
    getFinancePageData(range.start, range.end),
    resolveActor(),
  ]);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const p = new URLSearchParams();
  writeRangeParams(p, range);
  if (rawKind && rawKind !== "ALL") p.set("kind", rawKind);
  if (rawStatus && rawStatus !== "ACTIVE") p.set("status", rawStatus);
  if (rawPage && rawPage !== "1") p.set("page", rawPage);
  if (rawSort) p.set("sort", rawSort);
  if (rawDir) p.set("dir", rawDir);
  const qs = p.toString();
  const currentListUrl = qs ? `/admin/finance?${qs}` : "/admin/finance";

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Thu chi"
        title="Sổ thu chi"
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <Button
              href={`/admin/finance/transfers/new?returnTo=${encodeURIComponent(currentListUrl)}`}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              Chuyển tiền
            </Button>
            <Button
              href={`/admin/finance/new?returnTo=${encodeURIComponent(currentListUrl)}`}
              variant="primary"
              className="w-full sm:w-auto"
            >
              Tạo
            </Button>
          </div>
        }
      />
      <Suspense fallback={<div>Đang tải...</div>}>
        <CashBookClient
          rows={rows}
          summary={summary}
          categories={categories}
          accounts={accounts}
          canDelete={canDelete}
          today={today}
          resolvedRange={range}
          initialKind={rawKind}
          initialStatus={rawStatus}
          initialPage={rawPage}
        />
      </Suspense>
    </div>
  );
}
