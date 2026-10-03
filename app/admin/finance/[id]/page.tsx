import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { getBankAccounts } from "@/app/admin/finance/bank-accounts/actions";
import { safeReturnTo } from "@/app/admin/finance/components/return-to";
import { CashEntryDetailView } from "./components/CashEntryDetailView";
import type { DBCashEntry } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function CashEntryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [entry, categories, accounts, auth] = await Promise.all([
    findById("Cash_Entries", params.id) as Promise<DBCashEntry | null>,
    getCashCategories(),
    getBankAccounts(),
    resolveActor(),
  ]);

  if (!entry) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined,
    "/admin/finance",
  );
  const returnTo = rawReturnTo.startsWith("/admin/finance/")
    ? "/admin/finance"
    : rawReturnTo;

  return (
    <CashEntryDetailView
      entry={entry}
      categories={categories}
      accounts={accounts}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
