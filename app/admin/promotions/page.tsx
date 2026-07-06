import { getPromotionsData } from "./actions";
import PromotionsClient from "./components/PromotionsClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const { promotions, brands, products, variants, categories } = await getPromotionsData();

  // Filter out DELETED entities (preserving current behavior)
  const activeBrands = brands.filter(b => b.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");
  const activeCategories = categories.filter(c => c.status !== "DELETED");

  // Sort promotions by created_at descending
  const sorted = [...promotions].sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || "")
  ).reverse(); // Reverse because localeCompare(a, b) sorts ascending by default if b.created_at is first

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <PromotionsClient
        promotions={sorted}
        brands={activeBrands}
        products={activeProducts}
        variants={activeVariants}
        categories={activeCategories}
      />
    </Suspense>
  );
}
