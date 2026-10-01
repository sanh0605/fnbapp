import { UnitForm } from "../UnitForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewUnitPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/admin/inventory/units" label="Đơn vị tính" />
      <PageHeader
        title="Thêm Đơn Vị Mới"
        subtitle="Quản lý danh sách các đơn vị tính hợp lệ (kg, lít, hộp...)"
      />
      <UnitForm returnTo="/admin/inventory/units" />
    </div>
  );
}
