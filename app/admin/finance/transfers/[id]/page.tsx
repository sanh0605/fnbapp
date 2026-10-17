import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { loadStaffNameResolver } from "@/lib/auth/staff-names";
import { getBankAccounts } from "@/app/admin/finance/bank-accounts/actions";
import { getCashTransfer } from "../actions";
import { safeReturnTo } from "@/lib/shared/return-to";
import { CashTransferDetailView } from "./components/CashTransferDetailView";

export const dynamic = "force-dynamic";

export default async function CashTransferDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [transfer, accounts, auth, staffName] = await Promise.all([
    getCashTransfer(params.id),
    getBankAccounts(),
    resolveActor(),
    loadStaffNameResolver(),
  ]);

  if (!transfer) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined,
    "/admin/finance", { detail: ["/admin/finance/transfers"] });
  const returnTo = rawReturnTo.startsWith("/admin/finance/transfers/")
    ? "/admin/finance"
    : rawReturnTo;

  return (
    <CashTransferDetailView
      transfer={{ ...transfer, created_by_name: staffName(transfer.created_by_name, transfer.created_by_id) }}
      accounts={accounts}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
