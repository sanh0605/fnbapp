import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Công cụ Dự toán Giá vốn" 
        subtitle="Giả lập công thức để tính toán giá vốn dự kiến. Bạn có thể chọn nguyên liệu có sẵn trong hệ thống hoặc nhập tay nguyên liệu mới để ước tính."
      />
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-4xl mx-auto">
        <SkeletonTable rows={3} columns={5} />
      </div>
    </div>
  );
}
