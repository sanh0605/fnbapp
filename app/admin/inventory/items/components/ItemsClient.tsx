"use client";

import { useState, useMemo } from "react";
import { useUrlState } from "@/lib/use-url-state";
import StickyFilterBar from "@/components/StickyFilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PurchasedItemForm } from "./PurchasedItemForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { deletePurchasedItemAction } from "../actions";
import type { DBPurchasedItem, DBUOMConversion, DBItemCategory, DBBaseIngredient, DBUnit } from "@/types/db";

interface ItemsClientProps {
  categories: DBItemCategory[];
  baseIngredients: DBBaseIngredient[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}

export default function ItemsClient({ categories, baseIngredients, items, conversions, units }: ItemsClientProps) {
  const [search, setSearch] = useUrlState<string>("q", "");
  const [categoryFilter, setCategoryFilter] = useUrlState<string>("category", "ALL");

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "ALL" || item.item_category_id === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [items, search, categoryFilter]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => map[c.id] = c.name);
    return map;
  }, [categories]);

  const baseIngredientMap = useMemo(() => {
    const map: Record<string, string> = {};
    baseIngredients.forEach(b => map[b.id] = b.name);
    return map;
  }, [baseIngredients]);

  const rightContent = (
    <PurchasedItemForm 
      itemCategories={categories}
      baseIngredients={baseIngredients}
      units={units}
    />
  );

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Quản lý Hàng Mua Vào" 
        subtitle="Danh sách các mặt hàng thực tế nhập từ nhà cung cấp."
        rightContent={rightContent}
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên hàng hóa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Phân loại</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="ALL">Tất cả</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </StickyFilterBar>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">ID</th>
                <th className="px-6 py-4 font-bold">Tên Hàng Hóa</th>
                <th className="px-6 py-4 font-bold">Phân Loại</th>
                <th className="px-6 py-4 font-bold">Nguyên Liệu Gốc</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState 
                    icon="📦" 
                    title="Chưa có hàng hóa" 
                    description="Thêm hàng hóa để quản lý tồn kho."
                  />
                </td>
              </tr>
              ) : (
                filteredItems.map(item => {
                  const itemConversions = conversions.filter(c => c.purchased_item_id === item.id);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-[11px] text-gray-400">{item.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{item.name}</div>
                        {itemConversions.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {itemConversions.map((conv, idx) => {
                              const baseUnitName = units.find(u => u.id === conv.base_unit)?.name || "";
                              const purchasedUnitName = units.find(u => u.id === conv.purchased_unit)?.name || conv.purchased_unit;
                              return (
                                <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200">
                                  1 {purchasedUnitName} = {conv.conversion_rate} {baseUnitName}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                          {categoryMap[item.item_category_id] || "---"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {baseIngredientMap[item.base_ingredient_id] || "---"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center">
                          <PurchasedItemForm 
                            initialData={item}
                            initialConversions={itemConversions}
                            itemCategories={categories}
                            baseIngredients={baseIngredients}
                            units={units}
                          />
                          <DeleteItemButton id={item.id} name={item.name} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile Card Layout (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-gray-50/30">
          {filteredItems.length === 0 ? (
          <EmptyState 
            icon="📦" 
            title="Chưa có hàng hóa" 
            description="Thêm hàng hóa để quản lý tồn kho."
          />
        ) : (
            filteredItems.map(item => {
              const itemConversions = conversions.filter(c => c.purchased_item_id === item.id);
              return (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
                  <div>
                    <div className="font-bold text-gray-900">{item.name}</div>
                    <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                      {item.id} • <span className="font-medium text-purple-700 bg-purple-50 px-1 py-0.5 rounded">{categoryMap[item.item_category_id] || "---"}</span>
                    </div>
                  </div>
                  
                  {itemConversions.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Quy đổi</div>
                      <div className="flex flex-wrap gap-1">
                        {itemConversions.map((conv, idx) => {
                          const baseUnitName = units.find(u => u.id === conv.base_unit)?.name || "";
                          const purchasedUnitName = units.find(u => u.id === conv.purchased_unit)?.name || conv.purchased_unit;
                          return (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-[11px] bg-gray-100 text-gray-600 border border-gray-200">
                              1 {purchasedUnitName} = {conv.conversion_rate} {baseUnitName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {item.base_ingredient_id && (
                    <div className="text-sm text-gray-600">
                      <span className="text-gray-400">Nguyên liệu gốc:</span> <span className="font-medium">{baseIngredientMap[item.base_ingredient_id] || "---"}</span>
                    </div>
                  )}

                  <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-gray-100/50">
                    <div className="flex items-center min-h-[44px]">
                      <PurchasedItemForm 
                        initialData={item}
                        initialConversions={itemConversions}
                        itemCategories={categories}
                        baseIngredients={baseIngredients}
                        units={units}
                      />
                    </div>
                    <div className="flex items-center min-h-[44px]">
                      <DeleteItemButton id={item.id} name={item.name} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteItemButton({ id, name }: { id: string; name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    await deletePurchasedItemAction(fd);
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={loading}
        className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50 p-2 -m-2 md:p-0 md:m-0 min-h-[44px] md:min-h-0 flex items-center justify-center"
      >
        {loading ? "..." : "Xóa"}
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa hàng hóa "${name}"? Thao tác này có thể để lại dữ liệu rác trong bảng quy đổi và các đơn nhập hàng.`}
      />
    </>
  );
}
