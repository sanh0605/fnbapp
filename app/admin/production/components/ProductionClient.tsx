"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
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
      <StickyFilterBar 
        title="Sản Xuất / Nấu Bếp" 
        subtitle="Ghi nhận lịch sử nấu bếp, chế biến bán thành phẩm để hệ thống tự động trừ kho nguyên liệu."
        rightContent={rightContent}
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên bán thành phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
      </StickyFilterBar>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">Mã Lệnh</th>
                <th className="px-6 py-4 font-bold">Ngày Giờ</th>
                <th className="px-6 py-4 font-bold">Bán Thành Phẩm Thu Được</th>
                <th className="px-6 py-4 font-bold text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">
                    Chưa có lịch sử nấu bếp.
                  </td>
                </tr>
              ) : (
                sortedOrders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-gray-400 font-bold">{o.id}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(o.created_at || 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const sp = semiProducts.find(s => s.id === o.semi_product_id);
                        const uName = unitMap[sp?.base_unit || ""] || "";
                        return (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{sp?.name || o.semi_product_id}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              +{o.target_yield} {uName}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        Đã trừ kho
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
