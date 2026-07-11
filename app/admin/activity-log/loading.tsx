import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Nhật ký Hoạt động" 
        subtitle="Theo dõi lịch sử chỉnh sửa đơn hàng, hủy đơn, và các sự kiện trong hệ thống."
      />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SkeletonTable rows={5} columns={4} />
      </div>
    </div>
  );
}
