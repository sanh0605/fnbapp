import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Loại món"
        subtitle="Quản lý các loại món trong Menu bán hàng."
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={3} />
      </div>
    </div>
  );
}
