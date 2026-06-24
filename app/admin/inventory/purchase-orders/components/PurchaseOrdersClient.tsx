"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DBPurchaseOrder, DBSupplier } from "@/types/db";

interface PurchaseOrdersClientProps {
  orders: DBPurchaseOrder[];
  suppliers: DBSupplier[];
}

export default function PurchaseOrdersClient({ orders, suppliers }: PurchaseOrdersClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [recalculating, setRecalculating] = useState(false);
  const router = useRouter();

  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {};
    suppliers.forEach(s => map[s.id] = s.name);
    return map;
  }, [suppliers]);

  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      const sName = supplierMap[po.supplier_id] || "";
      const matchSearch = po.id.toLowerCase().includes(search.toLowerCase()) || 
                          sName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || po.status === statusFilter;
      const matchSupplier = supplierFilter === "ALL" || po.supplier_id === supplierFilter;
      
      return matchSearch && matchStatus && matchSupplier;
    });
  }, [orders, search, statusFilter, supplierFilter, supplierMap]);

  // Sort descending by creation date
  const sortedOrders = [...filteredOrders].sort((a, b) => 
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const handleRecalculate = async () => {
    if (recalculating) return;
    if (!window.confirm("Bạn có chắc chắn muốn tính toán lại giá vốn cho toàn bộ đơn hàng trong lịch sử? Việc này sẽ mất vài giây.")) return;
    
    setRecalculating(true);
    try {
      const res = await fetch("/api/recalculate-cogs", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`Thành công! Đã tính toán lại giá vốn và cập nhật ${data.updatedCount} dòng đơn hàng.`);
        router.refresh();
      } else {
        alert(`Lỗi: ${data.error || "Không thể tính lại giá vốn"}`);
      }
    } catch (err: any) {
      alert(`Lỗi kết nối: ${err?.message || err}`);
    } finally {
      setRecalculating(false);
    }
  };

  const rightContent = (
    <div className="flex gap-3">
      <button
        onClick={handleRecalculate}
        disabled={recalculating}
        className={`px-4 py-2 rounded-lg font-medium border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition whitespace-nowrap shadow-sm flex items-center gap-2 ${recalculating ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {recalculating ? (
          <>
            <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Đang tính toán lại...
          </>
        ) : (
          <>
            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
            </svg>
            Tính lại giá vốn
          </>
        )}
      </button>
      <Link
        href="/admin/inventory/purchase-orders/new"
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition whitespace-nowrap shadow-sm"
      >
        + Tạo Đơn Nhập Hàng
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Quản lý Nhập Hàng" 
        subtitle="Quản lý các đơn đặt hàng từ nhà cung cấp và theo dõi công nợ."
        rightContent={rightContent}
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Mã đơn, NCC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="ALL">Tất cả</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="COMPLETED">Đã hoàn thành</option>
          </select>
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nhà Cung Cấp</label>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="ALL">Tất cả NCC</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </StickyFilterBar>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">Mã Đơn</th>
                <th className="px-6 py-4 font-bold">Trạng Thái</th>
                <th className="px-6 py-4 font-bold">Nhà Cung Cấp</th>
                <th className="px-6 py-4 font-bold">Ngày Tạo</th>
                <th className="px-6 py-4 font-bold text-right">Tổng Tiền</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                    Không tìm thấy đơn nhập hàng nào.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-gray-500 font-bold">{po.id}</td>
                    <td className="px-6 py-4">
                      {po.status === "COMPLETED" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700">
                          HOÀN THÀNH
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">
                          BẢN NHÁP
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {supplierMap[po.supplier_id] || "Không xác định"}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {po.created_at ? new Date(po.created_at).toLocaleDateString('vi-VN') : "---"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {Number(po.total_amount || 0).toLocaleString("vi-VN")} đ
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/admin/inventory/purchase-orders/${po.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        {po.status === "COMPLETED" ? "Xem chi tiết" : "Sửa đơn"}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
