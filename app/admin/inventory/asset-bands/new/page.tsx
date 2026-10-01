import { AddBandForm } from "@/app/admin/inventory/asset-bands/components/AddBandForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewAssetBandPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/asset-bands");

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <BackLink href={returnTo} label="Thời hạn khấu hao" />
      <PageHeader
        title="Thêm khung khấu hao"
        subtitle="Xác định số tháng khấu hao theo đơn giá 1 cái."
      />
      <AddBandForm returnTo={returnTo} />
    </div>
  );
}
