import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getModifierGroup } from "@/app/admin/products/modifier-groups/actions";
import { ModifierGroupForm } from "@/app/admin/products/modifier-groups/components/ModifierGroupForm";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import type { DBProduct, DBProductCategory } from "@/types/db";
import { safeReturnTo } from "@/lib/shared/return-to";

export const dynamic = "force-dynamic";

export default async function EditModifierGroupPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/modifier-groups",
  );

  const [groupData, allCategories, allProducts] = await Promise.all([
    getModifierGroup(params.id),
    findAll("Product_Categories") as Promise<DBProductCategory[]>,
    findAll("Products") as Promise<DBProduct[]>,
  ]);

  if (!groupData) {
    notFound();
  }

  const { group, productIds } = groupData;

  const ownDetailPath = `/admin/products/modifier-groups/${encodeURIComponent(group.id)}`;
  const ownDetailPathRaw = `/admin/products/modifier-groups/${group.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/products/modifier-groups/")
    ? "/admin/products/modifier-groups"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/products/modifier-groups/${encodeURIComponent(group.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={group.name}
        title="Chỉnh sửa"
        subtitle={group.name}
      />
      <ModifierGroupForm
        initialData={group}
        initialProductIds={productIds}
        categories={allCategories}
        products={allProducts}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
