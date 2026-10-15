import { notFound } from "next/navigation";
import { getOrderDetailV2 } from "@/app/admin/orders/order-detail-actions";
import { safeReturnTo } from "@/app/admin/orders/components/return-to";
import { OrderEditForm } from "./components/OrderEditForm";

export const dynamic = "force-dynamic";

export default async function OrderEditPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const returnToRaw = typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined;
  const returnTo = safeReturnTo(returnToRaw);

  const detail = await getOrderDetailV2(params.id);

  if (!detail || detail.order.status !== "COMPLETED") {
    notFound();
  }

  return (
    <OrderEditForm
      order={detail.order}
      returnTo={returnTo}
    />
  );
}
