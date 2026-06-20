import { getPurchaseOrdersData } from "./actions";
import PurchaseOrdersClient from "./components/PurchaseOrdersClient";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const { orders, suppliers } = await getPurchaseOrdersData();
  return <PurchaseOrdersClient orders={orders} suppliers={suppliers} />;
}
