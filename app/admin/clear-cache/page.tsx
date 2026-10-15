import { PageHeader } from "@/components/ui/PageHeader";

export default async function ClearCachePage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Xoá bộ nhớ đệm" 
        subtitle="Hệ thống đã tự động làm mới bộ nhớ đệm khi bạn truy cập trang này."
      />
      <div className="bg-success/10 border border-success/30 text-success-active px-4 py-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">✔️</span>
          <div>
            <h3 className="font-bold">Đã làm mới bộ nhớ đệm thành công!</h3>
            <p className="text-sm mt-1 opacity-90">Các bảng dữ liệu từ Google Sheets đã được tải lại. Dữ liệu mới nhất sẽ được hiển thị trên hệ thống.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
