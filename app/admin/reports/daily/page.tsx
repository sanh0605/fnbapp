import { getDailyDigest } from "./actions";
import { DailyDigestFilter } from "./DailyDigestFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { formatDecimal, formatNumber } from "@/lib/shared/format";
import { formatVnDayWithWeekday } from "@/lib/shared/datetime";

export const dynamic = "force-dynamic";

function formatDeltaPct(pct: number | null): string {
  if (pct === null) return "--";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${formatDecimal(pct, { minDigits: 1, maxDigits: 1 })}%`;
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
  const dateLabel = formatVnDayWithWeekday(digest.date);

  return (
    <div className="space-y-6">
      <DailyDigestFilter date={digest.date} />
      <p className="text-sm text-text-secondary -mt-4">{dateLabel}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <div className="text-sm font-medium text-text-secondary mb-1">Doanh thu trong ngày</div>
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
          <div className="text-sm font-medium text-text-secondary mb-1">Số đơn hàng</div>
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
          <div className="text-sm font-medium text-text-secondary mb-1">Doanh thu trung bình / đơn</div>
          <div className="text-3xl font-bold text-text-primary">{formatNumber(Math.round(digest.today.avgOrderValue))}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
          <div className="p-5 border-b border-border bg-page">
            <h3 className="font-bold text-text-primary">Top 5 món bán chạy</h3>
          </div>
          {digest.topItems.length === 0 ? (
            <EmptyState icon="📊" title="Chưa có đơn nào" description="Chưa có dữ liệu bán hàng trong ngày này." />
          ) : (
            <Table>
              <TableHead>
                <TableHeaderCell>Món</TableHeaderCell>
                <TableHeaderCell align="right">Số lượng</TableHeaderCell>
                <TableHeaderCell align="right">Doanh thu</TableHeaderCell>
              </TableHead>
              <TableBody>
                {digest.topItems.map(item => (
                  <TableRow key={item.product_id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right">{item.totalQty}</TableCell>
                    <TableCell align="right">{formatNumber(item.totalRevenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
          <div className="p-5 border-b border-border bg-page">
            <h3 className="font-bold text-text-primary">Doanh thu theo phương thức thanh toán</h3>
          </div>
          {digest.paymentBreakdown.length === 0 ? (
            <EmptyState icon="💳" title="Chưa có dữ liệu" description="Chưa có đơn thanh toán trong ngày này." />
          ) : (
            <Table>
              <TableHead>
                <TableHeaderCell>Phương thức</TableHeaderCell>
                <TableHeaderCell align="right">Số đơn</TableHeaderCell>
                <TableHeaderCell align="right">Doanh thu</TableHeaderCell>
              </TableHead>
              <TableBody>
                {digest.paymentBreakdown.map(p => (
                  <TableRow key={p.method}>
                    <TableCell>
                      {p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method}
                    </TableCell>
                    <TableCell align="right">{p.orderCount}</TableCell>
                    <TableCell align="right">{formatNumber(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border bg-page">
          <h3 className="font-bold text-text-primary">Cần đặt hàng sớm</h3>
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
