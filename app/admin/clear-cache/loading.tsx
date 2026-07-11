import { PageHeader } from "@/components/ui/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Xóa Bộ Nhớ Đệm (Clear Cache)" 
        subtitle="Hệ thống đã tự động làm mới bộ nhớ đệm khi bạn truy cập trang này."
      />
      <div className="bg-emerald-50/50 border border-emerald-100 text-emerald-800 px-4 py-4 rounded-2xl shadow-sm animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-emerald-200 rounded-full"></div>
          <div className="space-y-2 w-full">
            <div className="h-4 w-1/3 bg-emerald-200 rounded"></div>
            <div className="h-3 w-2/3 bg-emerald-200/50 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
