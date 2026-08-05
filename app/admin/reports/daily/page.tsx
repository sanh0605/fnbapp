import { getDailyDigest } from "./actions";
import { DailyDigestFilter } from "./DailyDigestFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatDeltaPct(pct: number | null): string {
  if (pct === null) return "--";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function deltaColorClass(value: number | null): string {
  if (value === null || value === 0) return "text-text-muted";
  return value > 0 ? "text-success" : "text-danger";
}

export default async function DailyDigestPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const digest = await getDailyDigest(searchParams.date);
  const dateLabel = new Date(`${digest.date}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const hasAttention = digest.negativeStockItems.length > 0;

  return (
    <div className="space-y-6">
      <DailyDigestFilter date={digest.date} />
      <p className="text-sm text-text-secondary -mt-4">{dateLabel}</p>

      {hasAttention && (
        <Alert variant="warning" title="Cần chú ý">
          <ul className="list-disc list-inside space-y-1">
            {digest.negativeStockItems.length > 0 && (
              <li>{digest.negativeStockItems.length} nguyên liệu/bán thành phẩm đang âm tồn kho.</li>
            )}
          </ul>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <div className="text-sm font-medium text-text-secondary mb-1">Doanh Thu Trong Ngày</div>
          <div className="text-3xl font-bold text-text-primary">{formatNumber(digest.today.revenue)}</div>
          <div className="text-xs mt-2 space-x-3">
            <span className={deltaColorClass(digest.vsYesterday.revenueDeltaPct)}>
              So hôm qua: {formatDeltaPct(digest.vsYesterday.revenueDeltaPct)}
            </span>
            <span className={deltaColorClass(digest.vsSameWeekdayLastWeek.revenueDeltaPct)}>
              So {dateLabel.split(",")[0]} tuần trước: {formatDeltaPct(digest.vsSameWeekdayLastWeek.revenueDeltaPct)}
            </span>
          </div>
        </div>
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <div className="text-sm font-medium text-text-secondary mb-1">Số Đơn Hàng</div>
          <div className="text-3xl font-bold text-text-primary">{digest.today.orderCount} <span className="text-sm font-normal text-text-secondary">đơn</span></div>
          <div className="text-xs mt-2 space-x-3">
            <span className={deltaColorClass(digest.vsYesterday.orderCountDelta)}>
              So hôm qua: {digest.vsYesterday.orderCountDelta > 0 ? "+" : ""}{digest.vsYesterday.orderCountDelta}
            </span>
            <span className={deltaColorClass(digest.vsSameWeekdayLastWeek.orderCountDelta)}>
              So tuần trước: {digest.vsSameWeekdayLastWeek.orderCountDelta > 0 ? "+" : ""}{digest.vsSameWeekdayLastWeek.orderCountDelta}
            </span>
          </div>
        </div>
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <div className="text-sm font-medium text-text-secondary mb-1">Doanh Thu Trung Bình / Đơn</div>
          <div className="text-3xl font-bold text-text-primary">{formatNumber(Math.round(digest.today.avgOrderValue))}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
          <div className="p-5 border-b border-border bg-page">
            <h3 className="font-bold text-text-primary">Top 5 Món Bán Chạy</h3>
          </div>
          {digest.topItems.length === 0 ? (
            <EmptyState icon="📊" title="Chưa có đơn nào" description="Chưa có dữ liệu bán hàng trong ngày này." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-bold">Món</th>
                  <th className="px-6 py-3 font-bold text-right">Số lượng</th>
                  <th className="px-6 py-3 font-bold text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {digest.topItems.map(item => (
                  <tr key={item.product_id} className="hover:bg-page transition-colors">
                    <td className="px-6 py-3 font-medium text-text-primary">{item.name}</td>
                    <td className="px-6 py-3 text-right text-text-secondary">{item.totalQty}</td>
                    <td className="px-6 py-3 text-right text-success font-medium">{formatNumber(item.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
          <div className="p-5 border-b border-border bg-page">
            <h3 className="font-bold text-text-primary">Doanh Thu Theo Phương Thức Thanh Toán</h3>
          </div>
          {digest.paymentBreakdown.length === 0 ? (
            <EmptyState icon="💳" title="Chưa có dữ liệu" description="Chưa có đơn thanh toán trong ngày này." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-bold">Phương thức</th>
                  <th className="px-6 py-3 font-bold text-right">Số đơn</th>
                  <th className="px-6 py-3 font-bold text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {digest.paymentBreakdown.map(p => (
                  <tr key={p.method} className="hover:bg-page transition-colors">
                    <td className="px-6 py-3 font-medium text-text-primary">
                      {p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method}
                    </td>
                    <td className="px-6 py-3 text-right text-text-secondary">{p.orderCount}</td>
                    <td className="px-6 py-3 text-right text-success font-medium">{formatNumber(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border bg-page">
          <h3 className="font-bold text-text-primary">Cần Đặt Hàng Sớm</h3>
        </div>
        <div className="p-5 text-sm text-text-secondary">
          Tính năng này cần dữ liệu kiểm kê định kỳ để biết tốc độ tiêu thụ thật —
          hiện quán chưa có đợt kiểm kê nào, nên gợi ý đặt hàng đang tạm tắt. Sẽ
          hoạt động lại sau khi có đợt kiểm kê đầu tiên.
        </div>
      </div>
    </div>
  );
}
