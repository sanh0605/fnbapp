import { findAll } from "@/lib/sheets_db";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

interface PriceHistory {
  variant_id: string;
  created_at: string;
  [key: string]: any;
}

export default async function ProductsPage() {
  const [categories, products, variants, allPriceHistory, orderLines]: [any[], any[], any[], PriceHistory[], any[]] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Product_Price_History"),
    findAll("Order_Lines_V2"),
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");

  // docs/superpowers/plans/2026-08-29-product-stop-selling-and-real-delete.md
  // section 5.2: "Xoá vĩnh viễn" is offered only when it is possible --
  // computed the same way Postgres's own RESTRICT foreign keys decide it
  // (any order_lines_v2 row referencing the product or one of its variants,
  // regardless of that order's own status), not re-derived differently.
  const soldProductIds = new Set<string>();
  for (const line of orderLines) {
    if (line.product_id) soldProductIds.add(line.product_id);
  }
  const variantProductId = new Map<string, string>(activeVariants.map(v => [v.id, v.product_id]));
  for (const line of orderLines) {
    const pid = variantProductId.get(line.variant_id);
    if (pid) soldProductIds.add(pid);
  }

  // Build the rich data for the form
  const enhancedProducts = activeProducts.map(p => {
    const productVariants = activeVariants.filter(v => v.product_id === p.id);

    // Thu thập toàn bộ lịch sử giá của các variants thuộc Product này
    const pPriceHistory = allPriceHistory
      .filter((ph: PriceHistory) => productVariants.some(v => v.id === ph.variant_id))
      .sort((a: PriceHistory, b: PriceHistory) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { ...p, variants: productVariants, priceHistory: pPriceHistory, neverSold: !soldProductIds.has(p.id) };
  });

  return (
    <div className="space-y-6">
      <ProductsClient
        enhancedProducts={enhancedProducts}
        activeCategories={activeCategories}
        categories={activeCategories} // Passing for the form inside ProductsClient
      />
    </div>
  );
}
