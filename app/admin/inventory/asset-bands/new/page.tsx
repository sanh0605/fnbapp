import { AddBandForm } from "@/app/admin/inventory/asset-bands/components/AddBandForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default function NewAssetBandPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/asset-bands");

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Thời hạn khấu hao"
        title="Thêm khung khấu hao"
        subtitle="Xác định số tháng khấu hao theo đơn giá 1 cái."
      />
      <AddBandForm returnTo={returnTo} />
    </DetailFrame>
  );
}
