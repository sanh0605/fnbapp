import { ProductTypeForm } from "@/app/admin/products/types/components/ProductTypeForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewProductTypePage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/types");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Loại món"
        title="Tạo loại món"
      />
      <ProductTypeForm returnTo={returnTo} />
    </DetailFrame>
  );
}
