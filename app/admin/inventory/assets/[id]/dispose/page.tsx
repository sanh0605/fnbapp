import { notFound } from "next/navigation";
import { getAssetsData } from "@/app/admin/inventory/assets/actions";
import { DisposeAssetForm } from "@/app/admin/inventory/assets/components/DisposeAssetForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

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

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <BackLink href={returnTo} label="Tài sản" />
      <PageHeader
        title={`Thanh lý: ${asset.name}`}
        subtitle="Ghi nhận tài sản hỏng hoặc thanh lý."
      />
      <DisposeAssetForm asset={asset} returnTo={returnTo} />
    </div>
  );
}
