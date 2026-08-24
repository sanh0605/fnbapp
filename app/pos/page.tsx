import { findAll } from "@/lib/sheets_db";
import POSScreen from "@/components/POSScreen";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getPOSBestSellerProductIds } from "./actions";

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
  // docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 5:
  // the till opens by outlet. Any brandId in the query string is ignored --
  // brand is resolved below, server-side, from the outlet's own brand_id.
  const outletId = Array.isArray(searchParams?.outletId) ? searchParams.outletId[0] : searchParams?.outletId;

  const outlets = await findAll("Outlets");
  const outlet = outlets.find((o: any) => o.id === outletId);

  if (!outlet) {
    redirect("/admin");
  }

  const brandId = outlet.brand_id;

  const [categories, products, variants, modifiers, promotions, bestSellers] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Modifiers"),
    findAll("Promotions"),
    getPOSBestSellerProductIds({
      startDate: lastWeek.toISOString(),
      endDate: now.toISOString(),
      brandId
    })
  ]);

  // Per docs/domain-dictionary.md: ACTIVE = available for new transactions,
  // INACTIVE = hidden from new transactions, DELETED = soft-deleted.
  // POS must show ACTIVE only so the admin toggle (Product.status ACTIVE/INACTIVE)
  // actually hides toppings from the catalog.
  const activeCategories = categories.filter(c => c.status === "ACTIVE");
  const activeProducts = products.filter(p => p.status === "ACTIVE");
  const activeVariants = variants.filter(v => v.status === "ACTIVE");
  const activeModifiers = modifiers.filter(m => m.status === "ACTIVE");
  const activePromotions = promotions.filter(p => p.status === "ACTIVE");

  // Out-of-stock badges remain owner-disabled. If they return, derive them
  // from a materialized per-item balance and the canonical recipe selector.

  return (
    <POSScreen
      brandId={brandId}
      outletId={outlet.id}
      categories={activeCategories}
      products={activeProducts}
      variants={activeVariants}
      modifiers={activeModifiers}
      promotions={activePromotions}
      bestSellers={bestSellers}
    />
  );
}
