import { notFound } from "next/navigation";
import { getSuppliers } from "../actions";
import { getPurchaseOrdersPage } from "@/app/admin/inventory/purchase-orders/actions";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "../components/return-to";
import { SupplierDetailView } from "./components/SupplierDetailView";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string; poPage?: string };
}) {
  const [suppliers, auth, orders] = await Promise.all([
    getSuppliers(),
    resolveActor(),
    getPurchaseOrdersPage({ supplier: params.id, page: searchParams?.poPage }),
  ]);

  const supplier = suppliers.find((s) => s.id === params.id);
  if (!supplier) {
    notFound();
  }

  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  const rawReturnTo = safeReturnTo(searchParams?.returnTo);
  const returnTo = rawReturnTo.startsWith("/admin/suppliers/")
    ? "/admin/suppliers"
    : rawReturnTo;

  return (
    <SupplierDetailView
      supplier={supplier}
      orders={orders}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
