import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import {
  getStocktakeSessionData,
  listStocktakeSessions,
} from "../../actions";
import { CancelStocktakeForm } from "./components/CancelStocktakeForm";

export const dynamic = "force-dynamic";

export default async function CancelStocktakePage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as any)?.role || "STAFF";
  if (role !== "ADMIN" && role !== "SYSTEM") {
    redirect(`/admin/inventory/stocktake/${params.id}`);
  }

  const [sessionData, sessionsList] = await Promise.all([
    getStocktakeSessionData(params.id),
    listStocktakeSessions(),
  ]);

  if (!sessionData) {
    notFound();
  }

  const listRow = sessionsList.find((s) => s.id === params.id);
  if (sessionData.status !== "CONFIRMED" || !listRow?.isLatestConfirmed) {
    redirect(`/admin/inventory/stocktake/${params.id}`);
  }

  const detailHref = `/admin/inventory/stocktake/${params.id}`;

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref={detailHref}
        backLabel="Phiếu kiểm kê"
        title={`Hoàn tác phiên kiểm kê ${params.id}`}
        subtitle={`Người tạo: ${sessionData.createdByName} · Ngày: ${formatDateTimeFull(sessionData.createdAt)}`}
      />
      <CancelStocktakeForm session={sessionData} listRow={listRow} />
    </div>
  );
}
