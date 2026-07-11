import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Nhóm Nguyên Liệu" 
        subtitle="Quản lý các nguyên liệu cơ bản dùng trong pha chế và chế biến." 
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
