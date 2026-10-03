import { Suspense } from "react";
import { resolveActor } from "@/lib/auth/auth";
import { getBankAccounts } from "./actions";
import BankAccountsClient from "./components/BankAccountsClient";

export const dynamic = "force-dynamic";

export default async function BankAccountsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; page?: string };
}) {
  const [accounts, auth] = await Promise.all([
    getBankAccounts(),
    resolveActor(),
  ]);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <BankAccountsClient
        accounts={accounts}
        canDelete={canDelete}
        initialSearch={searchParams?.q}
        initialStatus={searchParams?.status}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
