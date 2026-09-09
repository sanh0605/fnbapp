import { getItemsData } from "./actions";
import ItemsClient from "./components/ItemsClient";
import { Suspense } from "react";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const [data, auth] = await Promise.all([getItemsData(), resolveActor()]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deletePurchasedItemAction is
  // what actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ItemsClient {...data} canDelete={canDelete} />
    </Suspense>
  );
}
