import { getPosSyncAttentionItems } from "./actions";
import { PosSyncClient } from "./PosSyncClient";

export const dynamic = "force-dynamic";

export default async function PosSyncPage() {
  const { lateOrders, failures } = await getPosSyncAttentionItems();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Đơn cần chú ý</h1>
      <PosSyncClient lateOrders={lateOrders} failures={failures} />
    </div>
  );
}
