import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { CategoryForm } from "@/app/admin/inventory/components/CategoryForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import type { DBItemCategory } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const category = (await findById("Item_Categories", params.id)) as DBItemCategory | null;
  if (!category) {
    notFound();
  }

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/categories");
  const listReturnTo = rawReturnTo.startsWith("/admin/inventory/categories/")
    ? "/admin/inventory/categories"
    : rawReturnTo;

  const detailHref = `/admin/inventory/categories/${encodeURIComponent(category.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={category.name}
        title="Chỉnh sửa"
        subtitle={category.name}
      />
      <CategoryForm initialData={category} returnTo={detailHref} />
    </DetailFrame>
  );
}
