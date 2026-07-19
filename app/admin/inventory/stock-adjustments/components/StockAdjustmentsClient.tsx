"use client";

import { useState, useMemo, useTransition } from "react";
import { useUrlState } from "@/lib/use-url-state";
import { formatDateTime } from "@/lib/datetime";
import { approveStockAdjustment, rejectStockAdjustment } from "../../actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { alert, confirm } from "@/lib/dialog";

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

  const handleApprove = async (id: string) => {
    if (await confirm({ title: "Xác nhận", message: "Bạn có chắc chắn muốn DUYỆT phiếu điều chỉnh tồn kho này?", variant: "warning" })) {
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

  const handleReject = async (id: string) => {
    if (await confirm({ title: "Xác nhận xóa", message: "Bạn có chắc chắn muốn TỪ CHỐI phiếu điều chỉnh tồn kho này?", variant: "danger" })) {
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
      <PageHeader 
        title="Điều chỉnh Tồn kho" 
        subtitle="Quản lý và phê duyệt các yêu cầu điều chỉnh số lượng tồn kho thực tế."
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Tìm kiếm
          </label>
          <input
            type="text"
            placeholder="Mã phiếu, tên món, lý do..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 border border-border rounded-lg px-3 py-3 md:py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Trạng thái
          </label>
          <div className="flex flex-wrap md:flex-nowrap gap-1 bg-surface-secondary rounded-lg p-0.5 border border-border">
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
                      ? "bg-surface-card text-primary-active shadow-sm border-border"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      
      </div>

      {/* Notifications */}
      {successMsg && (
        <div role="status" aria-live="polite" className="bg-success/10 border border-success/30 text-success-active px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span>✔️ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-success hover:text-success-active" aria-label="Đóng thông báo">✕</button>
        </div>
      )}
      {errorMsg && (
        <div role="alert" aria-live="polite" className="bg-danger/10 border border-danger/30 text-danger-active px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-danger hover:text-danger-active" aria-label="Đóng thông báo">✕</button>
        </div>
      )}

      {/* Main Content List */}
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Desktop Table Layout */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
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
            <tbody className="divide-y divide-border">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-0">
                    <EmptyState 
                      icon="📋" 
                      title="Chưa có phiếu điều chỉnh" 
                      description="Tạo phiếu điều chỉnh để cân bằng kho thực tế."
                    />
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((adj) => {
                  const diffColor =
                    adj.difference > 0
                      ? "text-success font-bold"
                      : adj.difference < 0
                      ? "text-danger font-bold"
                      : "text-text-muted";
                  
                  return (
                    <tr key={adj.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-[11px] text-text-muted">
                        {adj.id}
                      </td>
                      <td className="px-6 py-4 text-text-secondary whitespace-nowrap">
                        {formatDateTime(adj.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-text-primary">{adj.item_name}</div>
                        <div className="text-[10px] text-text-muted font-mono">{adj.item_reference}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-text-secondary">
                        {adj.theoretical_qty} {adj.unitName}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-text-primary">
                        {adj.actual_qty} {adj.unitName}
                      </td>
                      <td className={`px-6 py-4 text-center font-bold ${diffColor}`}>
                        {adj.difference > 0 ? `+${adj.difference}` : adj.difference} {adj.unitName}
                      </td>
                      <td className="px-6 py-4 text-text-secondary max-w-xs truncate" title={adj.reason}>
                        {adj.reason}
                      </td>
                      <td className="px-6 py-4 text-text-secondary font-medium whitespace-nowrap">
                        {adj.created_by_name}
                      </td>
                      <td className="px-6 py-4">
                        {adj.status === "PENDING" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-warning/10 text-warning-active border border-warning/30">
                            Chờ duyệt
                          </span>
                        )}
                        {adj.status === "APPROVED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-success/10 text-success-active border border-success/30" title={`Duyệt bởi: ${adj.approved_by || ""}`}>
                            Đã duyệt
                          </span>
                        )}
                        {adj.status === "REJECTED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-danger/10 text-danger-active border border-danger/30">
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
                              className="px-3 py-1.5 rounded-lg bg-success text-white hover:bg-success-hover active:scale-95 transition-colors transition-transform text-xs font-bold min-h-[38px] flex items-center justify-center shadow-sm disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              disabled={isPendingAction}
                              onClick={() => handleReject(adj.id)}
                              className="px-3 py-1.5 rounded-lg bg-danger/10 text-danger-active hover:bg-danger/20 active:scale-95 transition-colors transition-transform text-xs font-bold min-h-[38px] flex items-center justify-center border border-danger/30 disabled:opacity-50"
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
        <div className="md:hidden flex flex-col gap-3 p-4 bg-surface-secondary/30">
          {filteredAdjustments.length === 0 ? (
            <EmptyState 
              icon="📋" 
              title="Chưa có phiếu điều chỉnh" 
              description="Tạo phiếu điều chỉnh để cân bằng kho thực tế."
            />
          ) : (
            filteredAdjustments.map((adj) => {
              const diffColor =
                adj.difference > 0
                  ? "text-success"
                  : adj.difference < 0
                  ? "text-danger"
                  : "text-text-muted";
              return (
                <div
                  key={adj.id}
                  className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-text-primary text-sm">
                        {adj.item_name}
                      </div>
                      <div className="text-[10px] font-mono text-text-muted mt-0.5">
                        Mã: {adj.id} • {formatDateTime(adj.created_at)}
                      </div>
                    </div>
                    <div>
                      {adj.status === "PENDING" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-warning/10 text-warning-active border border-warning/30">
                          Chờ duyệt
                        </span>
                      )}
                      {adj.status === "APPROVED" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success-active border border-success/30">
                          Đã duyệt
                        </span>
                      )}
                      {adj.status === "REJECTED" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-danger/10 text-danger-active border border-danger/30">
                          Từ chối
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-surface-secondary p-2.5 rounded-lg border border-border text-center text-xs">
                    <div>
                      <div className="text-text-muted text-[10px] uppercase font-bold">Lý Thuyết</div>
                      <div className="font-semibold text-text-secondary mt-0.5">
                        {adj.theoretical_qty} {adj.unitName}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-muted text-[10px] uppercase font-bold">Thực Tế</div>
                      <div className="font-bold text-text-primary mt-0.5">
                        {adj.actual_qty} {adj.unitName}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-muted text-[10px] uppercase font-bold">Chênh Lệch</div>
                      <div className={`font-black ${diffColor} mt-0.5`}>
                        {adj.difference > 0 ? `+${adj.difference}` : adj.difference} {adj.unitName}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="text-text-secondary">
                      <span className="text-text-muted">Lý do:</span> <span className="font-medium">{adj.reason}</span>
                    </p>
                    <p className="text-text-secondary">
                      <span className="text-text-muted">Người tạo:</span>{" "}
                      <span className="font-medium">{adj.created_by_name}</span>
                    </p>
                    {adj.approved_by && (
                      <p className="text-text-secondary">
                        <span className="text-text-muted">Người duyệt:</span>{" "}
                        <span className="font-medium">{adj.approved_by}</span>
                      </p>
                    )}
                  </div>

                  {adj.status === "PENDING" && (
                    <div className="flex gap-2 pt-3 border-t border-border mt-1">
                      <button
                        disabled={isPendingAction}
                        onClick={() => handleApprove(adj.id)}
                        className="flex-1 bg-success text-white font-bold py-3 rounded-lg text-xs hover:bg-success-hover transition active:scale-95 min-h-[44px] flex items-center justify-center shadow-sm disabled:opacity-50"
                      >
                        Duyệt
                      </button>
                      <button
                        disabled={isPendingAction}
                        onClick={() => handleReject(adj.id)}
                        className="flex-1 bg-danger/10 text-danger-active font-bold py-3 rounded-lg text-xs hover:bg-danger/20 transition active:scale-95 border border-danger/30 min-h-[44px] flex items-center justify-center disabled:opacity-50"
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
