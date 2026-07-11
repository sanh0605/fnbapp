import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Điều chỉnh Tồn kho" 
        subtitle="Quản lý và phê duyệt các yêu cầu điều chỉnh số lượng tồn kho thực tế." 
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={10} />
      </div>
    </div>
  );
}
