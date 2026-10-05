import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getModifiersData } from "@/app/admin/products/modifiers/actions";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { ModifierDetailView } from "./components/ModifierDetailView";
import type { DBProduct } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ModifierDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [{ modifiers }, allProducts] = await Promise.all([
    getModifiersData(),
    findAll("Products") as Promise<DBProduct[]>,
  ]);

  const modifier = modifiers.find((m) => m.id === params.id);
  if (!modifier) {
    notFound();
  }

  const linkedProduct = modifier.product_id
    ? allProducts.find((p) => p.id === modifier.product_id)
    : null;

  const product = linkedProduct
    ? {
        id: linkedProduct.id,
        name: linkedProduct.name,
        status: linkedProduct.status,
      }
    : null;

  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/modifiers",
  );
  const returnTo = rawReturnTo.startsWith("/admin/products/modifiers/")
    ? "/admin/products/modifiers"
    : rawReturnTo;

  return (
    <ModifierDetailView
      modifier={modifier}
      product={product}
      returnTo={returnTo}
    />
  );
}
