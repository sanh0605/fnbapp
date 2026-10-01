import { getModifiersData } from "./actions";
import { findAll } from "@/lib/db/tables";
import ModifiersClient from "@/app/admin/products/modifiers/components/ModifiersClient";

export const dynamic = "force-dynamic";

export default async function ModifiersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const data = await getModifiersData();
  const products = await findAll("Products");
  const toppings = (products as any[]).filter(
    (p: any) => p.category_id === "CAT-007"
  );
  return (
    <ModifiersClient
      {...data}
      toppings={toppings}
      initialSearch={searchParams?.q || ""}
    />
  );
}
