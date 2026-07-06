"use client";

import { useState, useMemo, useTransition } from "react";
import { useUrlState } from "@/lib/use-url-state";
import StickyFilterBar from "@/components/StickyFilterBar";
import { formatDateTime } from "@/lib/datetime";
import { approveStockAdjustment, rejectStockAdjustment } from "../../actions";

interface StockAdjustment {
  id: string;
  item_reference: string;
  item_name: string;
  unitName: string;
  theoretical_qty: number;
  actual_qty: number;
  difference: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_by_name: string;
  created_by_id: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

interface StockAdjustmentsClientProps {
  adjustments: StockAdjustment[];
}

export default function StockAdjustmentsClient({ adjustments }: StockAdjustmentsClientProps) {
  const [statusFilter, setStatusFilter] = useUrlState<string>("status", "PENDING");
  const [searchQuery, setSearchQuery] = useUrlState<string>("q", "");
  const [isPendingAction, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      const matchStatus = statusFilter === "ALL" || adj.status === statusFilter;
      const matchSearch =
        adj.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.created_by_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adj.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [adjustments, statusFilter, searchQuery]);

  const handleApprove = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn DUYỆT phiếu điều chỉnh tồn kho này?")) {
      setErrorMsg(null);
      setSuccessMsg(null);
      startTransition(async () => {
        const res = await approveStockAdjustment(id);
        if (res.success) {
          setSuccessMsg("Duyệt phiếu điều chỉnh thành công!");
        } else {
          setErrorMsg(res.error || "Có lỗi xảy ra khi duyệt phiếu.");
        }
      });
    }
  };

  const handleReject = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn TỪ CHỐI phiếu điều chỉnh tồn kho này?")) {
      setErrorMsg(null);
      setSuccessMsg(null);
      startTransition(async () => {
        const res = await rejectStockAdjustment(id);
        if (res.success) {
          setSuccessMsg("Đã từ chối phiếu điều chỉnh.");
        } else {
          setErrorMsg(res.error || "Có lỗi xảy ra khi từ chối phiếu.");
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <StickyFilterBar
        title="Điều chỉnh Tồn kho"
        subtitle="Quản lý và phê duyệt các yêu cầu điều chỉnh số lượng tồn kho thực tế."
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Tìm kiếm
          </label>
          <input
            type="text"
            placeholder="Mã phiếu, tên món, lý do..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Trạng thái
          </label>
          <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
            {["PENDING", "APPROVED", "REJECTED", "ALL"].map((tab) => {
              const label =
                tab === "PENDING"
                  ? "Chờ duyệt"
                  : tab === "APPROVED"
                  ? "Đã duyệt"
                  : tab === "REJECTED"
                  ? "Từ chối"
                  : "Tất cả";
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors min-h-[32px] ${
                    statusFilter === tab
                      ? "bg-white text-blue-700 shadow-sm border-gray-200"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </StickyFilterBar>

      {/* Notifications */}
      {successMsg && (
        <div role="status" aria-live="polite" className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span>✔️ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}
      {errorMsg && (
        <div role="alert" aria-live="polite" className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* Main Content List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table Layout */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">Mã Phiếu</th>
                <th className="px-6 py-4 font-bold">Thời Gian</th>
                <th className="px-6 py-4 font-bold">Món / Nguyên Liệu</th>
                <th className="px-6 py-4 font-bold text-center">Tồn Lý Thuyết</th>
                <th className="px-6 py-4 font-bold text-center">Thực Tế</th>
                <th className="px-6 py-4 font-bold text-center">Chênh Lệch</th>
                <th className="px-6 py-4 font-bold">Lý Do</th>
                <th className="px-6 py-4 font-bold">Người Tạo</th>
                <th className="px-6 py-4 font-bold">Trạng Thái</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500 italic">
                    Không tìm thấy phiếu điều chỉnh nào.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((adj) => {
                  const diffColor =
                    adj.difference > 0
                      ? "text-emerald-600 font-bold"
                      : adj.difference < 0
                      ? "text-rose-600 font-bold"
                      : "text-gray-500";
                  
                  return (
                    <tr key={adj.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-[11px] text-gray-400">
                        {adj.id}
                      </td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {formatDateTime(adj.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{adj.item_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{adj.item_reference}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-gray-700">
                        {adj.theoretical_qty} {adj.unitName}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-900">
                        {adj.actual_qty} {adj.unitName}
                      </td>
                      <td className={`px-6 py-4 text-center font-bold ${diffColor}`}>
                        {adj.difference > 0 ? `+${adj.difference}` : adj.difference} {adj.unitName}
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={adj.reason}>
                        {adj.reason}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium whitespace-nowrap">
                        {adj.created_by_name}
                      </td>
                      <td className="px-6 py-4">
                        {adj.status === "PENDING" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Chờ duyệt
                          </span>
                        )}
                        {adj.status === "APPROVED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Duyệt bởi: ${adj.approved_by || ""}`}>
                            Đã duyệt
                          </span>
                        )}
                        {adj.status === "REJECTED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Từ chối
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {adj.status === "PENDING" && (
                          <div className="flex justify-end gap-2">
                            <button
                              disabled={isPendingAction}
                              onClick={() => handleApprove(adj.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-colors transition-transform text-xs font-bold min-h-[38px] flex items-center justify-center shadow-sm disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              disabled={isPendingAction}
                              onClick={() => handleReject(adj.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95 transition-colors transition-transform text-xs font-bold min-h-[38px] flex items-center justify-center border border-rose-200 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-gray-50/40">
          {filteredAdjustments.length === 0 ? (
            <div className="text-center text-gray-500 italic py-8">
              Không tìm thấy phiếu điều chỉnh nào.
            </div>
          ) : (
            filteredAdjustments.map((adj) => {
              const diffColor =
                adj.difference > 0
                  ? "text-emerald-600"
                  : adj.difference < 0
                  ? "text-rose-600"
                  : "text-gray-500";
              return (
                <div
                  key={adj.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-gray-900 text-sm">
                        {adj.item_name}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                        Mã: {adj.id} • {formatDateTime(adj.created_at)}
                      </div>
                    </div>
                    <div>
                      {adj.status === "PENDING" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Chờ duyệt
                        </span>
                      )}
                      {adj.status === "APPROVED" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Đã duyệt
                        </span>
                      )}
                      {adj.status === "REJECTED" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Từ chối
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-center text-xs">
                    <div>
                      <div className="text-gray-400 text-[10px] uppercase font-bold">Lý Thuyết</div>
                      <div className="font-semibold text-gray-700 mt-0.5">
                        {adj.theoretical_qty} {adj.unitName}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-[10px] uppercase font-bold">Thực Tế</div>
                      <div className="font-bold text-gray-900 mt-0.5">
                        {adj.actual_qty} {adj.unitName}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-[10px] uppercase font-bold">Chênh Lệch</div>
                      <div className={`font-black ${diffColor} mt-0.5`}>
                        {adj.difference > 0 ? `+${adj.difference}` : adj.difference} {adj.unitName}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="text-gray-600">
                      <span className="text-gray-400">Lý do:</span> <span className="font-medium">{adj.reason}</span>
                    </p>
                    <p className="text-gray-600">
                      <span className="text-gray-400">Người tạo:</span>{" "}
                      <span className="font-medium">{adj.created_by_name}</span>
                    </p>
                    {adj.approved_by && (
                      <p className="text-gray-600">
                        <span className="text-gray-400">Người duyệt:</span>{" "}
                        <span className="font-medium">{adj.approved_by}</span>
                      </p>
                    )}
                  </div>

                  {adj.status === "PENDING" && (
                    <div className="flex gap-2 pt-3 border-t border-gray-100/50 mt-1">
                      <button
                        disabled={isPendingAction}
                        onClick={() => handleApprove(adj.id)}
                        className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-lg text-xs hover:bg-emerald-700 transition active:scale-95 min-h-[44px] flex items-center justify-center shadow-sm disabled:opacity-50"
                      >
                        Duyệt
                      </button>
                      <button
                        disabled={isPendingAction}
                        onClick={() => handleReject(adj.id)}
                        className="flex-1 bg-rose-50 text-rose-700 font-bold py-3 rounded-lg text-xs hover:bg-rose-100 transition active:scale-95 border border-rose-200 min-h-[44px] flex items-center justify-center disabled:opacity-50"
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
