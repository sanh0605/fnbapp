import { notFound } from "next/navigation";
import { getPromotionsData } from "@/app/admin/promotions/actions";
import { PromotionForm } from "@/app/admin/promotions/components/PromotionForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/promotions");

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

  const activeVariants = variants.filter((v) => v.status !== "DELETED");

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
        brands={brands}
        categories={categories}
        products={products}
        variants={activeVariants}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
