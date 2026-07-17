"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useState, useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductionForm } from "./ProductionForm";
import type { DBProductionOrder, DBProductionItem, DBSemiProduct, DBBaseIngredient, DBUnit, DBRecipe } from "@/types/db";

interface ProductionClientProps {
  orders: DBProductionOrder[];
  productionItems: DBProductionItem[];
  semiProducts: DBSemiProduct[];
  recipes: DBRecipe[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}

export default function ProductionClient({ orders, productionItems, semiProducts, recipes, baseIngredients, units }: ProductionClientProps) {
  const [search, setSearch] = useState("");

  const spMap = useMemo(() => {
    const map: Record<string, string> = {};
    semiProducts.forEach(s => map[s.id] = s.name);
    return map;
  }, [semiProducts]);

  const unitMap = useMemo(() => {
    const map: Record<string, string> = {};
    units.forEach(u => map[u.id] = u.name);
    return map;
  }, [units]);

  // Combine orders with their items
  const enrichedOrders = useMemo(() => {
    return orders.map(o => {
      const items = productionItems.filter(i => i.production_order_id === o.id);
      return { ...o, items };
    });
  }, [orders, productionItems]);

  const filteredOrders = useMemo(() => {
    return enrichedOrders.filter(o => {
      // Search by semi-product name within the order
      const spName = spMap[o.semi_product_id] || "";
      return search === "" || spName.toLowerCase().includes(search.toLowerCase());
    });
  }, [enrichedOrders, search, spMap]);

  const sortedOrders = [...filteredOrders].sort((a, b) => 
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const rightContent = (
    <ProductionForm 
      semiProducts={semiProducts}
      recipes={recipes}
      baseIngredients={baseIngredients}
      units={units}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sản Xuất / Nấu Bếp"
        subtitle="Ghi nhận lịch sử nấu bếp, chế biến bán thành phẩm để hệ thống tự động trừ kho nguyên liệu."
        actions={rightContent}
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên bán thành phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
      
      </div>

      {sortedOrders.length === 0 ? (
        <EmptyState 
          icon="🧑‍🍳" 
          title="Chưa có lịch sử nấu bếp" 
          description="Bạn chưa thực hiện mẻ nấu bán thành phẩm nào."
        />
      ) : (
        <>
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold">Mã Lệnh</th>
                    <th className="px-6 py-4 font-bold">Ngày Giờ</th>
                    <th className="px-6 py-4 font-bold">Bán Thành Phẩm Thu Được</th>
                    <th className="px-6 py-4 font-bold text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedOrders.map(o => (
                    <tr key={o.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-[11px] text-text-muted font-bold">{o.id}</td>
                      <td className="px-6 py-4 text-text-muted">
                        {new Date(o.created_at || 0).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const sp = semiProducts.find(s => s.id === o.semi_product_id);
                          const uName = unitMap[sp?.base_unit || ""] || "";
                          return (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text-primary">{sp?.name || o.semi_product_id}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-primary-soft text-primary-active border border-primary/20">
                                +{o.target_yield} {uName}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-success/10 text-success-active">
                          Đã trừ kho
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3">
            {sortedOrders.map(o => {
              const sp = semiProducts.find(s => s.id === o.semi_product_id);
              const uName = unitMap[sp?.base_unit || ""] || "";
              
              return (
                <div key={o.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-text-primary leading-tight">
                        {sp?.name || o.semi_product_id}
                      </h3>
                      <div className="text-[10px] font-mono text-text-muted mt-0.5">Mã: {o.id}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-text-muted">
                        {new Date(o.created_at || 0).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {new Date(o.created_at || 0).toLocaleTimeString('vi-VN')}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Thu được</div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-primary-soft text-primary-active border border-primary/20">
                        +{o.target_yield} {uName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success-active border border-success/20">
                        Đã trừ kho
                      </span>
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
