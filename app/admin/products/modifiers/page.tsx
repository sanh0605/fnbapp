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
  const toppings = products.filter(
    (p: any) => p.category_id === "CAT-007"
  );
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
