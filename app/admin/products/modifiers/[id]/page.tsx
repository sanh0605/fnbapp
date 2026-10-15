import { notFound } from "next/navigation";
import { findAll, findSoldModifierIds } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import { getModifiersData } from "@/app/admin/products/modifiers/actions";
import { safeReturnTo } from "@/lib/shared/return-to";
import { ModifierDetailView } from "./components/ModifierDetailView";
import type { DBModifierGroup, DBProduct } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ModifierDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [{ modifiers }, allProducts, groups, soldIds, auth] = await Promise.all([
    getModifiersData(),
    findAll("Products") as Promise<DBProduct[]>,
    findAll("Modifier_Groups") as Promise<DBModifierGroup[]>,
    findSoldModifierIds(),
    resolveActor(),
  ]);

  const modifier = modifiers.find((m) => m.id === params.id);
  if (!modifier) {
    notFound();
  }

  const isSold = soldIds.includes(modifier.id);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN" && !isSold);

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
      canDelete={canDelete}
      returnTo={returnTo}
    />
  );
}
