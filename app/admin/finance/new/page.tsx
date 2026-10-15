import { getCashCategories } from "../categories/actions";
import { getBankAccounts } from "../bank-accounts/actions";
import { getMonthlyItems } from "@/app/admin/finance/monthly-items/actions";
import { CashEntryForm } from "../components/CashEntryForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { toSaigonIsoString } from "@/lib/shared/datetime";

export const dynamic = "force-dynamic";

export default async function NewCashEntryPage(
  props: {
    searchParams?: Promise<{ returnTo?: string; monthlyItem?: string; month?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance");
  const initialMonthlyItemId =
    typeof searchParams?.monthlyItem === "string" ? searchParams.monthlyItem : undefined;
  const rawMonth = typeof searchParams?.month === "string" ? searchParams.month : undefined;
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : undefined;
  const today = toSaigonIsoString(new Date()).slice(0, 10);
  const [categories, accounts, monthlyItemRows] = await Promise.all([
    getCashCategories(),
    getBankAccounts(),
    getMonthlyItems(),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label={returnTo === "/admin" ? "Tổng quan" : "Sổ thu chi"} />
      <PageHeader
        title="Tạo khoản thu chi"
        subtitle="Ghi các khoản chi và thu ngoài bán hàng, mua hàng."
      />
      <CashEntryForm
        categories={categories}
        accounts={accounts}
        monthlyItems={monthlyItemRows.map((r) => r.item)}
        initialMonthlyItemId={initialMonthlyItemId}
        month={month}
        today={today}
        returnTo={returnTo}
      />
    </div>
  );
}
