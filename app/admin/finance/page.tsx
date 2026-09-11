import { resolveActor } from "@/lib/auth/auth";
import { getFinancePageData } from "./actions";
import { CashEntriesList } from "./components/CashEntriesList";
import { CashEntryForm } from "./components/CashEntryForm";
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
        actions={<CashEntryForm categories={categories} accounts={accounts} today={today} />}
      />
      <FinanceFilterBar value={{ preset, start, end }} today={today} />
      <CashEntriesList entries={entries} categories={categories} accounts={accounts} canDelete={canDelete} />
    </div>
  );
}
