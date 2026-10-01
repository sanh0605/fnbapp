import Link from "next/link";
import { resolveActor } from "@/lib/auth/auth";
import { getFinancePageData } from "./actions";
import { CashEntriesList } from "./components/CashEntriesList";
import { FinanceFilterBar } from "./components/FinanceFilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import { readParam, resolveDateRange } from "./resolve-date-range";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const today = toSaigonIsoString(new Date()).slice(0, 10);

  const rawPreset = readParam(searchParams?.preset);
  let listHref = "/admin/finance";
  if (rawPreset) {
    const params = new URLSearchParams({ preset: rawPreset });
    if (rawPreset === "CUSTOM") {
      const rawStart = readParam(searchParams?.start);
      const rawEnd = readParam(searchParams?.end);
      if (rawStart) params.set("start", rawStart);
      if (rawEnd) params.set("end", rawEnd);
    }
    listHref = `/admin/finance?${params.toString()}`;
  }

  const { preset, start, end } = resolveDateRange(
    readParam(searchParams?.preset),
    readParam(searchParams?.start),
    readParam(searchParams?.end),
    today,
  );

  const [{ entries, categories, accounts }, auth] = await Promise.all([
    getFinancePageData(start, end),
    resolveActor(),
  ]);
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sổ thu chi"
        subtitle="Ghi các khoản chi và thu ngoài bán hàng, mua hàng."
        actions={
          <Link
            href={`/admin/finance/new?returnTo=${encodeURIComponent(listHref)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition inline-flex items-center justify-center min-h-[44px]"
          >
            + Ghi khoản mới
          </Link>
        }
      />
      <FinanceFilterBar value={{ preset, start, end }} today={today} />
      <CashEntriesList
        entries={entries}
        categories={categories}
        accounts={accounts}
        canDelete={canDelete}
        returnTo={listHref}
      />
    </div>
  );
}
