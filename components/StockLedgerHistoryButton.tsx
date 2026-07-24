"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatNumber } from "@/lib/format";
import { getTransactionTypeLabel } from "@/lib/stock-ledger-history";
import { getItemStockLedgerHistory, type StockLedgerHistoryRow } from "@/app/admin/reports/stock/actions";

export function StockLedgerHistoryButton({ itemId, itemName, unitName }: { itemId: string; itemName: string; unitName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rows, setRows] = useState<StockLedgerHistoryRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<{ value: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setIsOpen(true);
    if (rows !== null || loading) return;
    setLoading(true);
    setError(null);
    getItemStockLedgerHistory(itemId)
      .then(page => {
        setRows(page.rows);
        setNextCursor(page.nextCursor);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được lịch sử tồn kho"))
      .finally(() => setLoading(false));
  }

  function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    getItemStockLedgerHistory(itemId, nextCursor)
      .then(page => {
        setRows(prev => [...(prev || []), ...page.rows]);
        setNextCursor(page.nextCursor);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được lịch sử tồn kho"))
      .finally(() => setLoadingMore(false));
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        Lịch sử
      </Button>
      <FormModal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`Lịch sử tồn kho: ${itemName}`} maxWidth="max-w-2xl">
        {loading && <p className="text-sm text-text-muted">Đang tải...</p>}
        {error && <Alert variant="danger">{error}</Alert>}
        {!loading && !error && rows && rows.length === 0 && (
          <p className="text-sm text-text-muted">Chưa có biến động tồn kho nào cho mặt hàng này.</p>
        )}
        {!loading && !error && rows && rows.length > 0 && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-3 py-2 font-bold">Ngày</th>
                    <th className="px-3 py-2 font-bold">Loại biến động</th>
                    <th className="px-3 py-2 font-bold text-right">Thay đổi</th>
                    <th className="px-3 py-2 font-bold">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3 py-2 text-text-primary">{getTransactionTypeLabel(row.transactionType)}</td>
                      <td className={`px-3 py-2 text-right font-bold ${row.quantityChange < 0 ? "text-danger" : "text-success"}`}>
                        {row.quantityChange > 0 ? "+" : ""}
                        {formatNumber(row.quantityChange)} {unitName}
                      </td>
                      <td className="px-3 py-2 text-text-muted text-xs">{row.notes || row.referenceId || "---"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor && (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
                  Xem thêm
                </Button>
              </div>
            )}
          </div>
        )}
      </FormModal>
    </>
  );
}
