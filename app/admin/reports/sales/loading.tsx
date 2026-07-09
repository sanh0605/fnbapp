import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SalesLoading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Báo cáo Bán hàng" 
        subtitle="Phân tích hiệu quả kinh doanh theo thời gian (V2)." 
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
      <SkeletonTable rows={5} columns={3} />
    </div>
  );
}
