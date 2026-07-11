"use client";

import { useState, useMemo } from "react";
import { useUrlState } from "@/lib/use-url-state";
import StickyFilterBar from "@/components/StickyFilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
      <PageHeader 
        title="Quản lý Hàng Mua Vào" 
        subtitle="Danh sách các mặt hàng thực tế nhập từ nhà cung cấp."
        actions={rightContent}
      />
      <StickyFilterBar>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên hàng hóa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm text-text-primary"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Phân loại</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-40 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm text-text-primary"
          >
            <option value="ALL">Tất cả</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </StickyFilterBar>

      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-6 py-4 font-bold">ID</th>
                <th className="px-6 py-4 font-bold">Tên Hàng Hóa</th>
                <th className="px-6 py-4 font-bold">Phân Loại</th>
                <th className="px-6 py-4 font-bold">Nguyên Liệu Gốc</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                    <tr key={item.id} className="hover:bg-page transition-colors">
                      <td className="px-6 py-4 font-mono text-[11px] text-text-muted">{item.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-text-primary">{item.name}</div>
                        {itemConversions.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {itemConversions.map((conv, idx) => {
                              const baseUnitName = units.find(u => u.id === conv.base_unit)?.name || "";
                              const purchasedUnitName = units.find(u => u.id === conv.purchased_unit)?.name || conv.purchased_unit;
                              return (
                                <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-page text-text-secondary border border-border">
                                  1 {purchasedUnitName} = {conv.conversion_rate} {baseUnitName}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="processing">
                          {categoryMap[item.item_category_id] || "---"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-text-secondary font-medium">
                        {baseIngredientMap[item.base_ingredient_id] || "---"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
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
        <div className="md:hidden flex flex-col gap-3 p-4 bg-page/30">
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
                <div key={item.id} className="bg-surface-card rounded-card border border-border p-4 shadow-sm flex flex-col gap-3">
                  <div>
                    <div className="font-bold text-text-primary">{item.name}</div>
                    <div className="text-[11px] font-mono text-text-muted mt-1.5 flex items-center gap-1.5">
                      {item.id} <span className="opacity-50">•</span> <Badge variant="processing">{categoryMap[item.item_category_id] || "---"}</Badge>
                    </div>
                  </div>
                  
                  {itemConversions.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="text-[10px] uppercase font-bold text-text-muted">Quy đổi</div>
                      <div className="flex flex-wrap gap-1">
                        {itemConversions.map((conv, idx) => {
                          const baseUnitName = units.find(u => u.id === conv.base_unit)?.name || "";
                          const purchasedUnitName = units.find(u => u.id === conv.purchased_unit)?.name || conv.purchased_unit;
                          return (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-[11px] bg-page text-text-secondary border border-border">
                              1 {purchasedUnitName} = {conv.conversion_rate} {baseUnitName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {item.base_ingredient_id && (
                    <div className="text-sm text-text-secondary mt-1">
                      <span className="text-text-muted">Nguyên liệu gốc:</span> <span className="font-medium">{baseIngredientMap[item.base_ingredient_id] || "---"}</span>
                    </div>
                  )}

                  <div className="flex justify-end items-center gap-2 pt-3 mt-2 border-t border-border/50">
                    <div className="flex items-center">
                      <PurchasedItemForm 
                        initialData={item}
                        initialConversions={itemConversions}
                        itemCategories={categories}
                        baseIngredients={baseIngredients}
                        units={units}
                      />
                    </div>
                    <div className="flex items-center">
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
      <Button
        variant="danger"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={loading}
      >
        {loading ? "..." : "Xóa"}
      </Button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa hàng hóa "${name}"? Thao tác này có thể để lại dữ liệu rác trong bảng quy đổi và các đơn nhập hàng.`}
      />
    </>
  );
}
