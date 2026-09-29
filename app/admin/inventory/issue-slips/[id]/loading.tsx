export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 bg-surface-card rounded animate-pulse"></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-card rounded-xl border border-border h-64 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
