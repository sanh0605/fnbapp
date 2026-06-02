"use client";

import { useState } from "react";
import { submitStockAdjustment, approveStockAdjustment } from "@/app/actions/stock";

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

  const pendingAdjustments = adjustments.filter(a => a.status === "PENDING");

  const filteredItems = stockItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdjusting || !actualQty) return;
    
    setIsSubmitting(true);
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
      alert("Lỗi: " + res.error);
    } else {
      setIsAdjusting(null);
      setActualQty("");
      setReason("");
    }
  };

  const handleApprove = async (adjId: string) => {
    if (role !== "ADMIN") return alert("Chỉ Admin mới có quyền duyệt");
    const res = await approveStockAdjustment(adjId, username);
    if (res.error) alert(res.error);
  };

  return (
    <div className="space-y-6">
      {pendingAdjustments.length > 0 && role === "ADMIN" && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
            <span>⚠️</span> Yêu cầu cân bằng kho chờ duyệt ({pendingAdjustments.length})
          </h3>
          <div className="space-y-2">
            {pendingAdjustments.map((adj) => {
              const item = stockItems.find(i => i.id === adj.item_reference);
              return (
                <div key={adj.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100 shadow-sm">
                  <div>
                    <div className="font-medium text-gray-900">{item?.name || adj.item_reference}</div>
                    <div className="text-sm text-gray-500">
                      Thực tế: <span className="font-bold text-gray-900">{adj.actual_qty}</span> (Lệch: {adj.difference > 0 ? '+' : ''}{adj.difference}) - Lý do: {adj.reason}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Báo cáo bởi: {adj.created_by} lúc {new Date(adj.created_at).toLocaleString("vi-VN")}</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApprove(adj.id)}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                    >
                      Duyệt & Ép kho
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Tìm nguyên liệu, bán thành phẩm..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Mã</th>
                <th className="px-6 py-4">Tên Sản phẩm / Nguyên liệu</th>
                <th className="px-6 py-4">Loại</th>
                <th className="px-6 py-4 text-right">Tồn Kho Hiện Tại (Hệ thống)</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-6 py-4 font-mono text-xs text-gray-400">{item.id}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.item_type === "SEMI_PRODUCT" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {item.item_type === "SEMI_PRODUCT" ? "Bán thành phẩm" : "Nguyên liệu"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold ${item.current_stock < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.current_stock.toLocaleString("vi-VN")} {item.unitName}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setIsAdjusting(item)}
                      className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      Cân bằng
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Modal */}
      {isAdjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Cân bằng kho (Kiểm kê)</h3>
              <button onClick={() => setIsAdjusting(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mặt hàng</label>
                <div className="p-3 bg-gray-50 rounded-lg font-medium text-gray-900">{isAdjusting.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tồn lý thuyết (Hệ thống)</label>
                  <div className="p-3 bg-gray-50 text-gray-500 rounded-lg font-mono">
                    {isAdjusting.current_stock} {isAdjusting.unitName}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thực tế (Đếm được)</label>
                  <input 
                    type="number" 
                    required
                    value={actualQty}
                    onChange={(e) => setActualQty(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {actualQty !== "" && (
                <div className={`p-3 rounded-lg text-sm font-medium border ${
                  Number(actualQty) > isAdjusting.current_stock ? "bg-green-50 text-green-700 border-green-200" :
                  Number(actualQty) < isAdjusting.current_stock ? "bg-red-50 text-red-700 border-red-200" :
                  "bg-gray-50 text-gray-700 border-gray-200"
                }`}>
                  Độ lệch: {Number(actualQty) - isAdjusting.current_stock > 0 ? "+" : ""}
                  {Number(actualQty) - isAdjusting.current_stock} {isAdjusting.unitName}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do điều chỉnh (Tuỳ chọn)</label>
                <input 
                  type="text" 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: Hư hỏng, đổ bể, đếm sai..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {role !== "ADMIN" && (
                <div className="text-xs text-orange-600 flex items-start gap-1">
                  <span>⚠️</span> Yêu cầu cân bằng sẽ được gửi cho Admin phê duyệt.
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAdjusting(null)}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                >
                  Huỷ
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || actualQty === ""}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Đang xử lý..." : (role === "ADMIN" ? "Ép Tồn Kho Ngay" : "Gửi Duyệt")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
