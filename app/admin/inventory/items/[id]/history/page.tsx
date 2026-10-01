import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { getItemPurchaseHistory } from "../../actions";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { PurchaseHistoryView } from "./components/PurchaseHistoryView";
import type { DBPurchasedItem } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PurchaseHistoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/items");
  const [item, rows] = await Promise.all([
    findById("Purchased_Items", params.id) as Promise<DBPurchasedItem | null>,
    getItemPurchaseHistory(params.id),
  ]);

  if (!item) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Hàng hoá" />
      <PageHeader
        title={`Lịch sử nhập hàng: ${item.name}`}
        subtitle={`Lịch sử các lần nhập hàng đã hoàn thành của mặt hàng ${item.name}.`}
      />
      <PurchaseHistoryView rows={rows} itemName={item.name} />
    </div>
  );
}
