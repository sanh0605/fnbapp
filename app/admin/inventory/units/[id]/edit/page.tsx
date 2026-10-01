import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { UnitForm } from "../../UnitForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBUnit } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditUnitPage({
  params,
}: {
  params: { id: string };
}) {
  const unit = (await findById("Units", params.id)) as DBUnit | null;
  if (!unit || !unit.name || unit.name.startsWith("DELETED_")) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin/inventory/units" label="Đơn vị tính" />
      <PageHeader
        title={`Sửa Đơn Vị: ${unit.name}`}
        subtitle="Cập nhật thông tin đơn vị tính."
      />
      <UnitForm initialData={unit} returnTo="/admin/inventory/units" />
    </div>
  );
}
