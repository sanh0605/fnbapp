import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Thương hiệu" 
        subtitle="Quản lý các thương hiệu F&B đang hoạt động trên hệ thống." 
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
