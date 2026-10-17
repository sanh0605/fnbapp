import { getProductTypes } from "@/app/admin/products/types/actions";
import { ProductCategoryForm } from "@/app/admin/products/categories/components/ProductCategoryForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewProductCategoryPage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/categories");
  const typeRows = await getProductTypes();
  const types = typeRows.map((r) => r.type);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhóm món"
        title="Tạo nhóm món"
        subtitle="Thêm nhóm món mới để phân loại các món."
      />
      <ProductCategoryForm types={types} returnTo={returnTo} />
    </DetailFrame>
  );
}
