import { notFound } from "next/navigation";
import { getAssetsData } from "@/app/admin/inventory/assets/actions";
import { DisposeAssetForm } from "@/app/admin/inventory/assets/components/DisposeAssetForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function DisposeAssetPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/assets");
  const assets = await getAssetsData();
  const asset = assets.find((a) => a.id === params.id);

  if (!asset || asset.bucket === "DISPOSED") {
    notFound();
  }

  const backLabel = returnTo.startsWith("/admin/inventory/assets/") ? asset.name : "Tài sản";

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel={backLabel}
        title={`Thanh lý: ${asset.name}`}
        subtitle={asset.id}
      />
      <DisposeAssetForm asset={asset} returnTo={returnTo} />
    </DetailFrame>
  );
}
