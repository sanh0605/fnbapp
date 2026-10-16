import { formatNumber } from "@/lib/shared/format";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableRowHeader,
  TableCell,
} from "@/components/ui/Table";

export interface PaymentBreakdownRow {
  method: string;
  paymentCount: number;
  revenue: number;
}

export interface PaymentBreakdownSectionProps {
  paymentBreakdown: PaymentBreakdownRow[];
  paymentOrderCount: number;
  totalRevenue: number;
  isCategoryFiltered?: boolean;
  title?: string;
}

export function PaymentBreakdownSection({
  paymentBreakdown,
  paymentOrderCount,
  totalRevenue,
  isCategoryFiltered,
  title = "Doanh thu theo phương thức thanh toán",
}: PaymentBreakdownSectionProps) {
  if (isCategoryFiltered) {
    return (
      <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
        <h3 className="font-bold text-text-primary text-base mb-2">{title}</h3>
        <p className="text-sm text-text-muted">
          Đang lọc theo nhóm món: phương thức thanh toán tính theo cả đơn nên tạm ẩn. Bỏ lọc nhóm món để xem.
        </p>
      </div>
    );
  }

  const totalPaymentCount = paymentBreakdown.reduce((sum, p) => sum + p.paymentCount, 0);

  return (
    <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
      <h3 className="font-bold text-text-primary text-base mb-3">{title}</h3>

      <Table>
        <TableHead>
          <TableHeaderCell stick="left">Phương thức</TableHeaderCell>
          <TableHeaderCell>Lượt thanh toán</TableHeaderCell>
          <TableHeaderCell>Doanh thu</TableHeaderCell>
        </TableHead>
        {paymentBreakdown.length > 0 && (
          <thead className="border-b border-border">
            <tr className="bg-primary-soft">
              <TableCell>Tổng cộng</TableCell>
              <TableCell align="right">
                {totalPaymentCount} lượt thanh toán của {paymentOrderCount} đơn
              </TableCell>
              <TableCell align="right">{formatNumber(totalRevenue)}</TableCell>
            </tr>
          </thead>
        )}
        <TableBody>
          {paymentBreakdown.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3}>
                <div className="text-center py-4 text-text-muted">Không có dữ liệu</div>
              </TableCell>
            </TableRow>
          ) : (
            paymentBreakdown.map((p) => {
              const label =
                p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method;
              return (
                <TableRow key={p.method}>
                  <TableRowHeader stick="left">{label}</TableRowHeader>
                  <TableCell align="right">{p.paymentCount}</TableCell>
                  <TableCell align="right">{formatNumber(p.revenue)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
