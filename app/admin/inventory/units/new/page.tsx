import { UnitForm } from "../UnitForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewUnitPage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/units");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Đơn vị tính"
        title="Tạo đơn vị tính"
        subtitle="Quản lý danh sách các đơn vị tính hợp lệ (kg, lít, hộp...)"
      />
      <UnitForm returnTo={returnTo} />
    </DetailFrame>
  );
}
