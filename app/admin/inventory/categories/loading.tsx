import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Phân Loại Hàng Hoá" 
        subtitle="Tự do tạo các phân loại tuỳ chỉnh (Bao bì, Nguyên liệu ướt, v.v.)." 
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={4} />
      </div>
    </div>
  );
}
