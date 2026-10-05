import { getAssetBands } from "./actions";
import BandsClient from "./components/BandsClient";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function AssetBandsPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const [bands, auth] = await Promise.all([getAssetBands(), resolveActor()]);
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  return (
    <BandsClient
      bands={bands}
      canDelete={canDelete}
      initialPage={searchParams?.page}
    />
  );
}
