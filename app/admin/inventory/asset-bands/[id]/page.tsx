import { notFound } from "next/navigation";
import { getAssetBands } from "../actions";
import { safeReturnTo } from "@/lib/shared/return-to";
import { BandDetailView } from "./components/BandDetailView";

export const dynamic = "force-dynamic";

export default async function BandDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const bands = await getAssetBands();

  const band = bands.find((b) => b.id === params.id);
  if (!band) {
    notFound();
  }

  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/inventory/asset-bands",
  );
  const returnTo = rawReturnTo.startsWith("/admin/inventory/asset-bands/")
    ? "/admin/inventory/asset-bands"
    : rawReturnTo;

  return (
    <BandDetailView
      band={band}
      returnTo={returnTo}
    />
  );
}
