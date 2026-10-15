import { notFound } from "next/navigation";
import { getBankAccounts } from "@/app/admin/finance/bank-accounts/actions";
import { getCashTransfer } from "../../actions";
import { CashTransferForm } from "../../components/CashTransferForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { editBackHref } from "@/lib/finance/detail-href";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { formatNumber } from "@/lib/shared/format";
import type { DBCashTransfer } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditCashTransferPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance", { detail: ["/admin/finance/transfers"] });

  const [transfer, accounts] = await Promise.all([
    getCashTransfer(params.id) as Promise<DBCashTransfer | null>,
    getBankAccounts(),
  ]);

  if (!transfer || transfer.status === "CANCELLED") {
    notFound();
  }

  const detailHref = editBackHref(rawReturnTo, "/admin/finance/transfers", transfer.id, "/admin/finance");

  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const fromText =
    transfer.from_account_id === null
      ? "Tiền mặt (két)"
      : (accountNames.get(transfer.from_account_id) ?? transfer.from_account_id);
  const toText =
    transfer.to_account_id === null
      ? "Tiền mặt (két)"
      : (accountNames.get(transfer.to_account_id) ?? transfer.to_account_id);
  const backLabel = `${fromText} → ${toText} · ${formatNumber(transfer.amount)}đ`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={backLabel}
        title="Chỉnh sửa"
        subtitle={transfer.id}
      />
      <CashTransferForm
        transfer={transfer}
        accounts={accounts}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
