import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex justify-between items-center mb-8">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
