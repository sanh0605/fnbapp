import { getCashCategories } from "../categories/actions";
import { getBankAccounts } from "../bank-accounts/actions";
import { CashEntryForm } from "../components/CashEntryForm";
import { safeReturnTo } from "../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { toSaigonIsoString } from "@/lib/shared/datetime";

export const dynamic = "force-dynamic";

export default async function NewCashEntryPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance");
  const today = toSaigonIsoString(new Date()).slice(0, 10);
  const [categories, accounts] = await Promise.all([
    getCashCategories(),
    getBankAccounts(),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Sổ thu chi" />
      <PageHeader
        title="Ghi khoản thu chi"
        subtitle="Ghi các khoản chi và thu ngoài bán hàng, mua hàng."
      />
      <CashEntryForm
        categories={categories}
        accounts={accounts}
        today={today}
        returnTo={returnTo}
      />
    </div>
  );
}
