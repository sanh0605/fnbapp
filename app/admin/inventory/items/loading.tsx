import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Hàng hoá" 
        subtitle="Danh sách các mặt hàng thực tế nhập từ nhà cung cấp." 
      />
      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
