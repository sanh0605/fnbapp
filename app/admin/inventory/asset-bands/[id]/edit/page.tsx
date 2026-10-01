import { notFound } from "next/navigation";
import { getAssetBands } from "@/app/admin/inventory/asset-bands/actions";
import { BandEditForm } from "@/app/admin/inventory/asset-bands/components/BandEditForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditAssetBandPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/asset-bands");
  const bands = await getAssetBands();
  const band = bands.find((b) => b.id === params.id);

  if (!band) {
    notFound();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <BackLink href={returnTo} label="Thời hạn khấu hao" />
      <PageHeader
        title="Sửa khung khấu hao"
        subtitle="Cập nhật khoảng giá và số tháng khấu hao."
      />
      <BandEditForm band={band} returnTo={returnTo} />
    </div>
  );
}
