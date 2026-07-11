"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

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
      alert("Đồng bộ hoàn tất!");
    } catch (err: any) {
      setError(err.message);
      alert("Có lỗi xảy ra trong quá trình đồng bộ: " + err.message);
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
            <Link href="/admin/inventory/items" className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition min-h-[44px] flex items-center shadow-sm">
              Quay lại Kho
            </Link>
            <button
              onClick={handleScan}
              disabled={isScanning || isSyncing}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50 min-h-[44px] shadow-sm"
            >
              {isScanning ? "Đang quét..." : "Quét toàn bộ dữ liệu"}
            </button>
          </div>
        }
      />

      {error && (
        <div role="alert" aria-live="polite" className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {isSyncing && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Tiến trình đồng bộ</span>
            <span className="text-sm font-black text-indigo-600">{progress}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-[width] duration-500 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 italic">Đang cập nhật Stock Ledger theo từng gói 20 đơn hàng để đảm bảo an toàn...</p>
        </div>
      )}

      {!isScanning && scanComplete && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Kết quả kiểm tra</h3>
              <p className="text-sm text-gray-500">Phát hiện <span className="font-bold text-red-600">{discrepancies.length}</span> đơn hàng bị lệch tồn kho.</p>
            </div>
            {discrepancies.length > 0 && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                Đồng bộ ngay tất cả
              </button>
            )}
          </div>

          {discrepancies.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-gray-500 font-medium">Tuyệt vời! Toàn bộ tồn kho lịch sử đều đã khớp với công thức chuẩn.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[500px] hidden md:block">
                <table className="w-full text-left text-sm text-gray-600 border-collapse">
                  <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider font-bold sticky top-0 border-b border-gray-100 z-10">
                    <tr>
                      <th className="px-6 py-4">Mã đơn</th>
                      <th className="px-6 py-4">Ngày tạo</th>
                      <th className="px-6 py-4">Sự khác biệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {discrepancies.map((d, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-800">{d.order_no}</td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(d.created_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[11px] space-y-1">
                            {d.diffs.map(diff => (
                              <div key={diff.id} className="flex gap-2">
                                <span className="text-gray-500 font-medium min-w-[120px]">{diff.name}:</span>
                                <span className="text-rose-600 font-bold">{diff.actual}</span>
                                <span className="text-gray-300">→</span>
                                <span className="text-emerald-600 font-bold">{diff.expected}</span>
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
              <div className="md:hidden flex flex-col gap-3 p-4 bg-gray-50/30">
                {discrepancies.map((d, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-gray-900">Đơn: {d.order_no}</div>
                      <div className="text-[11px] text-gray-500">
                        {new Date(d.created_at).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <div className="text-xs space-y-2 mt-1">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Sự khác biệt:</div>
                      {d.diffs.map(diff => (
                        <div key={diff.id} className="flex flex-col bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <span className="font-semibold text-gray-700 mb-1">{diff.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-rose-600 font-bold">{diff.actual}</span>
                            <span className="text-gray-300">→</span>
                            <span className="text-emerald-600 font-bold">{diff.expected}</span>
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
