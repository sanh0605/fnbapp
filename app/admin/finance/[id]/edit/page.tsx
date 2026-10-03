import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { getBankAccounts } from "@/app/admin/finance/bank-accounts/actions";
import { CashEntryForm } from "@/app/admin/finance/components/CashEntryForm";
import { safeReturnTo } from "@/app/admin/finance/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { formatNumber } from "@/lib/shared/format";
import type { DBCashEntry } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditCashEntryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance");

  const [entry, categories, accounts] = await Promise.all([
    findById("Cash_Entries", params.id) as Promise<DBCashEntry | null>,
    getCashCategories(),
    getBankAccounts(),
  ]);

  if (!entry || entry.status === "CANCELLED") {
    notFound();
  }

  const ownDetailPath = `/admin/finance/${encodeURIComponent(entry.id)}`;
  const ownDetailPathRaw = `/admin/finance/${entry.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/finance/")
    ? "/admin/finance"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/finance/${encodeURIComponent(entry.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  const category = categories.find((c) => c.id === entry.category_id);
  const backLabel = category
    ? `${category.name} · ${formatNumber(entry.amount)}đ`
    : entry.id;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={backLabel}
        title="Chỉnh sửa"
        subtitle={entry.id}
      />
      <CashEntryForm
        entry={entry}
        categories={categories}
        accounts={accounts}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
