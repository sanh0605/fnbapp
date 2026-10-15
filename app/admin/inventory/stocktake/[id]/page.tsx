import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import {
  getStocktakeSessionData,
  listStocktakeSessions,
} from "@/app/admin/inventory/stocktake/actions";
import { StocktakeCountView } from "./components/StocktakeCountView";
import { StocktakeDetailView } from "./components/StocktakeDetailView";

export const dynamic = "force-dynamic";

export default async function StocktakeDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const sessionUser = await getServerSession(authOptions);
  const role = (sessionUser?.user as any)?.role || "STAFF";
  const isOwner = role === "ADMIN" || role === "SYSTEM";

  const [sessionData, sessionsList] = await Promise.all([
    getStocktakeSessionData(params.id),
    listStocktakeSessions(),
  ]);

  if (!sessionData) {
    notFound();
  }

  if (sessionData.status === "OPEN") {
    return <StocktakeCountView session={sessionData} />;
  }

  const listRow = sessionsList.find((s) => s.id === params.id);
  const hasOpenSession = sessionsList.some((s) => s.status === "OPEN");
  const isLatestConfirmed = listRow?.isLatestConfirmed ?? false;

  return (
    <StocktakeDetailView
      session={sessionData}
      isLatestConfirmed={isLatestConfirmed}
      isOwner={isOwner}
      hasOpenSession={hasOpenSession}
    />
  );
}
