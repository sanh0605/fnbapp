import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getCategoriesWithCounts } from "@/app/admin/products/categories/actions";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { ProductCategoryDetailView } from "./components/ProductCategoryDetailView";
import type { DBProduct } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ProductCategoryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [{ categories, counts }, allProducts] = await Promise.all([
    getCategoriesWithCounts(),
    findAll("Products") as Promise<DBProduct[]>,
  ]);

  const category = categories.find((c) => c.id === params.id);
  if (!category) {
    notFound();
  }

  const dishes = allProducts
    .filter((p) => p.category_id === category.id && p.status !== "DELETED")
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    }));

  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/categories",
  );
  const returnTo = rawReturnTo.startsWith("/admin/products/categories/")
    ? "/admin/products/categories"
    : rawReturnTo;

  return (
    <ProductCategoryDetailView
      category={category}
      dishCount={counts[category.id] ?? dishes.length}
      dishes={dishes}
      returnTo={returnTo}
    />
  );
}
