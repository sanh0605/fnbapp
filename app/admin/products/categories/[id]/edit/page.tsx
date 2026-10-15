import { notFound } from "next/navigation";
import { getCategoriesWithCounts } from "@/app/admin/products/categories/actions";
import { getProductTypes } from "@/app/admin/products/types/actions";
import { ProductCategoryForm } from "@/app/admin/products/categories/components/ProductCategoryForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditProductCategoryPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/categories",
  );

  const [{ categories }, typeRows] = await Promise.all([
    getCategoriesWithCounts(),
    getProductTypes(),
  ]);

  const category = categories.find((c) => c.id === params.id);
  if (!category) {
    notFound();
  }

  const types = typeRows.map((r) => r.type);

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
        types={types}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
