import { BankAccountForm } from "../components/BankAccountForm";
import { safeReturnTo } from "../../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewBankAccountPage({ searchParams }: { searchParams?: { returnTo?: string } }) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/bank-accounts");
  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Tài khoản ngân hàng" />
      <PageHeader title="Thêm tài khoản ngân hàng" subtitle="Khai báo tài khoản để ghi các khoản chuyển khoản." />
      <BankAccountForm returnTo={returnTo} />
    </div>
  );
}
