import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getOrderDetailV2 } from "@/app/admin/orders/order-detail-actions";
import { safeReturnTo } from "@/app/admin/orders/components/return-to";
import { OrderDetailView } from "./components/OrderDetailView";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const returnToRaw = typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined;
  const returnTo = safeReturnTo(returnToRaw);

  const [detail, brands] = await Promise.all([
    getOrderDetailV2(params.id),
    findAll("Brands"),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <OrderDetailView
      detail={detail}
      brands={brands}
      returnTo={returnTo}
    />
  );
}
