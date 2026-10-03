import { notFound } from "next/navigation";
import { getBrands } from "@/app/admin/brands/actions";
import { BrandForm } from "@/app/admin/brands/components/BrandForm";
import { safeReturnTo } from "@/app/admin/brands/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import type { DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditBrandPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(searchParams?.returnTo);

  const brands = await getBrands();
  const brand = brands.find(
    (b: DBBrand) => b.id === params.id && b.status !== "DELETED",
  );

  if (!brand) {
    notFound();
  }

  const ownDetailPath = `/admin/brands/${encodeURIComponent(brand.id)}`;
  const ownDetailPathRaw = `/admin/brands/${brand.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/brands/")
    ? "/admin/brands"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/brands/${encodeURIComponent(brand.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={brand.name}
        title="Chỉnh sửa"
        subtitle={brand.name}
      />
      <BrandForm initialData={brand} returnTo={detailHref} />
    </DetailFrame>
  );
}
