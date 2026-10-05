import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { UnitForm } from "../../UnitForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import type { DBUnit } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditUnitPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const unit = (await findById("Units", params.id)) as DBUnit | null;
  if (!unit || !unit.name || unit.name.startsWith("DELETED_")) {
    notFound();
  }

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/units");
  const listReturnTo = rawReturnTo.startsWith("/admin/inventory/units/")
    ? "/admin/inventory/units"
    : rawReturnTo;

  const detailHref = `/admin/inventory/units/${encodeURIComponent(unit.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={unit.name}
        title="Chỉnh sửa"
        subtitle={unit.id}
      />
      <UnitForm initialData={unit} returnTo={detailHref} />
    </DetailFrame>
  );
}
