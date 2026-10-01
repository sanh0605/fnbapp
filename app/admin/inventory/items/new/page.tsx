import { getItemsData } from "../actions";
import { PurchasedItemForm } from "../components/PurchasedItemForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewPurchasedItemPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/items");
  const { categories, units } = await getItemsData();

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Hàng hoá" />
      <PageHeader
        title="Thêm Hàng Hóa Mua Vào"
        subtitle="Thêm mặt hàng mới vào danh mục hàng hóa."
      />
      <PurchasedItemForm
        itemCategories={categories}
        units={units}
        returnTo={returnTo}
      />
    </div>
  );
}
