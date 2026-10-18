import { findAll } from "@/lib/db/tables";
import ProductForm from "@/app/admin/products/components/ProductForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewProductPage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const [categories, optionGroups] = await Promise.all([findAll("Product_Categories"), findAll("Modifier_Groups")]);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Món"
        title="Tạo món"
        subtitle="Thêm món mới vào thực đơn."
      />
      <ProductForm
        categories={categories}
        optionGroups={optionGroups}
        selectedOptionGroupIds={[]}
        returnTo={returnTo}
      />
    </DetailFrame>
  );
}
