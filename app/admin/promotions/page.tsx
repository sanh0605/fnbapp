import { getPromotionsData } from "./actions";
import PromotionsClient from "./components/PromotionsClient";
import { Suspense } from "react";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; type?: string; page?: string };
}) {
  const [{ promotions, brands, products, variants, categories }, auth] = await Promise.all([
    getPromotionsData(),
    resolveActor(),
  ]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deletePromotionAction is
  // what actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  // Filter out DELETED entities (preserving current behavior)
  const activeBrands = brands.filter((b) => b.status !== "DELETED");
  const activeProducts = products.filter((p) => p.status !== "DELETED");
  const activeVariants = variants.filter((v) => v.status !== "DELETED");
  const activeCategories = categories.filter((c) => c.status !== "DELETED");

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <PromotionsClient
        promotions={promotions}
        brands={activeBrands}
        products={activeProducts}
        variants={activeVariants}
        categories={activeCategories}
        canDelete={canDelete}
        initialSearch={searchParams?.q}
        initialStatus={searchParams?.status}
        initialType={searchParams?.type}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
