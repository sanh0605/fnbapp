import { UnitForm } from "../UnitForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default function NewUnitPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/units");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Đơn vị tính"
        title="Thêm Đơn Vị Mới"
        subtitle="Quản lý danh sách các đơn vị tính hợp lệ (kg, lít, hộp...)"
      />
      <UnitForm returnTo={returnTo} />
    </DetailFrame>
  );
}
