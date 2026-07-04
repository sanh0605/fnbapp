"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import StickyFilterBar from "@/components/StickyFilterBar";
import HistoryModal from "@/components/HistoryModal";
import { deleteModifierAction } from "../actions";
import { ModifierForm } from "./ModifierForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import type { DBModifier, DBRecipe, DBBaseIngredient, DBSemiProduct, DBUnit } from "@/types/db";
import { parseModifierIngredients } from "@/lib/modifier-recipe";
import ToppingsManager from "@/components/ToppingsManager";

interface ModifiersClientProps {
  modifiers: Array<DBModifier & {
    activeRecipe?: DBRecipe;
    recipeHistory: Array<any>;
    hasMultipleActiveRecipes?: boolean;
    activeRecipeCount?: number;
  }>;
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  units: DBUnit[];
  toppings: any[];
}

export default function ModifiersClient({ modifiers, baseIngredients, semiProducts, units, toppings }: ModifiersClientProps) {
  const [activeTab, setActiveTab] = useState<"modifiers" | "standalone">("modifiers");
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filteredModifiers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return modifiers;
    return modifiers.filter((m) => {
      const ingredientNames = parseModifierIngredients(m.activeRecipe?.ingredients_json)
        .map((ing) => {
          const source = ing.ingredient_type === "BASE_INGREDIENT"
            ? baseIngredients.find(bi => bi.id === ing.ingredient_id)
            : semiProducts.find(sp => sp.id === ing.ingredient_id);
          return source?.name || ing.ingredient_id || "";
        })
        .join(" ");
      return (
        m.name.toLowerCase().includes(normalizedSearch) ||
        m.group_name.toLowerCase().includes(normalizedSearch) ||
        ingredientNames.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [baseIngredients, modifiers, search, semiProducts]);

  const rightContent = (
    <ModifierForm 
      baseIngredients={baseIngredients} 
      semiProducts={semiProducts} 
      units={units} 
    />
  );

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Topping & Tùy chọn" 
        subtitle="Quản lý tùy chọn và cài đặt bán độc lập (POS)."
        rightContent={activeTab === "modifiers" ? rightContent : undefined}
      >
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("modifiers")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "modifiers" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Tùy chọn (Modifiers)
          </button>
          <button
            onClick={() => setActiveTab("standalone")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "standalone" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Bán độc lập
          </button>
        </div>

        {activeTab === "modifiers" && (
          <div className="shrink-0 ml-4">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm tùy chọn</label>
            <input
              type="text"
              placeholder="Tên hoặc nhóm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
            />
          </div>
        )}
      </StickyFilterBar>

      {activeTab === "modifiers" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">Nhóm</th>
                <th className="px-6 py-4 font-bold">Tên Tùy Chọn</th>
                <th className="px-6 py-4 font-bold">Giá Thêm</th>
                <th className="px-6 py-4 font-bold">Định Mức (Recipe)</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredModifiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                    Không tìm thấy tùy chọn nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredModifiers.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">
                        {m.group_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">{m.name}</td>
                    <td className="px-6 py-4 text-orange-600 font-bold">
                      {Number(m.price || 0).toLocaleString("vi-VN")}đ
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {m.activeRecipe ? (
                          (() => {
                            const ings = parseModifierIngredients(m.activeRecipe.ingredients_json);
                            if (ings.length === 0) return <span className="text-gray-400 italic text-[11px]">Chưa có định mức</span>;
                            
                            return ings.map((ing, idx) => {
                              const source = ing.ingredient_type === "BASE_INGREDIENT"
                                ? baseIngredients.find(bi => bi.id === ing.ingredient_id)
                                : semiProducts.find(sp => sp.id === ing.ingredient_id);
                              const unitName = units.find(u => u.id === source?.base_unit)?.name || "";
                              return (
                                <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-100">
                                  {source?.name || ing.ingredient_id}: {ing.quantity}{unitName}
                                </span>
                              );
                            });
                          })()
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">Chưa có định mức</span>
                        )}
                        {m.hasMultipleActiveRecipes && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-100">
                            {m.activeRecipeCount} phiên bản hoạt động
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        {m.recipeHistory.length > 0 && (
                          <HistoryModal 
                            title={m.name}
                            recipeHistory={m.recipeHistory}
                          />
                        )}
                        <ModifierForm 
                          initialData={m} 
                          baseIngredients={baseIngredients} 
                          semiProducts={semiProducts} 
                          units={units} 
                        />
                        <DeleteModifierButton id={m.id} name={m.name} onDeleted={() => router.refresh()} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      ) : (
        <ToppingsManager products={toppings} />
      )}
    </div>
  );
}

function DeleteModifierButton({ id, name, onDeleted }: { id: string; name: string; onDeleted: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    await deleteModifierAction(fd);
    setLoading(false);
    onDeleted();
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
        description={`Bạn có chắc chắn muốn xóa tùy chọn "${name}"? Định mức nguyên liệu liên quan cũng sẽ được đóng.`}
      />
    </>
  );
}
