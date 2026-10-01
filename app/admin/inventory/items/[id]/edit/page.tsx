import { notFound } from "next/navigation";
import { getItemsData } from "../../actions";
import { PurchasedItemForm } from "../../components/PurchasedItemForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditPurchasedItemPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/items");
  const { categories, items, conversions, units, unitLockedItemIds } = await getItemsData();

  const item = items.find((i) => i.id === params.id);
  if (!item) {
    notFound();
  }

  const initialConversions = conversions.filter((c) => c.purchased_item_id === item.id);
  const isUnitLocked = unitLockedItemIds.includes(item.id);

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Hàng hoá" />
      <PageHeader
        title={`Sửa Hàng Hóa: ${item.name}`}
        subtitle="Cập nhật thông tin hàng hóa mua vào."
      />
      <PurchasedItemForm
        initialData={item}
        initialConversions={initialConversions}
        itemCategories={categories}
        units={units}
        isUnitLocked={isUnitLocked}
        returnTo={returnTo}
      />
    </div>
  );
}
