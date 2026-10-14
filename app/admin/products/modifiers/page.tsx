import { Suspense } from "react";
import { getModifiersData } from "./actions";
import { findAll } from "@/lib/db/tables";
import ModifiersClient from "@/app/admin/products/modifiers/components/ModifiersClient";

export const dynamic = "force-dynamic";

export default async function ModifiersPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const [{ modifiers }, products] = await Promise.all([
    getModifiersData(),
    findAll("Products") as Promise<any[]>,
  ]);
  // A standalone topping is the product a modifier links to, in any dish group.
  const linkedIds = new Set(modifiers.map((m: any) => m.product_id).filter(Boolean));
  const toppings = products.filter((p: any) => linkedIds.has(p.id));
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ModifiersClient
        modifiers={modifiers}
        toppings={toppings}
        initialSearch={searchParams?.q || ""}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
