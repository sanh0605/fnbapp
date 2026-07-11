import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Nhập Hàng" 
        subtitle="Quản lý các đơn đặt hàng từ nhà cung cấp và theo dõi công nợ." 
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={6} />
      </div>
    </div>
  );
}
