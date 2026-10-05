import { Suspense } from "react";
import { getCategoriesWithCounts } from "./actions";
import CategoriesClient from "@/app/admin/products/categories/components/CategoriesClient";

export const dynamic = "force-dynamic";

export default async function ProductCategoriesPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const { categories, counts } = await getCategoriesWithCounts();
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <CategoriesClient
        categories={categories}
        counts={counts}
        initialSearch={searchParams?.q || ""}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
