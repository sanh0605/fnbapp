import { notFound } from "next/navigation";
import { getSuppliers } from "../../actions";
import { SupplierForm } from "../../components/SupplierForm";
import { safeReturnTo } from "../../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo);
  const suppliers = await getSuppliers();
  const supplier = suppliers.find((s) => s.id === params.id);

  if (!supplier) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhà cung cấp" />
      <PageHeader
        title={`Sửa nhà cung cấp: ${supplier.name}`}
        subtitle="Cập nhật thông tin liên hệ của đối tác cung ứng."
      />
      <SupplierForm initialData={supplier} returnTo={returnTo} />
    </div>
  );
}
