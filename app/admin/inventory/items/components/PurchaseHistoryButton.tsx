"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatNumber } from "@/lib/format";
import { getPriceTrend, type ItemPurchaseHistoryRow } from "@/lib/item-purchase-history";
import { getItemPurchaseHistory } from "../actions";

export function PurchaseHistoryButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ItemPurchaseHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setIsOpen(true);
    if (rows !== null || loading) return;
    setLoading(true);
    setError(null);
    getItemPurchaseHistory(itemId)
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được lịch sử nhập hàng"))
      .finally(() => setLoading(false));
  }

  const trend = rows ? getPriceTrend(rows) : null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        Lịch sử nhập
      </Button>
      <FormModal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`Lịch sử nhập hàng: ${itemName}`} maxWidth="max-w-2xl">
        {loading && <p className="text-sm text-text-muted">Đang tải...</p>}
        {error && <Alert variant="danger">{error}</Alert>}
        {!loading && !error && rows && rows.length === 0 && (
          <p className="text-sm text-text-muted">Chưa có lần nhập hàng nào đã hoàn thành cho mặt hàng này.</p>
        )}
        {!loading && !error && rows && rows.length > 0 && (
          <div className="space-y-3">
            {trend && trend !== "same" && (
              <Alert variant={trend === "up" ? "warning" : "success"}>
                Giá nhập gần nhất {trend === "up" ? "tăng" : "giảm"} so với lần trước: {formatNumber(rows[1].unitCost)} → {formatNumber(rows[0].unitCost)}
              </Alert>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-3 py-2 font-bold">Ngày</th>
                    <th className="px-3 py-2 font-bold">Nhà cung cấp</th>
                    <th className="px-3 py-2 font-bold text-right">Số lượng</th>
                    <th className="px-3 py-2 font-bold text-right">Đơn giá</th>
                    <th className="px-3 py-2 font-bold text-right">Thành tiền</th>
                    <th className="px-3 py-2 font-bold text-right">Đơn nhập</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, idx) => (
                    <tr key={`${row.poId}-${idx}`}>
                      <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                        {row.date ? new Date(row.date).toLocaleDateString("vi-VN") : "---"}
                      </td>
                      <td className="px-3 py-2 font-medium text-text-primary">{row.supplierName}</td>
                      <td className="px-3 py-2 text-right text-text-primary">
                        {formatNumber(row.quantity)} {row.unitLabel}
                      </td>
                      <td className="px-3 py-2 text-right text-text-muted">{formatNumber(row.unitCost)}</td>
                      <td className="px-3 py-2 text-right font-bold text-text-primary">{formatNumber(row.lineTotal)}</td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={`/admin/inventory/purchase-orders/${row.poId}`}
                          className="text-primary hover:text-primary-hover font-mono text-[11px]"
                        >
                          {row.poId}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </FormModal>
    </>
  );
}
