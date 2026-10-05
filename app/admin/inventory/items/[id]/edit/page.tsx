import { notFound } from "next/navigation";
import { getItemsData } from "../../actions";
import { PurchasedItemForm } from "../../components/PurchasedItemForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditPurchasedItemPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/items");
  const listReturnTo = rawReturnTo.startsWith("/admin/inventory/items/")
    ? "/admin/inventory/items"
    : rawReturnTo;

  const { categories, items, conversions, units, unitLockedItemIds } = await getItemsData();

  const item = items.find((i) => i.id === params.id);
  if (!item) {
    notFound();
  }

  const detailHref = `/admin/inventory/items/${encodeURIComponent(item.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;
  const initialConversions = conversions.filter((c) => c.purchased_item_id === item.id);
  const isUnitLocked = unitLockedItemIds.includes(item.id);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={item.name}
        title="Chỉnh sửa"
        subtitle={item.name}
      />
      <PurchasedItemForm
        initialData={item}
        initialConversions={initialConversions}
        itemCategories={categories}
        units={units}
        isUnitLocked={isUnitLocked}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
