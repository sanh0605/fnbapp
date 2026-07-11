import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-20 bg-gray-50 animate-pulse rounded-xl mb-6 border border-gray-100"></div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-32 animate-pulse"></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-32 animate-pulse"></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-32 animate-pulse"></div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
