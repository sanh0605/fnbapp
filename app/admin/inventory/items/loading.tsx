import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <ListPageHeader group="Kho" title="Hàng hoá" />
      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
