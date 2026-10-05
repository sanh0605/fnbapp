import { getItemsData, getItemStockById } from "./actions";
import ItemsClient from "./components/ItemsClient";
import { Suspense } from "react";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: { q?: string; category?: string; page?: string };
}) {
  const [data, stockById, auth] = await Promise.all([
    getItemsData(),
    getItemStockById(),
    resolveActor(),
  ]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deletePurchasedItemAction is
  // what actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ItemsClient
        {...data}
        stockById={stockById}
        canDelete={canDelete}
        initialSearch={searchParams?.q ?? ""}
        initialCategory={searchParams?.category ?? "ALL"}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
