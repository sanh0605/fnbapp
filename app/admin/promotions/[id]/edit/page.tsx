import { notFound } from "next/navigation";
import { getPromotionsData } from "@/app/admin/promotions/actions";
import { PromotionForm } from "@/app/admin/promotions/components/PromotionForm";
import { safeReturnTo } from "@/app/admin/promotions/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined);
  const { promotions, brands, products, variants, categories } = await getPromotionsData();
  const promo = promotions.find((p) => p.id === params.id);

  if (!promo) {
    notFound();
  }

  const activeBrands = brands.filter((b) => b.status !== "DELETED");
  const activeProducts = products.filter((p) => p.status !== "DELETED");
  const activeVariants = variants.filter((v) => v.status !== "DELETED");
  const activeCategories = categories.filter((c) => c.status !== "DELETED");

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Khuyến mãi" />
      <PageHeader
        title={`Sửa khuyến mãi: ${promo.name}`}
        subtitle="Cập nhật thông tin chương trình khuyến mãi."
      />
      <PromotionForm
        initialData={promo}
        brands={activeBrands}
        categories={activeCategories}
        products={activeProducts}
        variants={activeVariants}
        returnTo={returnTo}
      />
    </div>
  );
}
