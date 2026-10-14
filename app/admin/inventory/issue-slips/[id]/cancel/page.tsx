import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { getIssueSlipDetail } from "../../actions";
import CancelIssueSlipForm from "./components/CancelIssueSlipForm";

export const dynamic = "force-dynamic";

export default async function CancelIssueSlipPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as any)?.role || "STAFF";
  if (role !== "ADMIN" && role !== "MANAGER") {
    redirect(`/admin/inventory/issue-slips/${params.id}`);
  }

  const detail = await getIssueSlipDetail(params.id);
  if (!detail) {
    notFound();
  }

  const rawReturnTo = searchParams?.returnTo;
  const returnTo =
    typeof rawReturnTo === "string" &&
    (rawReturnTo === "/admin/inventory/issue-slips" ||
      rawReturnTo.startsWith("/admin/inventory/issue-slips?"))
      ? rawReturnTo
      : "/admin/inventory/issue-slips";

  const detailHref =
    returnTo !== "/admin/inventory/issue-slips"
      ? `/admin/inventory/issue-slips/${params.id}?returnTo=${encodeURIComponent(returnTo)}`
      : `/admin/inventory/issue-slips/${params.id}`;

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref={detailHref}
        backLabel="Phiếu xuất"
        title={`Huỷ phiếu ${detail.id}`}
        subtitle={`Ngày xuất: ${detail.dateText} · Người ghi: ${detail.createdByName}`}
      />
      <CancelIssueSlipForm detail={detail} detailHref={detailHref} />
    </div>
  );
}
