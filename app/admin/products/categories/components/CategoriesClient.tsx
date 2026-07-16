"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCategoryForm } from "./ProductCategoryForm";
import type { DBProductCategory } from "@/types/db";

interface CategoriesClientProps {
  categories: DBProductCategory[];
  counts: Record<string, number>;
}

export default function CategoriesClient({ categories, counts }: CategoriesClientProps) {
  const [search, setSearch] = useState("");

  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [categories, search]);

  const rightContent = <ProductCategoryForm />;

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Quản lý Danh mục" 
        subtitle="Quản lý các nhóm sản phẩm trong Menu bán hàng."
        rightContent={rightContent}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên danh mục..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
      </StickyFilterBar>

      {filteredCategories.length === 0 ? (
        <EmptyState 
          icon="📂" 
          title="Chưa có danh mục nào" 
          description="Thêm danh mục để phân loại các món ăn/đồ uống."
        />
      ) : (
        <>
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold w-20">STT</th>
                    <th className="px-6 py-4 font-bold">Tên Danh Mục</th>
                    <th className="px-6 py-4 font-bold text-center">Số lượng Món</th>
                    <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCategories.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-6 py-4 text-text-muted font-medium">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-text-primary">{c.name}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary-soft text-primary-active border border-primary/20">
                          {counts[c.id] || 0} món
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ProductCategoryForm initialData={c} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredCategories.map((c, idx) => (
              <div key={c.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-text-primary leading-tight">
                      {idx + 1}. {c.name}
                    </h3>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-soft text-primary-active border border-primary/20">
                      {counts[c.id] || 0} món
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex justify-end">
                  <ProductCategoryForm initialData={c} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
