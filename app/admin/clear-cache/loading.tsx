import { PageHeader } from "@/components/ui/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Xóa Bộ Nhớ Đệm (Clear Cache)" 
        subtitle="Hệ thống đã tự động làm mới bộ nhớ đệm khi bạn truy cập trang này."
      />
      <div className="bg-success/10/50 border border-success/20 text-success-active px-4 py-4 rounded-2xl shadow-sm animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-success/20 rounded-full"></div>
          <div className="space-y-2 w-full">
            <div className="h-4 w-1/3 bg-success/20 rounded"></div>
            <div className="h-3 w-2/3 bg-success/10 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
