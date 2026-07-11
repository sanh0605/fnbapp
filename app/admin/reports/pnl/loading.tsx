import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-20 bg-page animate-pulse rounded-card mb-6 border border-border"></div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 h-32 animate-pulse"></div>
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 h-32 animate-pulse"></div>
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 h-32 animate-pulse"></div>
      </div>

      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
