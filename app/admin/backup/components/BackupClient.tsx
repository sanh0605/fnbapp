"use client";

import { useState, useTransition } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { formatDateTime } from "@/lib/datetime";
import { triggerBackup } from "../actions";

interface BackupClientProps {
  lastSyncedAt: string | null;
  notes: string | null;
  updatedAt: string | null;
}

export default function BackupClient({ lastSyncedAt, notes, updatedAt }: BackupClientProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleManualTrigger = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await triggerBackup();
      if (res.success) {
        setSuccessMsg(res.message || "Đã kích hoạt sao lưu dữ liệu lên Google Sheets thành công!");
      } else {
        setErrorMsg(res.error || "Lỗi khi kích hoạt sao lưu.");
      }
    });
  };

  // Determine status (success/failure/never)
  let status: "success" | "failure" | "never" = "never";
  let statusLabel = "Chưa có sao lưu";
  let statusColor = "bg-gray-100 text-gray-700 border-gray-200";

  if (lastSyncedAt) {
    if (notes && (notes.toLowerCase().includes("error") || notes.toLowerCase().includes("fail"))) {
      status = "failure";
      statusLabel = "Thất bại";
      statusColor = "bg-rose-50 text-rose-700 border-rose-200";
    } else {
      status = "success";
      statusLabel = "Hoạt động";
      statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  }

  const edgeFunctionUrl = "https://zicuawpwyhmtqmzawvau.functions.supabase.co/backup-to-sheets";

  return (
    <div className="space-y-6">
      <StickyFilterBar
        title="Sao lưu & Đồng bộ"
        subtitle="Quản lý đồng bộ dữ liệu tự động và thủ công từ Supabase lên Google Sheets."
      >
        <div />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Status Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
            <h3 className="font-extrabold text-gray-900 text-base border-b border-gray-50 pb-3 flex items-center gap-2">
              <span>📊</span> Trạng thái đồng bộ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái</span>
                <div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${statusColor}`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      status === "success" ? "bg-emerald-500 animate-pulse" : status === "failure" ? "bg-rose-500" : "bg-gray-400"
                    }`} />
                    {statusLabel}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mục tiêu đồng bộ</span>
                <p className="text-sm font-bold text-gray-800 font-mono">Orders_V2 ➔ Google Sheets</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lần đồng bộ cuối</span>
                <p className="text-sm font-bold text-gray-800">
                  {lastSyncedAt ? formatDateTime(lastSyncedAt) : "Chưa từng thực hiện"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cập nhật lúc</span>
                <p className="text-sm font-medium text-gray-600">
                  {updatedAt ? formatDateTime(updatedAt) : "---"}
                </p>
              </div>
            </div>

            {notes && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nhật ký chi tiết</span>
                <p className="text-xs text-gray-600 font-mono break-all leading-relaxed">{notes}</p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kích hoạt thủ công</span>
                <p className="text-xs text-gray-500">Đồng bộ tức thời dữ liệu hiện tại lên Google Sheets.</p>
              </div>
              <button
                disabled={isPending}
                onClick={handleManualTrigger}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-extrabold text-sm hover:bg-blue-700 active:scale-95 transition-colors transition-transform shadow-md min-h-[44px] disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>ĐANG ĐỒNG BỘ...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span> Kích hoạt Ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right column - Configurations & Info */}
        <div className="space-y-6">
          {/* Edge Function Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-gray-900 text-base border-b border-gray-50 pb-3 flex items-center gap-2">
              <span>⚙️</span> Cấu hình Edge Function
            </h3>
            
            <div className="space-y-3">
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tên Function</span>
                <p className="text-xs font-bold text-gray-800 font-mono bg-gray-50 border border-gray-100 rounded px-2 py-1 inline-block">backup-to-sheets</p>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Đường dẫn gọi (URL)</span>
                <p className="text-[11px] text-gray-600 font-mono bg-gray-50 p-2.5 rounded-lg border border-gray-100 break-all select-all leading-normal">
                  {edgeFunctionUrl}
                </p>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Xác thực</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Bearer Token (Anon key)
                </span>
              </div>
            </div>
          </div>

          {/* Cron Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-gray-900 text-base border-b border-gray-50 pb-3 flex items-center gap-2">
              <span>⏰</span> Lịch trình đồng bộ tự động
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500 font-medium">Tần suất:</span>
                <span className="font-bold text-gray-800">Hàng ngày (Daily)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500 font-medium">Giờ chạy:</span>
                <span className="font-bold text-gray-800">02:00 (UTC+7 / Vietnam)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500 font-medium">Giờ chuẩn:</span>
                <span className="font-mono text-xs bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded text-gray-600">19:00 UTC (prev day)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500 font-medium">Công nghệ:</span>
                <span className="font-bold text-indigo-600">pg_cron + pg_net (Supabase)</span>
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-850 text-xs leading-relaxed space-y-1.5 shadow-sm">
              <p className="font-bold">💡 Lưu ý thiết lập pg_cron:</p>
              <p>Mặc định pg_cron cần được bật thủ công trên Supabase Dashboard thông qua SQL Editor để kích hoạt lịch trình tự động hàng ngày.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
