import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { getBankAccounts } from "@/app/admin/finance/bank-accounts/actions";
import { safeReturnTo } from "@/lib/shared/return-to";
import { BankAccountDetailView } from "./components/BankAccountDetailView";

export const dynamic = "force-dynamic";

export default async function BankAccountDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [accounts, auth] = await Promise.all([
    getBankAccounts(),
    resolveActor(),
  ]);

  const account = accounts.find((a) => a.id === params.id);
  if (!account) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined,
    "/admin/finance/bank-accounts",
  );
  const returnTo = rawReturnTo.startsWith("/admin/finance/bank-accounts/")
    ? "/admin/finance/bank-accounts"
    : rawReturnTo;

  return (
    <BankAccountDetailView
      account={account}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
