"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
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
        className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition transition whitespace-nowrap shadow-sm"
      >
        + Tạo Đơn Nhập Hàng
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Nhập Hàng" 
        subtitle="Quản lý các đơn đặt hàng từ nhà cung cấp và theo dõi công nợ."
        actions={rightContent}
      />
      <StickyFilterBar>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Mã đơn, NCC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-3 md:py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-36 border border-border rounded-lg px-3 py-3 md:py-2 text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
          >
            <option value="ALL">Tất cả</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="COMPLETED">Đã hoàn thành</option>
          </select>
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Nhà Cung Cấp</label>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-3 md:py-2 text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
          >
            <option value="ALL">Tất cả NCC</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </StickyFilterBar>

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
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
                  <tr key={po.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-text-muted font-bold">{po.id}</td>
                    <td className="px-6 py-4">
                      {po.status === "COMPLETED" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-success/10 text-success-active">
                          HOÀN THÀNH
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-surface-secondary text-text-secondary">
                          BẢN NHÁP
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-text-primary">
                      {supplierMap[po.supplier_id] || "Không xác định"}
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      {po.created_at ? new Date(po.created_at).toLocaleDateString('vi-VN') : "---"}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-text-primary">
                      {formatNumber(po.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/admin/inventory/purchase-orders/${po.id}`}
                        className="text-primary hover:text-primary-hover font-medium text-sm"
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

        {/* Mobile Card Layout (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-surface-secondary/30">
          {sortedOrders.length === 0 ? (
            <EmptyState 
              icon="📦" 
              title="Chưa có đơn nhập hàng" 
              description="Tạo đơn nhập hàng để thêm vào tồn kho."
            />
          ) : (
            sortedOrders.map((po) => (
              <div key={po.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-text-primary">{supplierMap[po.supplier_id] || "Không xác định"}</div>
                    <div className="text-[11px] font-mono text-text-muted mt-0.5">{po.id}</div>
                  </div>
                  {po.status === "COMPLETED" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success-active border border-success/30">
                      HOÀN THÀNH
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-surface-secondary text-text-secondary border border-border">
                      BẢN NHÁP
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <div className="text-text-muted">
                    <span className="text-text-muted">Ngày tạo:</span> <span className="font-medium">{po.created_at ? new Date(po.created_at).toLocaleDateString('vi-VN') : "---"}</span>
                  </div>
                  <div className="font-bold text-text-primary text-base">
                    {formatNumber(po.total_amount)}
                  </div>
                </div>
                <div className="flex justify-end pt-3 mt-1 border-t border-border">
                  <Link 
                    href={`/admin/inventory/purchase-orders/${po.id}`}
                    className="flex items-center justify-center bg-surface-secondary text-primary font-bold py-2 px-4 rounded-lg text-sm w-full border border-border min-h-[44px]"
                  >
                    {po.status === "COMPLETED" ? "Xem chi tiết" : "Sửa đơn"}
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
