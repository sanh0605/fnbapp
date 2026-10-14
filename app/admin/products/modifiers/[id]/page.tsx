import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { getModifiersData } from "@/app/admin/products/modifiers/actions";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { ModifierDetailView } from "./components/ModifierDetailView";
import type { DBModifierGroup, DBProduct } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ModifierDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [{ modifiers }, allProducts, groups] = await Promise.all([
    getModifiersData(),
    findAll("Products") as Promise<DBProduct[]>,
    findAll("Modifier_Groups") as Promise<DBModifierGroup[]>,
  ]);

  const modifier = modifiers.find((m) => m.id === params.id);
  if (!modifier) {
    notFound();
  }

  const group = groups.find((g) => g.id === modifier.group_id);

  const linkedProduct = modifier.product_id
    ? allProducts.find((p) => p.id === modifier.product_id)
    : null;

  const product = linkedProduct
    ? {
        id: linkedProduct.id,
        name: linkedProduct.name,
        status: linkedProduct.status,
      }
    : null;

  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/modifiers",
  );
  const returnTo = rawReturnTo.startsWith("/admin/products/modifiers/")
    ? "/admin/products/modifiers"
    : rawReturnTo;

  return (
    <ModifierDetailView
      modifier={modifier}
      product={product}
      groupName={group?.name ?? ""}
      allowStandalone={Boolean(group?.allow_standalone)}
      groupSelectionMode={group?.selection_mode}
      returnTo={returnTo}
    />
  );
}
