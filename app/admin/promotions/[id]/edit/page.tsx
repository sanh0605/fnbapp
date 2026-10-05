import { notFound } from "next/navigation";
import { getPromotionsData } from "@/app/admin/promotions/actions";
import { PromotionForm } from "@/app/admin/promotions/components/PromotionForm";
import { safeReturnTo } from "@/app/admin/promotions/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(searchParams?.returnTo);

  const { promotions, brands, products, variants, categories } =
    await getPromotionsData();
  const promo = promotions.find((p) => p.id === params.id);

  if (!promo) {
    notFound();
  }

  const ownDetailPath = `/admin/promotions/${encodeURIComponent(promo.id)}`;
  const ownDetailPathRaw = `/admin/promotions/${promo.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/promotions/")
    ? "/admin/promotions"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/promotions/${encodeURIComponent(promo.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  const activeBrands = brands.filter((b) => b.status !== "DELETED");
  const activeProducts = products.filter((p) => p.status !== "DELETED");
  const activeVariants = variants.filter((v) => v.status !== "DELETED");
  const activeCategories = categories.filter((c) => c.status !== "DELETED");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={promo.name}
        title="Chỉnh sửa"
        subtitle={promo.name}
      />
      <PromotionForm
        initialData={promo}
        brands={activeBrands}
        categories={activeCategories}
        products={activeProducts}
        variants={activeVariants}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
