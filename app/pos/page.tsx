import { findAll } from "@/lib/sheets_db";
import POSScreen from "@/components/POSScreen";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSalesDataV2 } from "@/app/actions/reports";

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

  const [categories, products, variants, modifiers, promotions, salesData] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Modifiers"),
    findAll("Promotions"),
    getSalesDataV2({
      startDate: lastWeek.toISOString(),
      endDate: now.toISOString(),
      brandId: brandIdStr
    })
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");
  const activeModifiers = modifiers.filter(m => m.status !== "DELETED");
  const activePromotions = promotions.filter(p => p.status === "ACTIVE");
  
  const brandId = Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : searchParams?.brandId;
  const bestSellers = salesData.bestSellers.slice(0, 8).map((bs: any) => bs.product_id);

  return (
    <POSScreen 
      brandId={brandId}
      categories={activeCategories}
      products={activeProducts}
      variants={activeVariants}
      modifiers={activeModifiers}
      promotions={activePromotions}
      bestSellers={bestSellers}
    />
  );
}
