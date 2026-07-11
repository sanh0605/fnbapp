import { Skeleton } from "./Skeleton";

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number, columns?: number }) {
  return (
    <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden w-full">
      <div className="p-4 border-b border-border bg-page flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex gap-4">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
