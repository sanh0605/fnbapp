import { notFound } from "next/navigation";
import { getBankAccounts } from "../../actions";
import { BankAccountForm } from "../../components/BankAccountForm";
import { safeReturnTo } from "@/app/admin/finance/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditBankAccountPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/finance/bank-accounts",
  );
  const accounts = await getBankAccounts();
  const account = accounts.find((a) => a.id === params.id);

  if (!account) {
    notFound();
  }

  const ownDetailPath = `/admin/finance/bank-accounts/${encodeURIComponent(account.id)}`;
  const ownDetailPathRaw = `/admin/finance/bank-accounts/${account.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/finance/bank-accounts/")
    ? "/admin/finance/bank-accounts"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/finance/bank-accounts/${encodeURIComponent(account.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

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
