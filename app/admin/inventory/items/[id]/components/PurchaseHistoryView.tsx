import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { getPriceTrend, type ItemPurchaseHistoryRow } from "@/lib/purchasing/item-purchase-history";

interface PurchaseHistoryViewProps {
  rows: ItemPurchaseHistoryRow[];
  itemName: string;
}

export function PurchaseHistoryView({ rows, itemName }: PurchaseHistoryViewProps) {
  const trend = getPriceTrend(rows);

  if (rows.length === 0) {
    return (
      <div className="bg-surface-card rounded-2xl border border-border p-6">
        <p className="text-sm text-text-muted">Chưa có lần nhập hàng nào đã hoàn thành cho mặt hàng này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trend && trend !== "same" && (
        <Alert variant={trend === "up" ? "warning" : "success"}>
          Giá nhập gần nhất {trend === "up" ? "tăng" : "giảm"} so với lần trước: {formatNumber(rows[1].unitCost)} → {formatNumber(rows[0].unitCost)}
        </Alert>
      )}

      {/* Desktop: Table layout */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableHeaderCell>Ngày</TableHeaderCell>
            <TableHeaderCell>Nhà cung cấp</TableHeaderCell>
            <TableHeaderCell>Số lượng</TableHeaderCell>
            <TableHeaderCell>Đơn giá</TableHeaderCell>
            <TableHeaderCell>Thành tiền</TableHeaderCell>
            <TableHeaderCell>Đơn nhập</TableHeaderCell>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={`${row.poId}-${idx}`}>
                <TableCell>
                  <span className="whitespace-nowrap text-text-secondary">
                    {row.date ? formatDateTimeFull(row.date) : "---"}
                  </span>
                </TableCell>
                <TableCell>{row.supplierName}</TableCell>
                <TableCell align="right">
                  {formatNumber(row.quantity)} {row.unitLabel}
                </TableCell>
                <TableCell align="right">
                  <span className="text-text-muted">{formatNumber(row.unitCost)}</span>
                </TableCell>
                <TableCell align="right">
                  {formatNumber(row.lineTotal)}
                </TableCell>
                <TableCell align="right">
                  <Link
                    href={`/admin/inventory/purchase-orders/${row.poId}`}
                    className="text-primary hover:text-primary-hover font-mono text-xs"
                  >
                    {row.poId}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Card layout (< 768px) */}
      <div className="md:hidden flex flex-col gap-3">
        {rows.map((row, idx) => (
          <div key={`${row.poId}-${idx}`} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">
                {row.date ? formatDateTimeFull(row.date) : "---"}
              </span>
              <Link
                href={`/admin/inventory/purchase-orders/${row.poId}`}
                className="text-primary hover:text-primary-hover font-mono text-xs"
              >
                {row.poId}
              </Link>
            </div>
            <div className="text-text-primary">{row.supplierName}</div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <div className="text-text-muted text-xs">Số lượng</div>
                <div className="text-text-primary tabular-nums mt-0.5">
                  {formatNumber(row.quantity)} {row.unitLabel}
                </div>
              </div>
              <div className="text-right">
                <div className="text-text-muted text-xs">Đơn giá</div>
                <div className="text-text-muted tabular-nums mt-0.5">{formatNumber(row.unitCost)}</div>
              </div>
              <div className="text-right">
                <div className="text-text-muted text-xs">Thành tiền</div>
                <div className="text-text-primary tabular-nums mt-0.5">{formatNumber(row.lineTotal)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
