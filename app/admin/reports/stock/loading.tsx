import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý & Cân bằng Tồn kho" 
        subtitle="Kiểm kê số lượng thực tế và điều chỉnh nếu có sai lệch."
      />
      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={4} />
      </div>
    </div>
  );
}
