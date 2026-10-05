import { notFound, redirect } from "next/navigation";
import { getAssetItemDetail, findItemIdForAsset } from "../actions";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { AssetItemDetailView } from "./components/AssetItemDetailView";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  if (params.id.startsWith("TS-")) {
    const itemId = await findItemIdForAsset(params.id);
    if (!itemId) {
      notFound();
    }
    const q = new URLSearchParams();
    if (searchParams?.returnTo) {
      q.set("returnTo", searchParams.returnTo);
    }
    const qs = q.toString();
    redirect(`/admin/inventory/assets/${itemId}${qs ? `?${qs}` : ""}`);
  }

  const detail = await getAssetItemDetail(params.id);
  if (!detail) {
    notFound();
  }

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/assets");
  const returnTo = rawReturnTo.startsWith("/admin/inventory/assets/")
    ? "/admin/inventory/assets"
    : rawReturnTo;

  return <AssetItemDetailView detail={detail} returnTo={returnTo} />;
}
