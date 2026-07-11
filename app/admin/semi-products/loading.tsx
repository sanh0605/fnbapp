import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Bán Thành Phẩm" 
        subtitle="Tổng quan danh sách nguyên liệu đã qua chế biến sơ bộ (như trà ủ, thạch, trân châu nấu...) dùng để pha chế."
      />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
