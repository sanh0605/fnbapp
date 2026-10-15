import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { Button } from "@/components/ui/Button";
import { getOrderDetailV2 } from "@/app/admin/orders/order-detail-actions";
import { safeReturnTo } from "@/lib/shared/return-to";
import { VoidOrderForm } from "./components/VoidOrderForm";

export const dynamic = "force-dynamic";

export default async function VoidOrderPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as any)?.role || "STAFF";
  const orderHref = `/admin/orders/${encodeURIComponent(params.id)}`;
  if (role !== "ADMIN" && role !== "MANAGER") {
    redirect(orderHref);
  }

  const detail = await getOrderDetailV2(params.id);
  if (!detail) {
    notFound();
  }

  const returnToRaw = typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined;
  const returnTo = safeReturnTo(returnToRaw, "/admin/orders", { listOnly: true });
  const detailHref = `${orderHref}?returnTo=${encodeURIComponent(returnTo)}`;
  const order = detail.order;
  const orderCode = order.display_order_no || order.order_no;

  if (order.status !== "COMPLETED") {
    return (
      <DetailFrame>
        <DetailHeader
          backHref={detailHref}
          backLabel="Đơn hàng"
          title={`Huỷ đơn ${orderCode}`}
        />
        <p className="text-text-secondary text-sm">Đơn này không huỷ được</p>
        <div>
          <Button href={detailHref} variant="secondary">
            Quay lại
          </Button>
        </div>
      </DetailFrame>
    );
  }

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel="Đơn hàng"
        title={`Huỷ đơn ${orderCode}`}
      />
      <VoidOrderForm order={order} detailHref={detailHref} />
    </DetailFrame>
  );
}
