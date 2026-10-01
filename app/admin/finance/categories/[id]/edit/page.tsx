import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getCashCategories } from "../../actions";
import { CategoryForm } from "../../components/CategoryForm";
import { safeReturnTo } from "../../../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBCashEntry } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditCashCategoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/categories");
  const [categories, entries] = await Promise.all([
    getCashCategories(),
    findAll("Cash_Entries") as Promise<DBCashEntry[]>,
  ]);
  const category = categories.find((c) => c.id === params.id);

  if (!category) {
    notFound();
  }

  const hasEntries = entries.some((e) => e.category_id === category.id);

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhóm thu chi" />
      <PageHeader
        title={`Sửa nhóm thu chi: ${category.name}`}
        subtitle="Cập nhật tên và cách tính của nhóm."
      />
      <CategoryForm category={category} hasEntries={hasEntries} returnTo={returnTo} />
    </div>
  );
}
