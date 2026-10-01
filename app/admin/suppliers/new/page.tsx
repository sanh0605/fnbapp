import { SupplierForm } from "../components/SupplierForm";
import { safeReturnTo } from "../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewSupplierPage({ searchParams }: { searchParams?: { returnTo?: string } }) {
  const returnTo = safeReturnTo(searchParams?.returnTo);
  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhà cung cấp" />
      <PageHeader title="Thêm nhà cung cấp" subtitle="Thông tin liên hệ của đối tác cung ứng." />
      <SupplierForm returnTo={returnTo} />
    </div>
  );
}
