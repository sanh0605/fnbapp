import { notFound } from "next/navigation";
import { loadProductRow } from "@/app/admin/products/load-product-rows";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { findAllWhere } from "@/lib/db/tables";
import { ProductDetailView } from "./components/ProductDetailView";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [product, auth] = await Promise.all([loadProductRow(params.id), resolveActor()]);
  if (!product) {
    notFound();
  }

  // A dish still linked to a topping cannot be erased (RESTRICT), so the
  // button is not offered; eraseProduct says why if it is called anyway.
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN" && !product.hasModifierLink);

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const returnTo = rawReturnTo.startsWith("/admin/products/")
    ? "/admin/products"
    : rawReturnTo;

  const [category] = product.category_id
    ? (await findAllWhere("Product_Categories", { eq: { id: product.category_id }, limit: 1 })).filter(
        (c: any) => c.status !== "DELETED",
      )
    : [];
  const categoryName = category?.name || "Chưa phân loại";

  let linkedModifierId: string | null = null;
  if (product.isLinkedTopping) {
    const modifiers = await findAllWhere("Modifiers", { eq: { product_id: product.id } });
    const mod = modifiers.find((m: any) => m.status === "ACTIVE");
    if (mod) {
      linkedModifierId = mod.id;
    }
  }

  return (
    <ProductDetailView
      product={product}
      categoryName={categoryName}
      returnTo={returnTo}
      canDelete={canDelete}
      linkedModifierId={linkedModifierId}
    />
  );
}
