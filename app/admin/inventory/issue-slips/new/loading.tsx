import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import Link from "next/link";

import { BackLink } from "@/components/ui/BackLink";

export default function Loading() {
  return (
    <div className="space-y-6">
      <BackLink href="/admin/inventory/issue-slips" label="Phiếu xuất" />
      <PageHeader title="Tạo phiếu xuất" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border p-6 overflow-hidden">
        <SkeletonTable rows={3} columns={3} />
      </div>
    </div>
  );
}
