import { notFound } from "next/navigation";
import { getAssetBands } from "../actions";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BandDetailView } from "./components/BandDetailView";

export const dynamic = "force-dynamic";

export default async function BandDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [bands, auth] = await Promise.all([
    getAssetBands(),
    resolveActor(),
  ]);

  const band = bands.find((b) => b.id === params.id);
  if (!band) {
    notFound();
  }

  const canDelete = auth.ok && auth.actor.role === "ADMIN";
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
      canDelete={canDelete}
    />
  );
}
