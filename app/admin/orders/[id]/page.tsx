import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getOrderDetailV2 } from "@/app/admin/orders/actions";
import { safeReturnTo } from "@/app/admin/orders/components/return-to";
import { OrderDetailView } from "./components/OrderDetailView";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
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
