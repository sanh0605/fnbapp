import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/lib/shared/return-to";
import { CategoryDetailView } from "./components/CategoryDetailView";
import type { DBItemCategory, DBPurchasedItem } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [categories, items, auth] = await Promise.all([
    findAll("Item_Categories") as Promise<DBItemCategory[]>,
    findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
    resolveActor(),
  ]);

  const category = categories.find((c) => c.id === params.id);
  if (!category) {
    notFound();
  }

  const itemCount = items.filter((i) => i.item_category_id === category.id).length;
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/categories");
  const returnTo = rawReturnTo.startsWith("/admin/inventory/categories/")
    ? "/admin/inventory/categories"
    : rawReturnTo;

  return (
    <CategoryDetailView
      category={category}
      itemCount={itemCount}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
