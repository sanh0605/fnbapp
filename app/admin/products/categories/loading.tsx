import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Danh mục" 
        subtitle="Quản lý các nhóm sản phẩm trong Menu bán hàng."
      />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SkeletonTable rows={5} columns={4} />
      </div>
    </div>
  );
}
