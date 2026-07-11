import { PageHeader } from "@/components/ui/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Sao lưu & Đồng bộ" 
        subtitle="Quản lý đồng bộ dữ liệu tự động và thủ công từ Supabase lên Google Sheets."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-80 animate-pulse"></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-80 animate-pulse"></div>
      </div>
    </div>
  );
}
