import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Thành phẩm (Menu)" 
        subtitle="Quản lý Menu bán hàng, cấu hình Size và Định mức pha chế."
      />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SkeletonTable rows={5} columns={6} />
      </div>
    </div>
  );
}
