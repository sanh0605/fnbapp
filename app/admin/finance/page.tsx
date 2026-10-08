import { Suspense } from "react";
import { resolveActor } from "@/lib/auth/auth";
import { getFinancePageData } from "./actions";
import CashBookClient from "./components/CashBookClient";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { Button } from "@/components/ui/Button";
import { saigonToday } from "@/lib/shared/datetime";
import { readParam, resolveDateRange } from "./resolve-date-range";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const today = saigonToday();

  const rawPreset = readParam(searchParams?.preset);
  const rawStart = readParam(searchParams?.start);
  const rawEnd = readParam(searchParams?.end);
  const rawKind = readParam(searchParams?.kind);
  const rawStatus = readParam(searchParams?.status);
  const rawPage = readParam(searchParams?.page);
  const rawSort = readParam(searchParams?.sort);
  const rawDir = readParam(searchParams?.dir);

  const { preset, start, end } = resolveDateRange(
    rawPreset,
    rawStart,
    rawEnd,
    today,
  );

  const [{ rows, summary, categories, accounts }, auth] = await Promise.all([
    getFinancePageData(start, end),
    resolveActor(),
  ]);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const p = new URLSearchParams();
  if (preset) p.set("preset", preset);
  if (preset === "CUSTOM") {
    if (start) p.set("start", start);
    if (end) p.set("end", end);
  }
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
          resolvedRange={{ preset, start, end }}
          initialKind={rawKind}
          initialStatus={rawStatus}
          initialPage={rawPage}
        />
      </Suspense>
    </div>
  );
}
