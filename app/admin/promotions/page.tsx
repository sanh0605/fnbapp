import { findAll } from "@/lib/sheets_db";
import PromotionsClient from "./PromotionsClient";

export default async function PromotionsPage() {
  const [promotions, brands, products, variants] = await Promise.all([
    findAll("Promotions"),
    findAll("Brands"),
    findAll("Products"),
    findAll("Product_Variants"),
  ]);

  const activeBrands = brands.filter((b: any) => b.status !== "DELETED");
  const activeProducts = products.filter((p: any) => p.status !== "DELETED");
  const activeVariants = variants.filter((v: any) => v.status !== "DELETED");

  // Sort promotions by created_at descending (newest first)
  const sortedPromotions = [...promotions].sort((a: any, b: any) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  return (
    <PromotionsClient
      initialPromotions={sortedPromotions}
      brands={activeBrands}
      products={activeProducts}
      variants={activeVariants}
    />
  );
}
