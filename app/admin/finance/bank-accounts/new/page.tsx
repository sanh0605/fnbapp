import { BankAccountForm } from "../components/BankAccountForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewBankAccountPage(props: { searchParams?: Promise<{ returnTo?: string }> }) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/bank-accounts");
  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Tài khoản ngân hàng" />
      <PageHeader title="Tạo tài khoản ngân hàng" subtitle="Khai báo tài khoản để ghi các khoản chuyển khoản." />
      <BankAccountForm returnTo={returnTo} />
    </div>
  );
}
