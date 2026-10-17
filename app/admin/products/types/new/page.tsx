import { ProductTypeForm } from "@/app/admin/products/types/components/ProductTypeForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewProductTypePage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/types");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Loại món"
        title="Tạo loại món"
        subtitle="Thêm loại món mới để phân loại các nhóm món."
      />
      <ProductTypeForm returnTo={returnTo} />
    </DetailFrame>
  );
}
