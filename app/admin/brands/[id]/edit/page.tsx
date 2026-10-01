import { notFound } from "next/navigation";
import { getBrands } from "@/app/admin/brands/actions";
import { BrandForm } from "@/app/admin/brands/components/BrandForm";
import { safeReturnTo } from "@/app/admin/brands/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditBrandPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined);
  const brands = await getBrands();
  const brand = brands.find((b: DBBrand) => b.id === params.id && b.status !== "DELETED");

  if (!brand) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Thương hiệu" />
      <PageHeader
        title={`Sửa thương hiệu: ${brand.name}`}
        subtitle="Cập nhật thông tin thương hiệu F&B."
      />
      <BrandForm initialData={brand} returnTo={returnTo} />
    </div>
  );
}
