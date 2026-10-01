import { notFound } from "next/navigation";
import { getBankAccounts } from "../../actions";
import { BankAccountForm } from "../../components/BankAccountForm";
import { safeReturnTo } from "../../../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditBankAccountPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/bank-accounts");
  const accounts = await getBankAccounts();
  const account = accounts.find((a) => a.id === params.id);

  if (!account) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Tài khoản ngân hàng" />
      <PageHeader
        title={`Sửa tài khoản: ${account.name}`}
        subtitle="Cập nhật thông tin tài khoản ngân hàng."
      />
      <BankAccountForm account={account} returnTo={returnTo} />
    </div>
  );
}
