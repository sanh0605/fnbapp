import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdminNotFound() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Không tìm thấy trang"
        subtitle="Trang này không có hoặc đã bị xoá."
      />
      <div>
        <Link
          href="/admin"
          className="text-sm font-medium text-primary hover:text-primary-hover no-underline inline-flex items-center gap-1 min-h-[48px] md:min-h-[40px]"
        >
          &larr; Về Tổng quan
        </Link>
      </div>
    </div>
  );
}
