import { notFound } from "next/navigation";
import { loadProductRows } from "@/app/admin/products/load-product-rows";
import ProductForm from "@/app/admin/products/components/ProductForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");

  const { enhancedProducts, activeCategories } = await loadProductRows();

  const product = enhancedProducts.find((p) => p.id === params.id);
  if (!product) {
    notFound();
  }

  const ownDetailPath = `/admin/products/${encodeURIComponent(product.id)}`;
  const ownDetailPathRaw = `/admin/products/${product.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/products/")
    ? "/admin/products"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/products/${encodeURIComponent(product.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={product.name}
        title="Chỉnh sửa"
        subtitle={product.name}
      />
      <ProductForm
        categories={activeCategories}
        initialData={product}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
