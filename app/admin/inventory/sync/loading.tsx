import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Đồng bộ Tồn kho Lịch sử" 
        subtitle="Đối chiếu Stock Ledger với Công thức (Recipes) để sửa lỗi lệch kho do cập nhật trễ." 
      />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SkeletonTable rows={5} columns={3} />
      </div>
    </div>
  );
}
