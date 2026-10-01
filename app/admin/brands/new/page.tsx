import { BrandForm } from "@/app/admin/brands/components/BrandForm";
import { safeReturnTo } from "@/app/admin/brands/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewBrandPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined);
  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Thương hiệu" />
      <PageHeader title="Thêm thương hiệu" subtitle="Quản lý thương hiệu F&B trên hệ thống." />
      <BrandForm returnTo={returnTo} />
    </div>
  );
}
