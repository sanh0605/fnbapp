import { notFound } from "next/navigation";
import { getSuppliers } from "../../actions";
import { SupplierForm } from "../../components/SupplierForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/suppliers");
  const listReturnTo = rawReturnTo.startsWith("/admin/suppliers/") ? "/admin/suppliers" : rawReturnTo;
  const suppliers = await getSuppliers();
  const supplier = suppliers.find((s) => s.id === params.id);

  if (!supplier) {
    notFound();
  }

  const detailHref = `/admin/suppliers/${encodeURIComponent(supplier.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={supplier.name}
        title="Chỉnh sửa"
        subtitle={supplier.id}
      />
      <SupplierForm initialData={supplier} returnTo={detailHref} />
    </DetailFrame>
  );
}
