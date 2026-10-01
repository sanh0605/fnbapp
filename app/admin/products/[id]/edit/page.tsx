import { notFound } from "next/navigation";
import { loadProductRows } from "@/app/admin/products/load-product-rows";
import ProductForm from "@/app/admin/products/components/ProductForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const { enhancedProducts, activeCategories } = await loadProductRows();

  const product = enhancedProducts.find((p) => p.id === params.id);
  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Món" />
      <PageHeader
        title={`Sửa Món: ${product.name}`}
        subtitle="Cập nhật thông tin món, size và giá bán."
      />
      <ProductForm
        categories={activeCategories}
        initialData={product}
        returnTo={returnTo}
      />
    </div>
  );
}
