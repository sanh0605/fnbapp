import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { getCashCategories } from "../../categories/actions";
import { getBankAccounts } from "../../bank-accounts/actions";
import { CashEntryForm } from "../../components/CashEntryForm";
import { safeReturnTo } from "../../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBCashEntry } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditCashEntryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance");

  const [entry, categories, accounts] = await Promise.all([
    findById("Cash_Entries", params.id) as Promise<DBCashEntry | null>,
    getCashCategories(),
    getBankAccounts(),
  ]);

  if (!entry || entry.status === "CANCELLED") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Sổ thu chi" />
      <PageHeader
        title="Sửa dòng sổ"
        subtitle="Cập nhật thông tin khoản thu chi."
      />
      <CashEntryForm
        entry={entry}
        categories={categories}
        accounts={accounts}
        returnTo={returnTo}
      />
    </div>
  );
}
