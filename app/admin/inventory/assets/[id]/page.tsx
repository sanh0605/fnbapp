import { notFound } from "next/navigation";
import { getAssetDetail } from "../actions";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { AssetDetailView } from "./components/AssetDetailView";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const detail = await getAssetDetail(params.id);
  if (!detail) {
    notFound();
  }

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/assets");
  const returnTo = rawReturnTo.startsWith("/admin/inventory/assets/")
    ? "/admin/inventory/assets"
    : rawReturnTo;

  return (
    <AssetDetailView
      asset={detail.asset}
      schedule={detail.schedule}
      disposals={detail.disposals}
      chargedToDate={detail.chargedToDate}
      returnTo={returnTo}
    />
  );
}
