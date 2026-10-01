import { loadProductRows } from "@/app/admin/products/load-product-rows";
import ProductForm from "@/app/admin/products/components/ProductForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const { activeCategories } = await loadProductRows();

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Món" />
      <PageHeader
        title="Thêm Món Mới"
        subtitle="Thêm món mới vào thực đơn bán hàng."
      />
      <ProductForm
        categories={activeCategories}
        returnTo={returnTo}
      />
    </div>
  );
}
