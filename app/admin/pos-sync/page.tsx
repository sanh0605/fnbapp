import { getPosSyncAttentionItems } from "./actions";
import { PosSyncClient } from "./PosSyncClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function PosSyncPage() {
  const { lateOrders, failures } = await getPosSyncAttentionItems();

  return (
    <div className="space-y-6">
      <PageHeader title="Đơn cần chú ý" />
      <PosSyncClient lateOrders={lateOrders} failures={failures} />
    </div>
  );
}
