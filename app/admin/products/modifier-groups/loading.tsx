import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhóm tuỳ chọn"
        subtitle="Quản lý các nhóm tuỳ chọn như đường, đá, topping trong Menu bán hàng."
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
