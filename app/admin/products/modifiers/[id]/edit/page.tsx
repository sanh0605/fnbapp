import { notFound } from "next/navigation";
import { getModifiersData } from "@/app/admin/products/modifiers/actions";
import { findAll } from "@/lib/db/tables";
import { ModifierForm } from "@/app/admin/products/modifiers/components/ModifierForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditModifierPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/modifiers",
  );

  const [{ modifiers }, products] = await Promise.all([
    getModifiersData(),
    findAll("Products") as Promise<any[]>,
  ]);

  const modifier = modifiers.find((m) => m.id === params.id);
  if (!modifier) {
    notFound();
  }

  const linkedProduct = modifier.product_id
    ? products.find((p) => p.id === modifier.product_id)
    : undefined;
  const productStatus = linkedProduct?.status;

  const ownDetailPath = `/admin/products/modifiers/${encodeURIComponent(modifier.id)}`;
  const ownDetailPathRaw = `/admin/products/modifiers/${modifier.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/products/modifiers/")
    ? "/admin/products/modifiers"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/products/modifiers/${encodeURIComponent(modifier.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={modifier.name}
        title="Chỉnh sửa"
        subtitle={modifier.name}
      />
      <ModifierForm
        initialData={modifier}
        productStatus={productStatus}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
