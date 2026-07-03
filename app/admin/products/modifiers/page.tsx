import { getModifiersData } from "./actions";
import { findAll } from "@/lib/sheets_db";
import ModifiersClient from "./components/ModifiersClient";

export const dynamic = "force-dynamic";

export default async function ModifiersPage() {
  const data = await getModifiersData();
  const products = await findAll("Products");
  const toppings = (products as any[]).filter(
    (p: any) => p.category_id === "CAT-007"
  );
  return <ModifiersClient {...data} toppings={toppings} />;
}
