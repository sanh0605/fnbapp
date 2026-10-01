"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteProductCategoryButton } from "./DeleteProductCategoryButton";
import type { DBProductCategory } from "@/types/db";

interface CategoriesClientProps {
  categories: DBProductCategory[];
  counts: Record<string, number>;
  initialSearch?: string;
}

function listUrl(search: string): string {
  const p = new URLSearchParams();
  if (search) p.set("q", search);
  const qs = p.toString();
  return qs ? `/admin/products/categories?${qs}` : "/admin/products/categories";
}

export default function CategoriesClient({
  categories,
  counts,
  initialSearch = "",
}: CategoriesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [categories, search]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSearch(next);
    router.replace(listUrl(next), { scroll: false });
  };

  const currentUrl = listUrl(search);
  const back = encodeURIComponent(currentUrl);

  const rightContent = (
    <Link
      href={`/admin/products/categories/new?returnTo=${back}`}
      className="bg-primary text-on-primary px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition inline-flex items-center justify-center min-h-[44px]"
    >
      + Thêm Danh Mục
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhóm món"
        subtitle="Quản lý các nhóm sản phẩm trong Menu bán hàng."
        actions={rightContent}
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên danh mục..."
            value={search}
            onChange={handleSearchChange}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm text-text-primary"
          />
        </div>
      </div>

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
                        <div className="flex justify-end items-center gap-4">
                          <Link
                            href={`/admin/products/categories/${encodeURIComponent(c.id)}/edit?returnTo=${back}`}
                            className="text-primary hover:text-primary-hover font-medium text-sm min-h-[44px] inline-flex items-center"
                          >
                            Sửa
                          </Link>
                          <DeleteProductCategoryButton category={c} />
                        </div>
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

                <div className="pt-3 border-t border-border flex justify-end items-center gap-4">
                  <Link
                    href={`/admin/products/categories/${encodeURIComponent(c.id)}/edit?returnTo=${back}`}
                    className="text-primary hover:text-primary-hover font-medium text-sm min-h-[44px] inline-flex items-center"
                  >
                    Sửa
                  </Link>
                  <DeleteProductCategoryButton category={c} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
