import { notFound } from "next/navigation";
import { getPromotionsData } from "@/app/admin/promotions/actions";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/app/admin/promotions/components/return-to";
import { formatNumber } from "@/lib/shared/format";
import {
  PromotionDetailView,
  type ApplicableProductItem,
} from "./components/PromotionDetailView";

export const dynamic = "force-dynamic";

export default async function PromotionDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [{ promotions, brands, products, variants }, auth] = await Promise.all([
    getPromotionsData(),
    resolveActor(),
  ]);

  const promo = promotions.find((p) => p.id === params.id);
  if (!promo) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const brand = promo.brand_id ? brands.find((b) => b.id === promo.brand_id) : undefined;
  const brandName = brand ? brand.name : "Toàn hệ thống";

  let applicableItems: ApplicableProductItem[] = [];
  if (promo.type === "PRODUCT_DISCOUNT" && promo.applicable_products_json) {
    try {
      const parsed = JSON.parse(promo.applicable_products_json);
      if (parsed && typeof parsed === "object") {
        const entries = Array.isArray(parsed)
          ? parsed.map((id) => [id, promo.discount_value])
          : Object.entries(parsed);
        applicableItems = entries.map(([variantId, val]) => {
          const variant = variants.find((v) => v.id === variantId);
          const product = variant ? products.find((p) => p.id === variant.product_id) : undefined;
          const dishName = product?.name || "—";
          const sizeName = variant?.size_name || "—";
          const appliedValue =
            promo.discount_type === "PERCENT"
              ? `${val}%`
              : `${formatNumber(val as any)}đ`;
          return {
            variantId,
            dishName,
            sizeName,
            appliedValue,
          };
        });
      }
    } catch {}
  }

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined,
  );
  const returnTo = rawReturnTo.startsWith("/admin/promotions/")
    ? "/admin/promotions"
    : rawReturnTo;

  return (
    <PromotionDetailView
      promo={promo}
      brandName={brandName}
      applicableItems={applicableItems}
      canDelete={canDelete}
      returnTo={returnTo}
    />
  );
}
