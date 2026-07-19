"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";
import { submitStockAdjustment, approveStockAdjustment } from "@/app/admin/inventory/actions";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AlertCircle, CheckCircle, Search, X } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";

export default function StockTable({ 
  stockItems, 
  adjustments, 
  role, 
  username 
}: { 
  stockItems: any[];
  adjustments: any[];
  role: string;
  username: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdjusting, setIsAdjusting] = useState<any>(null); // item being adjusted
  const [actualQty, setActualQty] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const pendingAdjustments = adjustments.filter(a => a.status === "PENDING");

  const filteredItems = stockItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdjusting || !actualQty) return;
    
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    const diff = Number(actualQty) - Number(isAdjusting.current_stock);
    
    const res = await submitStockAdjustment({
      item_id: isAdjusting.id,
      theoretical_qty: isAdjusting.current_stock,
      actual_qty: Number(actualQty),
      difference: diff,
      reason
    }, role, username);

    setIsSubmitting(false);
    if (res.error) {
      setErrorMessage("Lỗi: " + res.error);
    } else {
      setIsAdjusting(null);
      setActualQty("");
      setReason("");
      setSuccessMessage("Đã tạo yêu cầu / Cân bằng kho thành công.");
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  const handleApprove = async (adjId: string) => {
    if (role !== "ADMIN") return setErrorMessage("Chỉ Admin mới có quyền duyệt");
    setErrorMessage("");
    setSuccessMessage("");
    const res = await approveStockAdjustment(adjId, username);
    if (res.error) setErrorMessage(res.error);
    else {
      setSuccessMessage("Đã duyệt thành công.");
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="bg-danger/10 text-danger p-3 rounded-xl border border-danger/20 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="bg-success/10 text-success p-3 rounded-xl border border-success/20 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {pendingAdjustments.length > 0 && role === "ADMIN" && (
        <div className="bg-warning-soft border border-warning/30 rounded-xl p-4">
          <h3 className="font-bold text-warning mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Yêu cầu cân bằng kho chờ duyệt ({pendingAdjustments.length})
          </h3>
          <div className="space-y-2">
            {pendingAdjustments.map((adj) => {
              const item = stockItems.find(i => i.id === adj.item_reference);
              return (
                <div key={adj.id} className="flex items-center justify-between bg-surface-card p-3 rounded-lg border border-warning/20 shadow-sm">
                  <div>
                    <div className="font-medium text-text-primary">{item?.name || adj.item_reference}</div>
                    <div className="text-sm text-text-secondary">
                      Thực tế: <span className="font-bold text-text-primary">{adj.actual_qty}</span> (Lệch: {adj.difference > 0 ? '+' : ''}{adj.difference}) - Lý do: {adj.reason}
                    </div>
                    <div className="text-xs text-text-muted mt-1">Báo cáo bởi: {adj.created_by_name} lúc {formatDateTime(adj.created_at, { withSeconds: true })}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleApprove(adj.id)}
                    >
                      Duyệt & Ép kho
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Control Bar */}
      <PageHeader
        title="Quản lý & Cân bằng Tồn kho"
        subtitle="Kiểm kê số lượng thực tế và điều chỉnh nếu có sai lệch."
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted" aria-hidden="true">
            <Search className="w-5 h-5" />
          </span>
          <input 
            aria-label="Tìm kiếm nguyên liệu và bán thành phẩm"
            type="text" 
            placeholder="Tìm nguyên liệu, bán thành phẩm..." 
            className="w-full pl-10 pr-4 py-2 min-h-[44px] border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-page"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      
      </div>

      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden hidden md:block">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-page text-text-muted font-medium sticky top-0 border-b border-border shadow-sm z-10">
              <tr>
                <th className="px-6 py-4">Mã</th>
                <th className="px-6 py-4">Tên Sản phẩm / Nguyên liệu</th>
                <th className="px-6 py-4">Loại</th>
                <th className="px-6 py-4 text-right">Tồn Kho Hiện Tại (Hệ thống)</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-page transition">
                  <td className="px-6 py-4 font-mono text-xs text-text-muted">{item.id}</td>
                  <td className="px-6 py-4 font-medium text-text-primary">{item.name}</td>
                  <td className="px-6 py-4">
                    <Badge variant={item.item_type === "SEMI_PRODUCT" ? "processing" : "neutral"}>
                      {item.item_type === "SEMI_PRODUCT" ? "Bán thành phẩm" : "Nguyên liệu"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold ${item.current_stock < 0 ? 'text-danger' : 'text-text-primary'}`}>
                      {item.current_stock.toLocaleString("vi-VN")} {item.unitName}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAdjusting(item)}
                    >
                      Cân bằng
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List - shown on mobile */}
      <div className="space-y-3 md:hidden">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-surface-card rounded-card border border-border p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-text-primary text-sm">{item.name}</h4>
                <span className="text-[10px] font-mono text-text-muted block mt-0.5">ID: {item.id}</span>
                <div className="mt-1.5">
                  <Badge variant={item.item_type === "SEMI_PRODUCT" ? "processing" : "neutral"}>
                    {item.item_type === "SEMI_PRODUCT" ? "Bán thành phẩm" : "Nguyên liệu"}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Hệ thống</p>
                <div className={`text-base font-extrabold mt-0.5 ${item.current_stock < 0 ? 'text-danger' : 'text-text-primary'}`}>
                  {item.current_stock.toLocaleString("vi-VN")} {item.unitName}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/50">
              <Button 
                variant="secondary"
                size="sm"
                onClick={() => setIsAdjusting(item)}
              >
                Cân bằng
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Adjust Modal */}
      {isAdjusting && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-card w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden border border-border">
            <div className="p-5 border-b border-border bg-page flex justify-between items-center">
              <h3 className="font-bold text-text-primary">Cân bằng kho (Kiểm kê)</h3>
              <button onClick={() => setIsAdjusting(null)} className="text-text-muted hover:text-text-primary transition-colors" aria-label="Đóng">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Mặt hàng</label>
                <div className="p-3 bg-page rounded-lg font-medium text-text-primary border border-border/50">{isAdjusting.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Tồn lý thuyết (Hệ thống)</label>
                  <div className="p-3 bg-page text-text-muted border border-border/50 rounded-lg font-mono">
                    {isAdjusting.current_stock} {isAdjusting.unitName}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Thực tế (Đếm được)</label>
                  <input 
                    type="number" 
                    required
                    value={actualQty}
                    onChange={(e) => setActualQty(e.target.value)}
                    className="w-full p-3 border border-border bg-page text-text-primary rounded-lg font-mono focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              
              {actualQty !== "" && (
                <div className={`p-3 rounded-lg text-sm font-medium border ${
                  Number(actualQty) > isAdjusting.current_stock ? "bg-success/10 text-success border-success/20" :
                  Number(actualQty) < isAdjusting.current_stock ? "bg-danger/10 text-danger border-danger/20" :
                  "bg-page text-text-secondary border-border/50"
                }`}>
                  Độ lệch: {Number(actualQty) - isAdjusting.current_stock > 0 ? "+" : ""}
                  {Number(actualQty) - isAdjusting.current_stock} {isAdjusting.unitName}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Lý do điều chỉnh (Tuỳ chọn)</label>
                <input 
                  type="text" 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: Hư hỏng, đổ bể, đếm sai..."
                  className="w-full p-3 border border-border bg-page text-text-primary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {role !== "ADMIN" && (
                <div className="text-xs text-warning flex items-start gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Yêu cầu cân bằng sẽ được gửi cho Admin phê duyệt.
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={() => setIsAdjusting(null)}
                  className="flex-1"
                >
                  Huỷ
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || actualQty === ""}
                  className="flex-1"
                >
                  {isSubmitting ? "Đang xử lý..." : (role === "ADMIN" ? "Ép Tồn Kho Ngay" : "Gửi Duyệt")}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
