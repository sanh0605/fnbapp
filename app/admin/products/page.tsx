import { loadProductRows } from "./load-product-rows";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: { q?: string; category?: string; status?: string };
}) {
  const { enhancedProducts, activeCategories, canDelete } = await loadProductRows();

  return (
    <div className="space-y-6">
      <ProductsClient
        enhancedProducts={enhancedProducts}
        activeCategories={activeCategories}
        categories={activeCategories}
        canDelete={canDelete}
        initialFilters={{
          q: searchParams?.q || "",
          category: searchParams?.category || "",
          status: searchParams?.status,
        }}
      />
    </div>
  );
}
