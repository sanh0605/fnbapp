import { notFound } from "next/navigation";
import { getItemsData, getItemPurchaseHistory, getItemStockById } from "../actions";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { ItemDetailView } from "./components/ItemDetailView";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [data, purchaseHistory, stockById, auth] = await Promise.all([
    getItemsData(),
    getItemPurchaseHistory(params.id),
    getItemStockById(),
    resolveActor(),
  ]);

  const item = data.items.find((i) => i.id === params.id);
  if (!item) {
    notFound();
  }

  const category = data.categories.find((c) => c.id === item.item_category_id);
  const conversions = data.conversions.filter((c) => c.purchased_item_id === item.id);
  const units = data.units;
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/items");
  const returnTo = rawReturnTo.startsWith("/admin/inventory/items/")
    ? "/admin/inventory/items"
    : rawReturnTo;

  return (
    <ItemDetailView
      item={item}
      category={category}
      conversions={conversions}
      units={units}
      purchaseHistory={purchaseHistory}
      stock={stockById[item.id]}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
