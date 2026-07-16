"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { alert } from "@/lib/dialog";

interface Discrepancy {
  order_id: string;
  order_no: string;
  created_at: string;
  diffs: {
    id: string;
    name: string;
    expected: number;
    actual: number;
  }[];
}

export default function SyncPage() {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    setScanComplete(false);
    try {
      const res = await fetch("/api/inventory/sync/scan");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDiscrepancies(data.discrepancies);
      setScanComplete(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSync = async () => {
    if (discrepancies.length === 0) return;
    setIsSyncing(true);
    setError(null);
    setProgress(0);

    const orderIds = discrepancies.map(d => d.order_id);
    const CHUNK_SIZE = 20;
    let completedCount = 0;

    try {
      for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
        const chunk = orderIds.slice(i, i + CHUNK_SIZE);
        const res = await fetch("/api/inventory/sync/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: chunk }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        completedCount += chunk.length;
        setProgress(Math.round((completedCount / orderIds.length) * 100));
      }
      
      // Clear discrepancies after success
      setDiscrepancies([]);
      await alert({ title: "Thành công", message: "Đồng bộ hoàn tất!", variant: "info" });
    } catch (err: any) {
      setError(err.message);
      await alert({ title: "Lỗi đồng bộ", message: "Có lỗi xảy ra trong quá trình đồng bộ: " + err.message, variant: "danger" });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Đồng bộ Tồn kho Lịch sử" 
        subtitle="Đối chiếu Stock Ledger với Công thức (Recipes) để sửa lỗi lệch kho do cập nhật trễ."
        actions={
          <div className="flex gap-3">
            <Link href="/admin/inventory/items" className="px-4 py-2 bg-surface-card border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-secondary transition min-h-[44px] flex items-center shadow-sm">
              Quay lại Kho
            </Link>
            <button
              onClick={handleScan}
              disabled={isScanning || isSyncing}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition disabled:opacity-50 min-h-[44px] shadow-sm"
            >
              {isScanning ? "Đang quét..." : "Quét toàn bộ dữ liệu"}
            </button>
          </div>
        }
      />

      {error && (
        <div role="alert" aria-live="polite" className="bg-danger/10 border border-danger/30 text-danger-active px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {isSyncing && (
        <div className="bg-surface-card p-6 rounded-2xl shadow-sm border border-border space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">Tiến trình đồng bộ</span>
            <span className="text-sm font-black text-primary">{progress}%</span>
          </div>
          <div className="w-full h-3 bg-surface-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-[width] duration-500 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-text-muted italic">Đang cập nhật Stock Ledger theo từng gói 20 đơn hàng để đảm bảo an toàn...</p>
        </div>
      )}

      {!isScanning && scanComplete && (
        <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Kết quả kiểm tra</h3>
              <p className="text-sm text-text-muted">Phát hiện <span className="font-bold text-danger">{discrepancies.length}</span> đơn hàng bị lệch tồn kho.</p>
            </div>
            {discrepancies.length > 0 && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-6 py-2.5 bg-success text-white rounded-xl text-sm font-bold hover:bg-success-hover transition shadow-lg shadow-sm disabled:opacity-50"
              >
                Đồng bộ ngay tất cả
              </button>
            )}
          </div>

          {discrepancies.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-text-muted font-medium">Tuyệt vời! Toàn bộ tồn kho lịch sử đều đã khớp với công thức chuẩn.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[500px] hidden md:block">
                <table className="w-full text-left text-sm text-text-secondary border-collapse">
                  <thead className="bg-surface-secondary text-text-muted text-[11px] uppercase tracking-wider font-bold sticky top-0 border-b border-border z-10">
                    <tr>
                      <th className="px-6 py-4">Mã đơn</th>
                      <th className="px-6 py-4">Ngày tạo</th>
                      <th className="px-6 py-4">Sự khác biệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {discrepancies.map((d, idx) => (
                      <tr key={idx} className="hover:bg-surface-secondary/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-text-primary">{d.order_no}</td>
                        <td className="px-6 py-4 text-text-muted">
                          {new Date(d.created_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[11px] space-y-1">
                            {d.diffs.map(diff => (
                              <div key={diff.id} className="flex gap-2">
                                <span className="text-text-muted font-medium min-w-[120px]">{diff.name}:</span>
                                <span className="text-danger font-bold">{diff.actual}</span>
                                <span className="text-text-muted">→</span>
                                <span className="text-success font-bold">{diff.expected}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout (< 768px) */}
              <div className="md:hidden flex flex-col gap-3 p-4 bg-surface-secondary/30">
                {discrepancies.map((d, idx) => (
                  <div key={idx} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-text-primary">Đơn: {d.order_no}</div>
                      <div className="text-[11px] text-text-muted">
                        {new Date(d.created_at).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <div className="text-xs space-y-2 mt-1">
                      <div className="text-[10px] uppercase font-bold text-text-muted">Sự khác biệt:</div>
                      {d.diffs.map(diff => (
                        <div key={diff.id} className="flex flex-col bg-surface-secondary p-2 rounded-lg border border-border">
                          <span className="font-semibold text-text-secondary mb-1">{diff.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-danger font-bold">{diff.actual}</span>
                            <span className="text-text-muted">→</span>
                            <span className="text-success font-bold">{diff.expected}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
