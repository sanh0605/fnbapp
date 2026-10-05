import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { ConversionDetailView } from "./components/ConversionDetailView";
import type { DBUOMConversion, DBPurchasedItem, DBUnit } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ConversionDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [allConversions, allItems, allUnits, poLines, auth] = await Promise.all([
    findAll("UOM_Conversions") as Promise<DBUOMConversion[]>,
    findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
    findAll("Units") as Promise<DBUnit[]>,
    findAll("Purchase_Order_Lines") as Promise<Array<{ id: string; conversion_id?: string }>>,
    resolveActor(),
  ]);

  const conversion = allConversions.find((c) => c.id === params.id);
  if (!conversion) {
    notFound();
  }

  const item = allItems.find((i) => i.id === conversion.purchased_item_id);
  const purchaseOrderLinesCount = poLines.filter((l) => l.conversion_id === conversion.id).length;
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/conversions");
  const returnTo = rawReturnTo.startsWith("/admin/inventory/conversions/")
    ? "/admin/inventory/conversions"
    : rawReturnTo;

  return (
    <ConversionDetailView
      conversion={conversion}
      item={item}
      units={allUnits}
      purchaseOrderLinesCount={purchaseOrderLinesCount}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
