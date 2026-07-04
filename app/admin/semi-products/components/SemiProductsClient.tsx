"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { SemiProductForm } from "./SemiProductForm";
import HistoryModal from "@/components/HistoryModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { deleteSemiProductAction } from "../actions";
import type { DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit } from "@/types/db";

interface SemiProductsClientProps {
  semiProducts: Array<DBSemiProduct & { activeRecipe?: DBRecipe; recipeHistory: any[] }>;
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}

export default function SemiProductsClient({ semiProducts, baseIngredients, units }: SemiProductsClientProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredSemiProducts = useMemo(() => {
    return semiProducts.filter(sp =>
      sp.name.toLowerCase().includes(search.toLowerCase()) ||
      sp.id.toLowerCase().includes(search.toLowerCase())
    );
  }, [semiProducts, search]);

  const unitMap = useMemo(() => {
    const map: Record<string, string> = {};
    units.forEach(u => map[u.id] = u.name);
    return map;
  }, [units]);

  const rightContent = (
    <SemiProductForm 
      units={units}
      baseIngredients={baseIngredients}
      semiProducts={semiProducts}
    />
  );

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Bán Thành Phẩm" 
        subtitle="Tổng quan danh sách nguyên liệu đã qua chế biến sơ bộ (như trà ủ, thạch, trân châu nấu...) dùng để pha chế."
        rightContent={rightContent}
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên hoặc mã bán thành phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
      </StickyFilterBar>

      {filteredSemiProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500 italic shadow-sm">
          Không tìm thấy bán thành phẩm nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSemiProducts.map(sp => {
            const isExpanded = expandedId === sp.id;
            const hasRecipe = !!sp.activeRecipe;
            let ingredientCount = 0;
            let parsedIngredients: any[] = [];
            
            if (hasRecipe && sp.activeRecipe?.ingredients_json) {
              try {
                parsedIngredients = JSON.parse(sp.activeRecipe.ingredients_json);
                ingredientCount = parsedIngredients.length;
              } catch {}
            }

            const unitName = unitMap[sp.base_unit || sp.unit_id || ""] || "";

            return (
              <div 
                key={sp.id} 
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col ${
                  isExpanded 
                    ? "border-blue-300 ring-4 ring-blue-50 shadow-md md:col-span-2 lg:col-span-2 xl:col-span-2" 
                    : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
                }`}
              >
                {/* Card Header & Main Info */}
                <div 
                  onClick={() => toggleExpand(sp.id)}
                  className="p-5 flex-1 flex flex-col justify-between cursor-pointer select-none"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="bg-blue-50 text-blue-700 w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0">
                        🥣
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-gray-900 text-sm leading-tight truncate">
                          {sp.name}
                        </h4>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                          ID: {sp.id}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {sp.status === "ACTIVE" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            Ngừng bán
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <div className="text-xs text-gray-500 flex justify-between items-center">
                        <span>Quy chuẩn mẻ nấu:</span>
                        <span className="font-bold text-gray-800">
                          1 Mẻ = {sp.batch_yield || 1} {unitName}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex justify-between items-center">
                        <span>Công thức:</span>
                        {hasRecipe ? (
                          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px]">
                            {ingredientCount} thành phần
                          </span>
                        ) : (
                          <span className="font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px]">
                            Chưa cấu hình
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                    <span>{isExpanded ? "Thu gọn chi tiết ▲" : "Xem chi tiết công thức ▼"}</span>
                    {hasRecipe && sp.activeRecipe?.created_at && (
                      <span>Áp dụng từ: {new Date(sp.activeRecipe.created_at).toLocaleDateString("vi-VN")}</span>
                    )}
                  </div>
                </div>

                {/* Collapsible Expanded Details */}
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 p-5 space-y-4 animate-slide-down">
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Thành phần trong 1 mẻ chuẩn ({sp.batch_yield || 1} {unitName})
                      </h5>
                      {hasRecipe && parsedIngredients.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {parsedIngredients.map((ing: any, idx: number) => {
                            const source = ing.ingredient_type === "BASE_INGREDIENT"
                              ? baseIngredients.find(b => b.id === ing.ingredient_id)
                              : semiProducts.find(s => s.id === ing.ingredient_id);
                            const ingUnit = unitMap[source?.base_unit || ""] || "";
                            
                            return (
                              <div 
                                key={idx} 
                                className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-100 text-xs shadow-sm"
                              >
                                <span className="font-semibold text-gray-800">{source?.name || ing.ingredient_id}</span>
                                <span className="font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                                  {ing.quantity} {ingUnit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic py-2">
                          Chưa có công thức nào đang được sử dụng hoặc cấu hình bị lỗi.
                        </p>
                      )}
                    </div>

                    {/* Actions and Metadata */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-gray-200/50">
                      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        {sp.recipeHistory.length > 0 && (
                          <HistoryModal title={sp.name} recipeHistory={sp.recipeHistory} />
                        )}
                        <SemiProductForm 
                          initialData={sp}
                          initialRecipe={sp.activeRecipe}
                          units={units}
                          baseIngredients={baseIngredients}
                          semiProducts={semiProducts}
                        />
                        <div className="min-h-[44px] flex items-center">
                          <DeleteSemiProductButton id={sp.id} name={sp.name} />
                        </div>
                      </div>
                      
                      {hasRecipe && sp.activeRecipe?.id && (
                        <span className="text-[10px] font-mono text-gray-400 select-all sm:text-right">
                          Mã CT: {sp.activeRecipe.id}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteSemiProductButton({ id, name }: { id: string; name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    await deleteSemiProductAction(fd);
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        disabled={loading}
        className="px-3.5 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95 transition text-xs font-bold border border-rose-200 min-h-[38px] flex items-center justify-center disabled:opacity-50"
      >
        {loading ? "..." : "Xóa"}
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa bán thành phẩm "${name}"? Các công thức đang dùng thành phần này có thể bị lỗi.`}
      />
    </>
  );
}
