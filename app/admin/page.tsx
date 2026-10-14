import Link from "next/link";
import { formatTime } from "@/lib/shared/datetime";
import { PageHeader } from "@/components/ui/PageHeader";
import { getDashboardData } from "@/lib/dashboard/dashboard-data";
import { DashboardView } from "@/app/admin/components/DashboardView";

export const dynamic = "force-dynamic";

export default async function AdminDashboard(_props?: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const now = new Date();
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan"
        subtitle="Việc cần xử lý và bán hàng 7 ngày qua."
        actions={
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
            <Link
              href="/admin/dashboard-settings"
              className="text-sm font-medium text-text-secondary hover:text-text-primary px-3 py-2 rounded-button border border-border bg-surface-card hover:bg-page transition-colors"
            >
              Cài đặt Tổng quan
            </Link>
            <div className="text-sm font-medium text-text-muted bg-surface-card px-4 py-2.5 rounded-lg border border-border shadow-sm hidden 2xl:block whitespace-nowrap">
              Cập nhật lúc: {formatTime(now, true)}
            </div>
          </div>
        }
      />
      <DashboardView data={data} />
    </div>
  );
}
