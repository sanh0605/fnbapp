"use client";

import { useState, useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SupplierForm, DeleteSupplierButton } from "./SupplierForm";
import type { DBSupplier } from "@/types/db";

interface SuppliersClientProps {
  suppliers: DBSupplier[];
}

export default function SuppliersClient({ suppliers }: SuppliersClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.phone?.toLowerCase().includes(search.toLowerCase()) ||
        s.address?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [suppliers, search, statusFilter]);

  const rightContent = <SupplierForm />;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Nhà Cung Cấp" 
        subtitle="Quản lý thông tin liên hệ và danh sách các đối tác cung ứng."
        actions={rightContent}
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên, SĐT, địa chỉ..."
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
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Ngừng hợp tác</option>
          </select>
        </div>
      
      </div>

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-6 py-4 font-bold">ID</th>
                <th className="px-6 py-4 font-bold">Tên Nhà Cung Cấp</th>
                <th className="px-6 py-4 font-bold">Liên Hệ</th>
                <th className="px-6 py-4 font-bold">Mã Số Thuế</th>
                <th className="px-6 py-4 font-bold">Ghi Chú</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSuppliers.length === 0 ? (
                <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState 
                    icon="🚚" 
                    title="Chưa có nhà cung cấp" 
                    description="Thêm nhà cung cấp để quản lý nguồn nhập hàng."
                  />
                </td>
              </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-text-muted">{s.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-text-primary">{s.name}</div>
                      {s.status === "INACTIVE" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary mt-1">
                          Ngừng hợp tác
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-text-primary font-medium">{s.phone || "---"}</div>
                      <div className="text-[11px] text-text-muted truncate max-w-[200px]">{s.address || "---"}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-text-secondary">{s.tax_id || "---"}</td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] text-text-muted line-clamp-2 max-w-[200px]">{s.links || "---"}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center">
                        <SupplierForm initialData={s} />
                        <DeleteSupplierButton id={s.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-surface-secondary/30">
          {filteredSuppliers.length === 0 ? (
            <EmptyState 
              icon="🚚" 
              title="Chưa có nhà cung cấp" 
              description="Thêm nhà cung cấp để quản lý nguồn nhập hàng."
            />
          ) : (
            filteredSuppliers.map((s) => (
              <div key={s.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-text-primary">{s.name}</div>
                    <div className="text-[11px] font-mono text-text-muted mt-0.5">{s.id}</div>
                  </div>
                  {s.status === "INACTIVE" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary border border-border">
                      Ngừng hợp tác
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col gap-1 mt-1 text-sm">
                  <div className="flex gap-2">
                    <span className="text-text-muted shrink-0">LH:</span> 
                    <span className="text-text-primary font-medium">{s.phone || "---"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-text-muted shrink-0">MST:</span> 
                    <span className="font-mono text-text-secondary">{s.tax_id || "---"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-text-muted shrink-0">ĐC:</span> 
                    <span className="text-text-secondary line-clamp-2">{s.address || "---"}</span>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-border">
                  <div className="flex items-center min-h-[44px]">
                    <SupplierForm initialData={s} />
                  </div>
                  <div className="flex items-center min-h-[44px]">
                    <DeleteSupplierButton id={s.id} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
