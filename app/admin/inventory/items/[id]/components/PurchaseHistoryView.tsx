import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { formatNumber } from "@/lib/shared/format";
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
      <div className="bg-surface-card rounded-2xl border border-border overflow-hidden hidden md:block shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-4 py-3 font-bold">Ngày</th>
                <th className="px-4 py-3 font-bold">Nhà cung cấp</th>
                <th className="px-4 py-3 font-bold text-right">Số lượng</th>
                <th className="px-4 py-3 font-bold text-right">Đơn giá</th>
                <th className="px-4 py-3 font-bold text-right">Thành tiền</th>
                <th className="px-4 py-3 font-bold text-right">Đơn nhập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, idx) => (
                <tr key={`${row.poId}-${idx}`} className="hover:bg-page transition-colors">
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {row.date ? new Date(row.date).toLocaleDateString("vi-VN") : "---"}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">{row.supplierName}</td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {formatNumber(row.quantity)} {row.unitLabel}
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted">{formatNumber(row.unitCost)}</td>
                  <td className="px-4 py-3 text-right font-bold text-text-primary">{formatNumber(row.lineTotal)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/inventory/purchase-orders/${row.poId}`}
                      className="text-primary hover:text-primary-hover font-mono text-[11px]"
                    >
                      {row.poId}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: Card layout (< 768px) */}
      <div className="md:hidden flex flex-col gap-3">
        {rows.map((row, idx) => (
          <div key={`${row.poId}-${idx}`} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">
                {row.date ? new Date(row.date).toLocaleDateString("vi-VN") : "---"}
              </span>
              <Link
                href={`/admin/inventory/purchase-orders/${row.poId}`}
                className="text-primary hover:text-primary-hover font-mono text-xs font-semibold"
              >
                {row.poId}
              </Link>
            </div>
            <div className="font-medium text-text-primary">{row.supplierName}</div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <div className="text-text-muted uppercase text-[10px]">Số lượng</div>
                <div className="text-text-primary font-medium mt-0.5">
                  {formatNumber(row.quantity)} {row.unitLabel}
                </div>
              </div>
              <div className="text-right">
                <div className="text-text-muted uppercase text-[10px]">Đơn giá</div>
                <div className="text-text-muted mt-0.5">{formatNumber(row.unitCost)}</div>
              </div>
              <div className="text-right">
                <div className="text-text-muted uppercase text-[10px]">Thành tiền</div>
                <div className="text-text-primary font-bold mt-0.5">{formatNumber(row.lineTotal)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
