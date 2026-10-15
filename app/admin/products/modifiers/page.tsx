import { Suspense } from "react";
import { getModifiersData } from "./actions";
import { findAll } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import type { DBModifierGroup } from "@/types/db";
import ModifiersClient from "@/app/admin/products/modifiers/components/ModifiersClient";

export const dynamic = "force-dynamic";

export default async function ModifiersPage(
  props: {
    searchParams?: Promise<{ q?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const [{ modifiers }, products, groups, auth] = await Promise.all([
    getModifiersData(),
    findAll("Products") as Promise<any[]>,
    findAll("Modifier_Groups") as Promise<DBModifierGroup[]>,
    resolveActor(),
  ]);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");
  // A standalone topping is the product a modifier links to, in any dish group.
  const linkedIds = new Set(modifiers.map((m: any) => m.product_id).filter(Boolean));
  const toppings = products.filter((p: any) => linkedIds.has(p.id));
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ModifiersClient
        modifiers={modifiers}
        toppings={toppings}
        groups={groups}
        initialSearch={searchParams?.q || ""}
        initialPage={searchParams?.page}
        canDelete={canDelete}
      />
    </Suspense>
  );
}
