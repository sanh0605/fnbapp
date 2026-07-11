import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-8">
      <PageHeader 
        title="Backdated Ledger Review" 
        subtitle="Các giao dịch nhập kho được backdate cần admin duyệt" 
      />
      <div className="bg-surface-card rounded-lg shadow border border-border">
        <SkeletonTable />
      </div>
    </div>
  );
}
