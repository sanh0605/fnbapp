import { formatNumber } from "@/lib/shared/format";
import { formatVnDay } from "@/lib/shared/datetime";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableTotalRow,
  TableBody,
  TableRow,
  TableRowHeader,
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

      <Table>
        <TableHead>
          <TableHeaderCell stick="left">Ngày</TableHeaderCell>
          <TableHeaderCell>Doanh thu</TableHeaderCell>
        </TableHead>
        {salesByDate.length > 0 && (
          <TableTotalRow>
            <TableCell stick="left">Tổng cộng</TableCell>
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
                <TableRowHeader stick="left">{formatVnDay(d.label) || d.label}</TableRowHeader>
                <TableCell align="right">{formatNumber(d.amount)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
