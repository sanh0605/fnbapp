import { notFound } from "next/navigation";
import { getAssetBands } from "@/app/admin/inventory/asset-bands/actions";
import { BandEditForm } from "@/app/admin/inventory/asset-bands/components/BandEditForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { formatBandRange } from "@/lib/assets/asset-depreciation";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditAssetBandPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const bands = await getAssetBands();
  const band = bands.find((b) => b.id === params.id);

  if (!band) {
    notFound();
  }

  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/inventory/asset-bands",
  );
  const listReturnTo = rawReturnTo.startsWith("/admin/inventory/asset-bands/")
    ? "/admin/inventory/asset-bands"
    : rawReturnTo;

  const detailHref = `/admin/inventory/asset-bands/${encodeURIComponent(band.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  const returnTo = searchParams?.returnTo ? rawReturnTo : detailHref;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel={formatBandRange(band)}
        title="Chỉnh sửa"
        subtitle={band.id}
      />
      <BandEditForm band={band} returnTo={returnTo} />
    </DetailFrame>
  );
}
