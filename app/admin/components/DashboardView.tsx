import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull, formatVnDayWithWeekday } from "@/lib/shared/datetime";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableRowHeader,
  TableCell,
} from "@/components/ui/Table";
import type { DashboardData } from "@/lib/dashboard/dashboard-data";

function formatMonth(monthIso: string): string {
  const parts = monthIso.split("-");
  if (parts.length === 2) {
    return `${parts[1]}/${parts[0]}`;
  }
  return monthIso;
}

export function DashboardView({ data }: { data: DashboardData }) {
  const hasAlerts =
    (data.negativeStock && data.negativeStock.length > 0) ||
    Boolean(data.stocktake && data.stocktake.stale !== null) ||
    Boolean(data.stocktake && data.stocktake.openTooLong && data.stocktake.openTooLong.length > 0) ||
    (data.reminders && data.reminders.length > 0);

  const hasTopping = data.toppingColumnName !== null;
  const sortedRows = [...(data.table || [])].sort((a, b) => b.day.localeCompare(a.day));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Cần xử lý</h2>
        {!hasAlerts ? (
          <div className="text-sm text-text-muted">Không có gì cần xử lý</div>
        ) : (
          <div className="space-y-2">
            {data.negativeStock && data.negativeStock.length > 0 && (
              <Link
                href="/admin/inventory/items"
                className="block p-3 rounded-card border border-warning/30 bg-warning/10 text-text-primary hover:bg-warning/15 transition-colors"
              >
                <div>Hàng trên sổ bị âm</div>
                <div className="text-sm text-text-secondary mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {data.negativeStock.map((item) => (
                    <span key={item.id}>
                      {item.name}: {formatNumber(item.qty)}
                    </span>
                  ))}
                </div>
              </Link>
            )}

            {data.stocktake?.stale !== null && data.stocktake?.stale !== undefined && (
              <Link
                href="/admin/inventory/stocktake"
                className="block p-3 rounded-card border border-warning/30 bg-warning/10 text-text-primary hover:bg-warning/15 transition-colors"
              >
                <div>
                  {data.stocktake.stale.lastConfirmedDay
                    ? `${data.stocktake.stale.daysSince} ngày chưa kiểm kê (lần cuối ${formatDateTimeFull(data.stocktake.stale.lastConfirmedAt)})`
                    : "Chưa kiểm kê lần nào"}
                </div>
              </Link>
            )}

            {data.stocktake?.openTooLong?.map((session) => (
              <Link
                key={session.id}
                href="/admin/inventory/stocktake"
                className="block p-3 rounded-card border border-warning/30 bg-warning/10 text-text-primary hover:bg-warning/15 transition-colors"
              >
                <div>
                  Phiếu kiểm kê mở từ {formatDateTimeFull(session.openedAt)}, đã {session.daysOpen} ngày chưa xác nhận
                </div>
              </Link>
            ))}

            {data.reminders?.map((reminder) => (
              <div
                key={`${reminder.itemId}-${reminder.month}`}
                className="flex items-center justify-between p-3 rounded-card border border-warning/30 bg-warning/10 text-text-primary"
              >
                <span>
                  Chưa nhập {reminder.itemName} tháng {formatMonth(reminder.month)}
                </span>
                <Button
                  href={`/admin/finance/new?monthlyItem=${encodeURIComponent(reminder.itemId)}&month=${encodeURIComponent(reminder.month)}&returnTo=%2Fadmin`}
                  className="shrink-0 ml-3"
                >
                  Nhập
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Bán hàng 7 ngày</h2>
        <Table>
          <TableHead>
            <TableHeaderCell stick="left">Ngày</TableHeaderCell>
            <TableHeaderCell>Doanh thu</TableHeaderCell>
            <TableHeaderCell>TB mỗi ly</TableHeaderCell>
            <TableHeaderCell>Số ly</TableHeaderCell>
            {data.foodColumns.map((fc) => (
              <TableHeaderCell key={fc.id}>{fc.name}</TableHeaderCell>
            ))}
            {hasTopping && <TableHeaderCell>Topping mua riêng</TableHeaderCell>}
          </TableHead>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.day}>
                <TableRowHeader stick="left">{formatVnDayWithWeekday(row.day)}</TableRowHeader>
                <TableCell align="right">{formatNumber(row.revenue)}</TableCell>
                <TableCell align="right">{formatNumber(row.avgPerCup)}</TableCell>
                <TableCell align="right">{row.cups}</TableCell>
                {data.foodColumns.map((fc) => (
                  <TableCell key={fc.id} align="right">
                    {row.foodQty[fc.id] ?? 0}
                  </TableCell>
                ))}
                {hasTopping && (
                  <TableCell align="right">{row.toppingQty ?? 0}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
