"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useState, useMemo } from "react";
import ProductForm from "@/components/ProductForm";
import HistoryModal from "@/components/HistoryModal";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Search, Image as ImageIcon } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category_id: string;
  status: string;
  image_url?: string;
  variants: any[];
  recipeHistory: any[];
  priceHistory: any[];
}

interface Category {
  id: string;
  name: string;
}

export default function ProductsClient({
  enhancedProducts,
  activeCategories,
  activeBaseIngredients,
  activeSemiProducts,
  units,
  categories
}: {
  enhancedProducts: Product[];
  activeCategories: Category[];
  activeBaseIngredients: any[];
  activeSemiProducts: any[];
  units: any[];
  categories: Category[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");

  const filteredProducts = useMemo(() => {
    return enhancedProducts.filter(p => {
      if (categoryId && p.category_id !== categoryId) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [enhancedProducts, categoryId, statusFilter, searchQuery]);

  const rightContent = (
    <div className="flex items-center gap-3">
      <div className="hidden sm:block text-xs font-bold text-text-secondary whitespace-nowrap px-3 py-1.5 bg-surface-secondary rounded-lg">
        {filteredProducts.length} / {enhancedProducts.length} món
      </div>
      <ProductForm 
        categories={categories}
        baseIngredients={activeBaseIngredients}
        semiProducts={activeSemiProducts}
        units={units}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thành phẩm (Menu)"
        subtitle="Quản lý Menu bán hàng, cấu hình Size và Định mức pha chế."
        actions={rightContent}
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm món</label>
          <input
            type="text"
            placeholder="Tên món..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring outline-none shadow-sm bg-surface-card text-text-primary"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Danh mục</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary shadow-sm"
          >
            <option value="">Tất cả danh mục</option>
            {activeCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary shadow-sm"
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">Đang bán</option>
            <option value="INACTIVE">Ngừng bán</option>
            <option value="DELETED">Đã xóa</option>
          </select>
        </div>
      
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="Không tìm thấy món nào"
          description="Vui lòng thử điều chỉnh lại bộ lọc tìm kiếm."
        />
      ) : (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold w-20">Ảnh</th>
                    <th className="px-6 py-4 font-bold">Tên Món</th>
                    <th className="px-6 py-4 font-bold">Phân Loại</th>
                    <th className="px-6 py-4 font-bold">Kích Cỡ & Giá Bán</th>
                    <th className="px-6 py-4 font-bold">Trạng Thái</th>
                    <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map(product => {
                    const categoryName = activeCategories.find(c => c.id === product.category_id)?.name || "Chưa phân loại";
                    return (
                      <tr key={product.id} className="hover:bg-page transition-colors">
                        <td className="px-6 py-4">
                          <div className="w-12 h-12 rounded-lg bg-page border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-text-muted" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-text-primary text-sm">{product.name}</div>
                          <div className="text-[10px] font-mono text-text-muted mt-0.5">ID: {product.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="neutral">{categoryName}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2 max-w-lg">
                            {product.variants.map((v: any, idx: number) => {
                              const ingCount = v.ingredients?.length || 0;
                              return (
                                <div 
                                  key={idx} 
                                  className="flex items-center gap-2 bg-page border border-border px-2.5 py-1 rounded-lg text-xs"
                                >
                                  <span className="font-bold text-text-primary">{v.size_name}</span>
                                  <span className="text-border">|</span>
                                  <span className="font-black text-primary">{formatNumber(v.price)}</span>
                                  {ingCount > 0 ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-success" title={`Đã định mức: ${ingCount} món`} />
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-danger" title="Chưa có định mức" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {product.status === "ACTIVE" ? (
                            <Badge variant="success">Đang bán</Badge>
                          ) : product.status === "INACTIVE" ? (
                            <Badge variant="warning">Ngừng bán</Badge>
                          ) : (
                            <Badge variant="neutral">Đã xóa</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 items-center">
                            <HistoryModal 
                              title={product.name}
                              recipeHistory={product.recipeHistory}
                              priceHistory={product.priceHistory}
                            />
                            <ProductForm 
                              categories={categories}
                              baseIngredients={activeBaseIngredients}
                              semiProducts={activeSemiProducts}
                              units={units}
                              initialData={product}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="md:hidden grid grid-cols-1 gap-4">
            {filteredProducts.map(product => {
              const categoryName = activeCategories.find(c => c.id === product.category_id)?.name || "Chưa phân loại";
              return (
                <div key={product.id} className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden flex flex-col">
                  {/* Card Image Banner */}
                  <div className="h-28 bg-page flex items-center justify-center border-b border-border relative">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-text-muted" />
                    )}
                    <div className="absolute top-3 right-3 bg-surface-card/90 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-bold text-primary border border-primary/20 shadow-sm">
                      {categoryName}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-text-primary leading-tight">{product.name}</h3>
                      <div className="text-[10px] font-mono text-text-muted mt-0.5">ID: {product.id}</div>
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="text-[10px] uppercase font-bold text-text-muted">Các kích cỡ & Giá:</div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {product.variants.map((v: any, idx: number) => {
                          const ingCount = v.ingredients?.length || 0;
                          return (
                            <div key={idx} className="flex justify-between items-center bg-page p-2 rounded-lg border border-border text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-text-primary">{v.size_name}</span>
                                {ingCount > 0 ? (
                                  <span className="inline-flex items-center px-1 py-0.2 bg-green-100 text-success text-[9px] rounded font-bold">Định mức</span>
                                ) : (
                                  <span className="inline-flex items-center px-1 py-0.2 bg-danger/20 text-danger text-[9px] rounded font-bold">Chưa có</span>
                                )}
                              </div>
                              <span className="font-black text-primary">{formatNumber(v.price)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex justify-between items-center gap-2">
                      <div>
                        {product.status === "ACTIVE" ? (
                          <Badge variant="success">Đang bán</Badge>
                        ) : (
                          <Badge variant="warning">Ngừng bán</Badge>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <HistoryModal 
                          title={product.name}
                          recipeHistory={product.recipeHistory}
                          priceHistory={product.priceHistory}
                        />
                        <ProductForm 
                          categories={categories}
                          baseIngredients={activeBaseIngredients}
                          semiProducts={activeSemiProducts}
                          units={units}
                          initialData={product}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
