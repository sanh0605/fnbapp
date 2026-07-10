"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
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
      <StickyFilterBar>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên, SĐT, địa chỉ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-48 border border-gray-300 rounded-lg px-3 py-3 md:py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-36 border border-gray-300 rounded-lg px-3 py-3 md:py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Ngừng hợp tác</option>
          </select>
        </div>
      </StickyFilterBar>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">ID</th>
                <th className="px-6 py-4 font-bold">Tên Nhà Cung Cấp</th>
                <th className="px-6 py-4 font-bold">Liên Hệ</th>
                <th className="px-6 py-4 font-bold">Mã Số Thuế</th>
                <th className="px-6 py-4 font-bold">Ghi Chú</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-gray-400">{s.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{s.name}</div>
                      {s.status === "INACTIVE" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 mt-1">
                          Ngừng hợp tác
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-800 font-medium">{s.phone || "---"}</div>
                      <div className="text-[11px] text-gray-500 truncate max-w-[200px]">{s.address || "---"}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600">{s.tax_id || "---"}</td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] text-gray-500 line-clamp-2 max-w-[200px]">{s.links || "---"}</div>
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
        <div className="md:hidden flex flex-col gap-3 p-4 bg-gray-50/30">
          {filteredSuppliers.length === 0 ? (
            <EmptyState 
              icon="🚚" 
              title="Chưa có nhà cung cấp" 
              description="Thêm nhà cung cấp để quản lý nguồn nhập hàng."
            />
          ) : (
            filteredSuppliers.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-900">{s.name}</div>
                    <div className="text-[11px] font-mono text-gray-400 mt-0.5">{s.id}</div>
                  </div>
                  {s.status === "INACTIVE" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      Ngừng hợp tác
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col gap-1 mt-1 text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-400 shrink-0">LH:</span> 
                    <span className="text-gray-800 font-medium">{s.phone || "---"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 shrink-0">MST:</span> 
                    <span className="font-mono text-gray-600">{s.tax_id || "---"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 shrink-0">ĐC:</span> 
                    <span className="text-gray-600 line-clamp-2">{s.address || "---"}</span>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-gray-100/50">
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
