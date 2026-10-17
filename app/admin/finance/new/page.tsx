import { getCashCategories } from "../categories/actions";
import { getBankAccounts } from "../bank-accounts/actions";
import { getMonthlyItems } from "@/app/admin/finance/monthly-items/actions";
import { CashEntryForm } from "../components/CashEntryForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
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
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel={returnTo === "/admin" ? "Tổng quan" : "Sổ thu chi"}
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
    </DetailFrame>
  );
}
