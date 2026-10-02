import { CategoryForm } from "@/app/admin/inventory/components/CategoryForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default function NewCategoryPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/categories");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Phân loại hàng"
        title="Tạo Phân Loại Hàng Hoá"
        subtitle="Tự do tạo các phân loại tuỳ chỉnh (Bao bì, Nguyên liệu ướt, v.v.)."
      />
      <CategoryForm returnTo={returnTo} />
    </DetailFrame>
  );
}
