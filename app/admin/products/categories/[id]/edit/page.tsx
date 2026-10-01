import { notFound } from "next/navigation";
import { getCategoriesWithCounts } from "@/app/admin/products/categories/actions";
import { ProductCategoryForm } from "@/app/admin/products/categories/components/ProductCategoryForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditProductCategoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/categories");
  const { categories } = await getCategoriesWithCounts();

  const category = categories.find((c) => c.id === params.id);
  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhóm món" />
      <PageHeader
        title={`Sửa Danh Mục: ${category.name}`}
        subtitle="Cập nhật thông tin nhóm sản phẩm."
      />
      <ProductCategoryForm
        initialData={category}
        returnTo={returnTo}
      />
    </div>
  );
}
