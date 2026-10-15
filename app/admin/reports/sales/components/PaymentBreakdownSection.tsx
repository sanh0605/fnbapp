import { formatNumber } from "@/lib/shared/format";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableTotalRow,
  TableBody,
  TableRow,
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

      {/* Mobile Stacked Cards (< 768px) */}
      <div className="md:hidden space-y-3">
        {paymentBreakdown.length === 0 ? (
          <div className="text-center py-4 text-text-muted text-sm">Không có dữ liệu</div>
        ) : (
          <>
            {paymentBreakdown.map((p) => {
              const label =
                p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method;
              return (
                <div
                  key={p.method}
                  className="bg-page rounded-xl p-4 border border-border flex flex-col gap-2"
                >
                  <div className="font-bold text-text-primary">{label}</div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-text-secondary">Lượt thanh toán</span>
                    <span className="font-semibold text-text-primary">{p.paymentCount}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-text-secondary">Doanh thu</span>
                    <span className="font-bold text-text-primary">{formatNumber(p.revenue)}</span>
                  </div>
                </div>
              );
            })}
            <div className="bg-primary-soft rounded-xl p-4 border border-border flex flex-col gap-2">
              <div className="font-bold text-text-primary">Tổng cộng</div>
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-text-secondary">Lượt thanh toán</span>
                <span className="font-semibold text-text-primary">
                  {totalPaymentCount} lượt thanh toán của {paymentOrderCount} đơn
                </span>
              </div>
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-text-secondary">Doanh thu</span>
                <span className="font-bold text-text-primary">{formatNumber(totalRevenue)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop Table (>= 768px) */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableHeaderCell>Phương thức</TableHeaderCell>
            <TableHeaderCell>Lượt thanh toán</TableHeaderCell>
            <TableHeaderCell>Doanh thu</TableHeaderCell>
          </TableHead>
          {paymentBreakdown.length > 0 && (
            <TableTotalRow>
              <TableCell>Tổng cộng</TableCell>
              <TableCell align="right">
                {totalPaymentCount} lượt thanh toán của {paymentOrderCount} đơn
              </TableCell>
              <TableCell align="right">{formatNumber(totalRevenue)}</TableCell>
            </TableTotalRow>
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
                    <TableCell>{label}</TableCell>
                    <TableCell align="right">{p.paymentCount}</TableCell>
                    <TableCell align="right">{formatNumber(p.revenue)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
