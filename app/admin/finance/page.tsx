import { Suspense } from "react";
import Link from "next/link";
import { resolveActor } from "@/lib/auth/auth";
import { getFinancePageData } from "./actions";
import CashBookClient from "./components/CashBookClient";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import { readParam, resolveDateRange } from "./resolve-date-range";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const today = toSaigonIsoString(new Date()).slice(0, 10);

  const rawPreset = readParam(searchParams?.preset);
  const rawStart = readParam(searchParams?.start);
  const rawEnd = readParam(searchParams?.end);
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

  const [{ entries, categories, accounts }, auth] = await Promise.all([
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
          <Link
            href={`/admin/finance/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            + Ghi khoản mới
          </Link>
        }
      />
      <Suspense fallback={<div>Đang tải...</div>}>
        <CashBookClient
          entries={entries}
          categories={categories}
          accounts={accounts}
          canDelete={canDelete}
          today={today}
          resolvedRange={{ preset, start, end }}
          initialStatus={rawStatus}
          initialPage={rawPage}
        />
      </Suspense>
    </div>
  );
}
