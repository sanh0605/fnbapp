import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Sản Xuất / Nấu Bếp" 
        subtitle="Ghi nhận lịch sử nấu bếp, chế biến bán thành phẩm để hệ thống tự động trừ kho nguyên liệu."
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <SkeletonTable rows={5} columns={4} />
      </div>
    </div>
  );
}
