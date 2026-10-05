import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getOrderDetailV2 } from "@/app/admin/orders/actions";
import { safeReturnTo } from "@/app/admin/orders/components/return-to";
import { OrderEditForm } from "./components/OrderEditForm";

export const dynamic = "force-dynamic";

export default async function OrderEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnToRaw = typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined;
  const returnTo = safeReturnTo(returnToRaw);

  const [detail, products, variants, brands, modifiers, categories] = await Promise.all([
    getOrderDetailV2(params.id),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Brands"),
    findAll("Modifiers"),
    findAll("Product_Categories"),
  ]);

  if (!detail || detail.order.status !== "COMPLETED") {
    notFound();
  }

  return (
    <OrderEditForm
      order={detail.order}
      brands={brands}
      products={products}
      variants={variants}
      modifiers={modifiers}
      categories={categories}
      returnTo={returnTo}
    />
  );
}
