import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { getBankAccounts } from "@/app/admin/finance/bank-accounts/actions";
import { getCashTransfer } from "../actions";
import { safeReturnTo } from "../components/return-to";
import { CashTransferDetailView } from "./components/CashTransferDetailView";

export const dynamic = "force-dynamic";

export default async function CashTransferDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [transfer, accounts, auth] = await Promise.all([
    getCashTransfer(params.id),
    getBankAccounts(),
    resolveActor(),
  ]);

  if (!transfer) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined,
    "/admin/finance",
  );
  const returnTo = rawReturnTo.startsWith("/admin/finance/transfers/")
    ? "/admin/finance"
    : rawReturnTo;

  return (
    <CashTransferDetailView
      transfer={transfer}
      accounts={accounts}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
