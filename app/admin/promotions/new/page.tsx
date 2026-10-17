import { getPromotionsData } from "@/app/admin/promotions/actions";
import { PromotionForm } from "@/app/admin/promotions/components/PromotionForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewPromotionPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined, "/admin/promotions");
  const { brands, products, variants, categories } = await getPromotionsData();

  const activeVariants = variants.filter((v) => v.status !== "DELETED");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Khuyến mãi"
        title="Tạo khuyến mãi"
        subtitle="Tạo mới mã giảm giá, chiết khấu hoá đơn hoặc khuyến mãi theo sản phẩm."
      />
      <PromotionForm
        brands={brands}
        categories={categories}
        products={products}
        variants={activeVariants}
        returnTo={returnTo}
      />
    </DetailFrame>
  );
}
