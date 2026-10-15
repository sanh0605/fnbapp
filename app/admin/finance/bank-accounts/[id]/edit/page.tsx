import { notFound } from "next/navigation";
import { getBankAccounts } from "../../actions";
import { BankAccountForm } from "../../components/BankAccountForm";
import { safeReturnTo } from "@/app/admin/finance/components/return-to";
import { editBackHref } from "@/lib/finance/detail-href";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditBankAccountPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/finance/bank-accounts",
  );
  const accounts = await getBankAccounts();
  const account = accounts.find((a) => a.id === params.id);

  if (!account) {
    notFound();
  }

  const detailHref = editBackHref(rawReturnTo, "/admin/finance/bank-accounts", account.id);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={account.name}
        title="Chỉnh sửa"
        subtitle={account.name}
      />
      <BankAccountForm account={account} returnTo={detailHref} />
    </DetailFrame>
  );
}
