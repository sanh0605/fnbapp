import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Đơn vị (Units)" 
        subtitle="Quản lý danh sách các đơn vị tính hợp lệ (kg, lít, hộp...)" 
      />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SkeletonTable rows={5} columns={3} />
      </div>
    </div>
  );
}
