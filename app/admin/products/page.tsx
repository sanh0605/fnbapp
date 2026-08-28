import { findAll } from "@/lib/sheets_db";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

interface PriceHistory {
  variant_id: string;
  created_at: string;
  [key: string]: any;
}

export default async function ProductsPage() {
  const [categories, products, variants, allPriceHistory]: [any[], any[], any[], PriceHistory[]] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Product_Price_History"),
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");

  // Build the rich data for the form
  const enhancedProducts = activeProducts.map(p => {
    const productVariants = activeVariants.filter(v => v.product_id === p.id);

    // Thu thập toàn bộ lịch sử giá của các variants thuộc Product này
    const pPriceHistory = allPriceHistory
      .filter((ph: PriceHistory) => productVariants.some(v => v.id === ph.variant_id))
      .sort((a: PriceHistory, b: PriceHistory) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { ...p, variants: productVariants, priceHistory: pPriceHistory };
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
