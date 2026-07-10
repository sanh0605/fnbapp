import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Nhà Cung Cấp" 
        subtitle="Quản lý thông tin liên hệ và danh sách các đối tác cung ứng." 
      />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SkeletonTable rows={5} columns={6} />
      </div>
    </div>
  );
}
