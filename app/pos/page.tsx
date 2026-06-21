import { findAll } from "@/lib/sheets_db";
import POSScreen from "@/components/POSScreen";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSalesDataV2 } from "@/app/actions/reports";
import { getRealtimeStock } from "@/app/actions/stock";

export const dynamic = 'force-dynamic';

export default async function POSPage({
  searchParams,
}: {
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const brandIdStr = typeof searchParams?.brandId === 'string' ? searchParams.brandId : (Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : undefined);

  const [categories, products, variants, modifiers, promotions, salesData, realtimeStock, recipes] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Modifiers"),
    findAll("Promotions"),
    getSalesDataV2({
      startDate: lastWeek.toISOString(),
      endDate: now.toISOString(),
      brandId: brandIdStr
    }),
    getRealtimeStock(),
    findAll("Recipes")
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");
  const activeModifiers = modifiers.filter(m => m.status !== "DELETED");
  const activePromotions = promotions.filter(p => p.status === "ACTIVE");
  
  const brandId = Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : searchParams?.brandId;
  const bestSellers = salesData.bestSellers.slice(0, 8).map((bs: any) => bs.product_id);

  // Compute Out Of Stock products
  const stockMap = new Map<string, number>();
  realtimeStock.forEach((s: any) => stockMap.set(s.id, s.current_stock));

  const variantAvailableMap = new Map<string, boolean>();
  activeVariants.forEach((v: any) => {
    const variantRecipes = (recipes as any[]).filter(r => r.target_id === v.id && r.target_type === "VARIANT");
    let isAvailable = true;
    for (const r of variantRecipes) {
      const currentStock = stockMap.get(r.ingredient_id) || 0;
      if (currentStock < Number(r.qty)) {
        isAvailable = false;
        break;
      }
    }
    variantAvailableMap.set(v.id, isAvailable);
  });

  const outOfStockProductIds = activeProducts.filter((p: any) => {
    const pVariants = activeVariants.filter((v: any) => v.product_id === p.id);
    if (pVariants.length === 0) return false; // if no variants, assume it's available or not trackable
    return pVariants.every((v: any) => variantAvailableMap.get(v.id) === false);
  }).map((p: any) => p.id);

  return (
    <POSScreen 
      brandId={brandId}
      categories={activeCategories}
      products={activeProducts}
      variants={activeVariants}
      modifiers={activeModifiers}
      promotions={activePromotions}
      bestSellers={bestSellers}
      outOfStockProductIds={outOfStockProductIds}
    />
  );
}
