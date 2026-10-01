import { getCategoriesWithCounts } from "./actions";
import CategoriesClient from "@/app/admin/products/categories/components/CategoriesClient";

export const dynamic = "force-dynamic";

export default async function ProductCategoriesPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const { categories, counts } = await getCategoriesWithCounts();
  return (
    <CategoriesClient
      categories={categories}
      counts={counts}
      initialSearch={searchParams?.q || ""}
    />
  );
}
