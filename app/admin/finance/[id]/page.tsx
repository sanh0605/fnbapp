import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { getBankAccounts } from "@/app/admin/finance/bank-accounts/actions";
import { safeReturnTo } from "@/lib/shared/return-to";
import { CashEntryDetailView } from "./components/CashEntryDetailView";
import type { DBCashEntry, DBMonthlyExpenseItem } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function CashEntryDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [entry, categories, accounts, auth] = await Promise.all([
    findById("Cash_Entries", params.id) as Promise<DBCashEntry | null>,
    getCashCategories(),
    getBankAccounts(),
    resolveActor(),
  ]);

  if (!entry) {
    notFound();
  }

  const monthlyItem = entry.monthly_item_id
    ? ((await findById("Monthly_Expense_Items", entry.monthly_item_id)) as DBMonthlyExpenseItem | null)
    : null;

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
      monthlyItemName={monthlyItem?.name}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
