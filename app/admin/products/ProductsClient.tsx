"use client";

import { useState, useMemo } from "react";
import ProductForm from "@/components/ProductForm";
import HistoryModal from "@/components/HistoryModal";
import StickyFilterBar from "@/components/StickyFilterBar";

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
      <div className="hidden sm:block text-xs font-bold text-gray-500 whitespace-nowrap px-3 py-1.5 bg-gray-100 rounded-lg">
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
      <StickyFilterBar 
        rightContent={rightContent}
        title="Thành phẩm (Menu)"
        subtitle="Quản lý Menu bán hàng, cấu hình Size và Định mức pha chế."
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm món</label>
          <input
            type="text"
            placeholder="Tên món..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Danh mục</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="">Tất cả danh mục</option>
            {activeCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">Đang bán</option>
            <option value="INACTIVE">Ngừng bán</option>
            <option value="DELETED">Đã xóa</option>
          </select>
        </div>
      </StickyFilterBar>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => {
          const categoryName = activeCategories.find(c => c.id === product.category_id)?.name || "Chưa phân loại";
          
          return (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition">
              <div className="h-32 bg-gray-50 flex items-center justify-center border-b border-gray-100 relative group">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-4xl">☕</div>
                )}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold text-indigo-700 border border-indigo-100 shadow-sm">
                  {categoryName}
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h3>
                </div>

                <div className="space-y-3 flex-1">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Các kích cỡ & Giá:</h4>
                  {product.variants.map((v:any, idx:number) => {
                    const ingCount = v.ingredients?.length || 0;
                    return (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <div>
                          <div className="font-bold text-gray-800 text-sm">{v.size_name}</div>
                          {ingCount > 0 ? (
                            <div className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-1">
                              Đã có định mức ({ingCount})
                            </div>
                          ) : (
                            <div className="text-[11px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded w-fit mt-1">
                              Chưa có định mức
                            </div>
                          )}
                        </div>
                        <div className="font-black text-orange-600">
                          {Number(v.price).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end gap-3 items-center">
                  <HistoryModal 
                    title={product.name}
                    recipeHistory={product.recipeHistory}
                    priceHistory={product.priceHistory}
                  />
                  <ProductForm 
                    categories={activeCategories}
                    baseIngredients={activeBaseIngredients}
                    semiProducts={activeSemiProducts}
                    units={units}
                    initialData={product}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-16 px-4">
          <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Không tìm thấy món nào</h3>
          <p className="text-gray-500 mb-4">Vui lòng thử điều chỉnh lại bộ lọc tìm kiếm.</p>
        </div>
      )}
    </div>
  );
}
