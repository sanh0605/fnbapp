import { getSuppliers } from "./actions";
import SuppliersClient from "./components/SuppliersClient";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [suppliers, auth] = await Promise.all([getSuppliers(), resolveActor()]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deleteSupplierAction is
  // what actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  return <SuppliersClient suppliers={suppliers} canDelete={canDelete} />;
}
