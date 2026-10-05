import { getItemsData } from "../actions";
import { PurchasedItemForm } from "../components/PurchasedItemForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewPurchasedItemPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/items");
  const { categories, units } = await getItemsData();

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Hàng hoá"
        title="Thêm Hàng Hóa Mua Vào"
        subtitle="Thêm mặt hàng mới vào danh mục hàng hóa."
      />
      <PurchasedItemForm
        itemCategories={categories}
        units={units}
        returnTo={returnTo}
      />
    </DetailFrame>
  );
}
