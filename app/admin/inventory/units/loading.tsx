import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListPageHeader group="Kho" title="Đơn vị tính" />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={3} />
      </div>
    </div>
  );
}
