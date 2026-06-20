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

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Quản lý Bán Thành Phẩm" 
        subtitle="Quản lý các nguyên liệu đã qua chế biến sơ bộ (như Trà ủ, Trân châu nấu...) dùng để pha chế."
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
                <th className="px-6 py-4 font-bold">ID</th>
                <th className="px-6 py-4 font-bold">Tên Bán Thành Phẩm</th>
                <th className="px-6 py-4 font-bold">Đơn Vị</th>
                <th className="px-6 py-4 font-bold">Công Thức Đang Dùng</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSemiProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                    Không tìm thấy bán thành phẩm nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredSemiProducts.map(sp => (
                  <tr key={sp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-gray-400">{sp.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{sp.name}</div>
                      {sp.status === "INACTIVE" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 mt-1">
                          Ngừng sử dụng
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      <span className="font-mono text-gray-500">
                        {sp.batch_yield ? `1 Mẻ = ${sp.batch_yield} ` : ""}
                        {unitMap[sp.base_unit || sp.unit_id || ""] || ""}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {sp.activeRecipe ? (
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="font-bold text-blue-600 mb-1">Mẻ chuẩn: {sp.batch_yield} {unitMap[sp.base_unit || sp.unit_id || ""] || ""}</div>
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              try {
                                const ings = JSON.parse(sp.activeRecipe.ingredients_json);
                                if (ings.length === 0) return <span className="text-gray-400 italic">Chưa có thành phần</span>;
                                return ings.map((ing: any, idx: number) => {
                                  const source = ing.ingredient_type === "BASE_INGREDIENT"
                                    ? baseIngredients.find(b => b.id === ing.ingredient_id)
                                    : semiProducts.find(s => s.id === ing.ingredient_id);
                                  const uName = unitMap[source?.base_unit || ""] || "";
                                  return (
                                    <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-100">
                                      {source?.name || ing.ingredient_id}: {ing.quantity}{uName}
                                    </span>
                                  );
                                });
                              } catch {
                                return <span className="text-gray-400 italic">Lỗi hiển thị công thức</span>;
                              }
                            })()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Chưa có công thức</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
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
                        <DeleteSemiProductButton id={sp.id} name={sp.name} />
                      </div>
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
        onClick={() => setIsOpen(true)}
        disabled={loading}
        className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50"
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
