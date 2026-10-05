import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { getPurchaseOrderCancelView } from "../../actions";
import CancelPurchaseOrderForm from "./components/CancelPurchaseOrderForm";

export const dynamic = "force-dynamic";

export default async function CancelPurchaseOrderPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as any)?.role || "STAFF";
  if (role !== "ADMIN" && role !== "MANAGER") {
    redirect("/admin/inventory/purchase-orders/" + params.id);
  }

  const view = await getPurchaseOrderCancelView(params.id);
  if (view.state === "not-found") {
    notFound();
  }

  const detailHref = "/admin/inventory/purchase-orders/" + params.id;

  if (view.state === "missing-migration") {
    return (
      <div className="space-y-6">
        <BackLink href={detailHref} label="Phiếu nhập" />
        <h1 className="text-2xl font-bold text-text-primary">Huỷ phiếu nhập {params.id}</h1>
        <p className="text-text-secondary text-sm">Chưa cập nhật dữ liệu, chưa huỷ được phiếu.</p>
        <div>
          <Link
            href={detailHref}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium bg-surface-secondary text-text-primary hover:bg-surface-secondary/80 border border-border min-h-[44px]"
          >
            Quay lại
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href={detailHref} label="Phiếu nhập" />
      <h1 className="text-2xl font-bold text-text-primary">Huỷ phiếu nhập {params.id}</h1>
      <CancelPurchaseOrderForm view={view} />
    </div>
  );
}
