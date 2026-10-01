import { notFound } from "next/navigation";
import { getOutlets } from "@/app/admin/outlets/actions";
import { getBrands } from "@/app/admin/brands/actions";
import { OutletForm } from "@/app/admin/outlets/components/OutletForm";
import { safeReturnTo } from "@/app/admin/outlets/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBOutlet, DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditOutletPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined);
  const [outlets, brands] = await Promise.all([
    getOutlets() as Promise<DBOutlet[]>,
    getBrands() as Promise<DBBrand[]>,
  ]);
  const outlet = outlets.find((o) => o.id === params.id);

  if (!outlet) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Điểm bán" />
      <PageHeader
        title={`Sửa điểm bán: ${outlet.name}`}
        subtitle="Cập nhật thông tin điểm bán."
      />
      <OutletForm initialData={outlet} brands={brands} outlets={outlets} returnTo={returnTo} />
    </div>
  );
}
