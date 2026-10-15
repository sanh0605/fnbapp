import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { findAll } from "@/lib/db/tables";
import { getModifierGroup } from "@/app/admin/products/modifier-groups/actions";
import { ModifierGroupDetailView } from "./components/ModifierGroupDetailView";
import type { DBProduct, DBProductCategory } from "@/types/db";
import { safeReturnTo } from "@/app/admin/products/components/return-to";

export const dynamic = "force-dynamic";

export default async function ModifierGroupDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [groupData, auth, allProducts, allCategories] = await Promise.all([
    getModifierGroup(params.id),
    resolveActor(),
    findAll("Products") as Promise<DBProduct[]>,
    findAll("Product_Categories") as Promise<DBProductCategory[]>,
  ]);

  if (!groupData) {
    notFound();
  }

  // Rule: Only ADMIN erases a group, and only when the group has no option
  const canDelete = Boolean(
    auth.ok && auth.actor.role === "ADMIN" && groupData.options.length === 0
  );

  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/modifier-groups",
  );
  const returnTo = rawReturnTo.startsWith("/admin/products/modifier-groups/")
    ? "/admin/products/modifier-groups"
    : rawReturnTo;

  return (
    <ModifierGroupDetailView
      group={groupData.group}
      options={groupData.options}
      productIds={groupData.productIds}
      allProducts={allProducts}
      allCategories={allCategories}
      canDelete={canDelete}
      returnTo={returnTo}
    />
  );
}
