import { getPromotionsData } from "@/app/admin/promotions/actions";
import { PromotionForm } from "@/app/admin/promotions/components/PromotionForm";
import { safeReturnTo } from "@/app/admin/promotions/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewPromotionPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined);
  const { brands, products, variants, categories } = await getPromotionsData();

  const activeBrands = brands.filter((b) => b.status !== "DELETED");
  const activeProducts = products.filter((p) => p.status !== "DELETED");
  const activeVariants = variants.filter((v) => v.status !== "DELETED");
  const activeCategories = categories.filter((c) => c.status !== "DELETED");

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Khuyến mãi" />
      <PageHeader
        title="Tạo khuyến mãi"
        subtitle="Tạo mới mã giảm giá, chiết khấu hóa đơn hoặc khuyến mãi theo sản phẩm."
      />
      <PromotionForm
        brands={activeBrands}
        categories={activeCategories}
        products={activeProducts}
        variants={activeVariants}
        returnTo={returnTo}
      />
    </div>
  );
}
