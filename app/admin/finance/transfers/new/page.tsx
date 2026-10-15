import { getBankAccounts } from "@/app/admin/finance/bank-accounts/actions";
import { CashTransferForm } from "../components/CashTransferForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { saigonToday } from "@/lib/shared/datetime";

export const dynamic = "force-dynamic";

export default async function NewCashTransferPage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance", { detail: ["/admin/finance/transfers"] });
  const today = saigonToday();
  const accounts = await getBankAccounts();

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Sổ thu chi" />
      <PageHeader
        title="Tạo khoản chuyển tiền"
        subtitle="Chuyển tiền giữa két và tài khoản ngân hàng."
      />
      <CashTransferForm
        accounts={accounts}
        today={today}
        returnTo={returnTo}
      />
    </div>
  );
}
