import { Suspense } from "react";
import { loadProductRows } from "./load-product-rows";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: { q?: string; category?: string; status?: string; page?: string };
}) {
  const { enhancedProducts, activeCategories } = await loadProductRows();

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ProductsClient
        enhancedProducts={enhancedProducts}
        activeCategories={activeCategories}
        initialSearch={searchParams?.q ?? ""}
        initialCategory={searchParams?.category ?? "ALL"}
        initialStatus={searchParams?.status}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
