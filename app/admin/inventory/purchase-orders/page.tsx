import { getPurchaseOrdersData } from "./actions";
import PurchaseOrdersClient from "./components/PurchaseOrdersClient";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: { supplier?: string };
}) {
  const { orders, suppliers, lines, items } = await getPurchaseOrdersData();
  return (
    <PurchaseOrdersClient
      orders={orders}
      suppliers={suppliers}
      lines={lines}
      items={items}
      initialSupplierId={searchParams.supplier}
    />
  );
}
