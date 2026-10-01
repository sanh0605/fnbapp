import { getOutlets } from "@/app/admin/outlets/actions";
import { getBrands } from "@/app/admin/brands/actions";
import { OutletForm } from "@/app/admin/outlets/components/OutletForm";
import { safeReturnTo } from "@/app/admin/outlets/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBOutlet, DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function NewOutletPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined);
  const [outlets, brands] = await Promise.all([
    getOutlets() as Promise<DBOutlet[]>,
    getBrands() as Promise<DBBrand[]>,
  ]);

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Điểm bán" />
      <PageHeader title="Thêm điểm bán" subtitle="Thêm điểm bán mới vào hệ thống." />
      <OutletForm brands={brands} outlets={outlets} returnTo={returnTo} />
    </div>
  );
}
