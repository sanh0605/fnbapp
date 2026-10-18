import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <ListPageHeader group="Bán hàng" title="Đơn hàng" />
      <SkeletonTable rows={10} columns={6} />
    </div>
  );
}
