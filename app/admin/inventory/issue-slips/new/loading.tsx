import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";

export default function Loading() {
  return (
    <DetailFrame>
      <DetailHeader
        backHref="/admin/inventory/issue-slips"
        backLabel="Phiếu xuất"
        title="Tạo phiếu xuất"
        subtitle="Ghi nhận nguyên liệu lấy ra khỏi kho."
      />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border p-6 overflow-hidden">
        <SkeletonTable rows={3} columns={3} />
      </div>
    </DetailFrame>
  );
}
