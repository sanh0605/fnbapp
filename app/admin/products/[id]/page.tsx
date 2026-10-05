import { notFound } from "next/navigation";
import { loadProductRows } from "@/app/admin/products/load-product-rows";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { findAll } from "@/lib/db/tables";
import { ProductDetailView } from "./components/ProductDetailView";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [{ enhancedProducts, activeCategories }, auth] = await Promise.all([
    loadProductRows(),
    resolveActor(),
  ]);

  const product = enhancedProducts.find((p: any) => p.id === params.id);
  if (!product) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const returnTo = rawReturnTo.startsWith("/admin/products/")
    ? "/admin/products"
    : rawReturnTo;

  const category = activeCategories.find((c: any) => c.id === product.category_id);
  const categoryName = category?.name || "Chưa phân loại";

  let linkedModifierId: string | null = null;
  if (product.isLinkedTopping) {
    const modifiers = await findAll("Modifiers");
    const mod = modifiers.find(
      (m: any) => m.status === "ACTIVE" && m.product_id === product.id,
    );
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
