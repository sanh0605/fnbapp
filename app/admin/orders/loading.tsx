import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Đơn hàng" 
        subtitle="Quản lý tất cả đơn hàng từ các kênh bán"
      />
      <SkeletonTable rows={10} columns={6} />
    </div>
  );
}
