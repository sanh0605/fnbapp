import { formatNumber } from "@/lib/shared/format";
import { formatVnDay } from "@/lib/shared/datetime";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableTotalRow,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";

export interface SalesByDayRow {
  label: string;
  amount: number;
}

export interface SalesByDaySectionProps {
  salesByDate: SalesByDayRow[];
  totalRevenue: number;
}

export function SalesByDaySection({ salesByDate, totalRevenue }: SalesByDaySectionProps) {
  return (
    <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
      <h3 className="font-bold text-text-primary text-lg mb-4">Doanh thu theo Ngày</h3>

      {/* Mobile Stacked Cards (< 768px) */}
      <div className="md:hidden space-y-3">
        {salesByDate.length === 0 ? (
          <div className="text-center py-4 text-text-muted text-sm">Không có dữ liệu</div>
        ) : (
          <>
            {salesByDate.map((d) => (
              <div
                key={d.label}
                className="bg-page rounded-xl p-4 border border-border flex justify-between items-baseline"
              >
                <span className="font-bold text-text-primary">{formatVnDay(d.label) || d.label}</span>
                <span className="font-bold text-text-primary">{formatNumber(d.amount)}</span>
              </div>
            ))}
            <div className="bg-primary-soft rounded-xl p-4 border border-border flex justify-between items-baseline font-bold text-text-primary">
              <span>Tổng cộng</span>
              <span>{formatNumber(totalRevenue)}</span>
            </div>
          </>
        )}
      </div>

      {/* Desktop Table (>= 768px) */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableHeaderCell>Ngày</TableHeaderCell>
            <TableHeaderCell>Doanh thu</TableHeaderCell>
          </TableHead>
          {salesByDate.length > 0 && (
            <TableTotalRow>
              <TableCell>Tổng cộng</TableCell>
              <TableCell align="right">{formatNumber(totalRevenue)}</TableCell>
            </TableTotalRow>
          )}
          <TableBody>
            {salesByDate.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2}>
                  <div className="text-center py-4 text-text-muted">Không có dữ liệu</div>
                </TableCell>
              </TableRow>
            ) : (
              salesByDate.map((d) => (
                <TableRow key={d.label}>
                  <TableCell>{formatVnDay(d.label) || d.label}</TableCell>
                  <TableCell align="right">{formatNumber(d.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
