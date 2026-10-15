import { notFound } from "next/navigation";
import { safeReturnTo } from "@/lib/shared/return-to";
import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { getMonthlyItem } from "../../actions";
import { MonthlyItemForm } from "../../components/MonthlyItemForm";
import { editBackHref } from "@/lib/finance/detail-href";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditMonthlyItemPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/monthly-items");

  const [item, categories] = await Promise.all([
    getMonthlyItem(params.id),
    getCashCategories(),
  ]);

  if (!item) {
    notFound();
  }

  const detailHref = editBackHref(rawReturnTo, "/admin/finance/monthly-items", item.id);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={item.name}
        title="Chỉnh sửa"
        subtitle={item.name}
      />
      <MonthlyItemForm
        item={item}
        categories={categories}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
