import { getPurchaseOrdersPage } from "./actions";
import PurchaseOrdersClient from "./components/PurchaseOrdersClient";
import type { PurchaseOrderListFilters } from "@/lib/purchasing/purchase-order-list";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; supplier?: string; from?: string; to?: string; page?: string };
}) {
  const filters: PurchaseOrderListFilters = {
    q: searchParams.q,
    status: searchParams.status,
    supplier: searchParams.supplier,
    from: searchParams.from,
    to: searchParams.to,
    page: searchParams.page,
  };
  const pageData = await getPurchaseOrdersPage(filters);
  return <PurchaseOrdersClient pageData={pageData} />;
}
