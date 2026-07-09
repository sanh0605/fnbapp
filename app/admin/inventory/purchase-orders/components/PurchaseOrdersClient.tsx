"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";
import type { DBPurchaseOrder, DBSupplier } from "@/types/db";

interface PurchaseOrdersClientProps {
  orders: DBPurchaseOrder[];
  suppliers: DBSupplier[];
}

export default function PurchaseOrdersClient({ orders, suppliers }: PurchaseOrdersClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");

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

  // Claude code — Supabase migration Phase F: removed "Tính lại giá vốn"
  // button + handler. Endpoint /api/recalculate-cogs was a legacy FIFO-era
  // helper, obsolete after MAC migration (Phase 5A).

  const rightContent = (
    <div className="flex gap-3">
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
                  <td colSpan={6} className="p-0">
                    <EmptyState 
                      icon="📦" 
                      title="Chưa có đơn nhập hàng" 
                      description="Tạo đơn nhập hàng để thêm vào tồn kho."
                    />
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
                      {formatNumber(po.total_amount)}
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
