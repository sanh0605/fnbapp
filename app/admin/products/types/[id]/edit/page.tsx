import { notFound } from "next/navigation";
import { getProductType } from "@/app/admin/products/types/actions";
import { ProductTypeForm } from "@/app/admin/products/types/components/ProductTypeForm";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

function safeReturnTo(raw: string | undefined | null, fallback = "/admin/products/types"): string {
  if (!raw) return fallback;
  if (raw === fallback || raw.startsWith(`${fallback}?`) || raw.startsWith(`${fallback}/`)) {
    return raw;
  }
  return fallback;
}

export default async function EditProductTypePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/types",
  );

  const productType = await getProductType(params.id);
  if (!productType) {
    notFound();
  }

  const ownDetailPath = `/admin/products/types/${encodeURIComponent(productType.id)}`;
  const ownDetailPathRaw = `/admin/products/types/${productType.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/products/types/")
    ? "/admin/products/types"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/products/types/${encodeURIComponent(productType.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={productType.name}
        title="Sửa loại món"
        subtitle={productType.name}
      />
      <ProductTypeForm
        initialData={productType}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
