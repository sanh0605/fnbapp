import { notFound } from "next/navigation";
import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { getMonthlyItem } from "../../actions";
import { MonthlyItemForm } from "../../components/MonthlyItemForm";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

function safeReturnTo(raw: string | undefined | null, fallback: string = "/admin/finance/monthly-items"): string {
  if (!raw) return fallback;
  if (raw.startsWith("/admin/finance/monthly-items")) return raw;
  return fallback;
}

export default async function EditMonthlyItemPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(searchParams?.returnTo);

  const [item, categories] = await Promise.all([
    getMonthlyItem(params.id),
    getCashCategories(),
  ]);

  if (!item) {
    notFound();
  }

  const ownDetailPath = `/admin/finance/monthly-items/${encodeURIComponent(item.id)}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/finance/monthly-items/")
    ? "/admin/finance/monthly-items"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `${ownDetailPath}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={item.name}
        title="Sửa khoản chi hằng tháng"
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
