import { getProductTypes } from "@/app/admin/products/types/actions";
import { ProductCategoryForm } from "@/app/admin/products/categories/components/ProductCategoryForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewProductCategoryPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/categories");
  const typeRows = await getProductTypes();
  const types = typeRows.map((r) => r.type);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhóm món"
        title="Tạo nhóm món"
      />
      <ProductCategoryForm types={types} returnTo={returnTo} />
    </DetailFrame>
  );
}
