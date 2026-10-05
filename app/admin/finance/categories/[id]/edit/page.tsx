import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getCashCategories } from "../../actions";
import { CategoryForm } from "../../components/CategoryForm";
import { safeReturnTo } from "@/app/admin/finance/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import type { DBCashEntry } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditCashCategoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/finance/categories",
  );

  const [categories, entries] = await Promise.all([
    getCashCategories(),
    findAll("Cash_Entries") as Promise<DBCashEntry[]>,
  ]);
  const category = categories.find((c) => c.id === params.id);

  if (!category) {
    notFound();
  }

  const hasEntries = entries.some((e) => e.category_id === category.id);

  const ownDetailPath = `/admin/finance/categories/${encodeURIComponent(category.id)}`;
  const ownDetailPathRaw = `/admin/finance/categories/${category.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/finance/categories/")
    ? "/admin/finance/categories"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/finance/categories/${encodeURIComponent(category.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={category.name}
        title="Chỉnh sửa"
        subtitle={category.name}
      />
      <CategoryForm
        category={category}
        hasEntries={hasEntries}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
