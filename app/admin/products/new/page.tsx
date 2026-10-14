import { findAll } from "@/lib/db/tables";
import ProductForm from "@/app/admin/products/components/ProductForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const [categories, optionGroups] = await Promise.all([findAll("Product_Categories"), findAll("Modifier_Groups")]);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Món"
        title="Tạo món"
      />
      <ProductForm
        categories={categories.filter((c: any) => c.status !== "DELETED")}
        optionGroups={optionGroups}
        selectedOptionGroupIds={[]}
        returnTo={returnTo}
      />
    </DetailFrame>
  );
}
