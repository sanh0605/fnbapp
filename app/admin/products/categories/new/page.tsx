import { ProductCategoryForm } from "@/app/admin/products/categories/components/ProductCategoryForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewProductCategoryPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/categories");

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhóm món" />
      <PageHeader
        title="Thêm Danh Mục Mới"
        subtitle="Thêm nhóm sản phẩm mới vào Menu bán hàng."
      />
      <ProductCategoryForm returnTo={returnTo} />
    </div>
  );
}
