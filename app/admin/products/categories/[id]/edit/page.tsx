import { notFound } from "next/navigation";
import { getCategoriesWithCounts } from "@/app/admin/products/categories/actions";
import { ProductCategoryForm } from "@/app/admin/products/categories/components/ProductCategoryForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditProductCategoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/categories",
  );

  const { categories } = await getCategoriesWithCounts();

  const category = categories.find((c) => c.id === params.id);
  if (!category) {
    notFound();
  }

  const ownDetailPath = `/admin/products/categories/${encodeURIComponent(category.id)}`;
  const ownDetailPathRaw = `/admin/products/categories/${category.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/products/categories/")
    ? "/admin/products/categories"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/products/categories/${encodeURIComponent(category.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={category.name}
        title="Chỉnh sửa"
        subtitle={category.name}
      />
      <ProductCategoryForm
        initialData={category}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
