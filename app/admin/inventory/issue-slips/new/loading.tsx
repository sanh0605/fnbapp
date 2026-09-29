import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import Link from "next/link";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Link href="/admin/inventory/issue-slips" className="text-sm font-medium text-primary hover:text-primary-hover no-underline self-start inline-block">
        ← Phiếu xuất
      </Link>
      <PageHeader title="Tạo phiếu xuất" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border p-6 overflow-hidden">
        <SkeletonTable rows={3} columns={3} />
      </div>
    </div>
  );
}
