import { notFound, redirect } from "next/navigation";
import { getAssetItemDetail, findItemIdForAsset } from "@/app/admin/inventory/assets/actions";
import { DisposeAssetForm } from "@/app/admin/inventory/assets/components/DisposeAssetForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function DisposeAssetPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string; lot?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  if (params.id.startsWith("TS-")) {
    const itemId = await findItemIdForAsset(params.id);
    if (!itemId) {
      notFound();
    }
    const q = new URLSearchParams();
    if (searchParams?.returnTo) {
      q.set("returnTo", searchParams.returnTo);
    }
    q.set("lot", params.id);
    redirect(`/admin/inventory/assets/${itemId}/dispose?${q.toString()}`);
  }

  const detail = await getAssetItemDetail(params.id);
  if (!detail) {
    notFound();
  }

  if (detail.item.fullyDisposed || detail.item.remainingQuantity === 0) {
    notFound();
  }

  const lotsWithStock = detail.lots.filter((l) => l.remainingQuantity > 0);
  if (lotsWithStock.length === 0) {
    notFound();
  }

  const requestedLot = searchParams?.lot
    ? lotsWithStock.find((l) => l.id === searchParams.lot)
    : undefined;
  const initialLotId = requestedLot ? requestedLot.id : lotsWithStock[0].id;

  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/assets");
  const backLabel = returnTo.startsWith("/admin/inventory/assets/") ? detail.item.name : "Tài sản";

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel={backLabel}
        title={`Thanh lý: ${detail.item.name}`}
        subtitle={detail.item.itemId}
      />
      <DisposeAssetForm
        lots={lotsWithStock}
        initialLotId={initialLotId}
        returnTo={returnTo}
      />
    </DetailFrame>
  );
}
