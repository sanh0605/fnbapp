import { notFound } from "next/navigation";
import { findAllWhere } from "@/lib/db/tables";
import { getCashCategories } from "../../actions";
import { CategoryForm } from "../../components/CategoryForm";
import { safeReturnTo } from "@/app/admin/finance/components/return-to";
import { editBackHref } from "@/lib/finance/detail-href";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditCashCategoryPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/finance/categories",
  );

  const [categories, linked] = await Promise.all([
    getCashCategories(),
    findAllWhere("Cash_Entries", { eq: { category_id: params.id }, limit: 1 }),
  ]);
  const category = categories.find((c) => c.id === params.id);

  if (!category) {
    notFound();
  }

  const detailHref = editBackHref(rawReturnTo, "/admin/finance/categories", category.id);

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
        hasEntries={linked.length > 0}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
