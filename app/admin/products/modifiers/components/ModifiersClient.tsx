"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import StickyFilterBar from "@/components/StickyFilterBar";
import HistoryModal from "@/components/HistoryModal";
import { formatNumber } from "@/lib/format";
import { deleteModifierAction } from "../actions";
import { ModifierForm } from "./ModifierForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { Button } from "@/components/ui/Button";
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
        <div className="flex bg-surface-secondary p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("modifiers")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "modifiers" ? "bg-surface-card text-primary-active shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Tùy chọn (Modifiers)
          </button>
          <button
            onClick={() => setActiveTab("standalone")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "standalone" ? "bg-surface-card text-primary-active shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Bán độc lập
          </button>
        </div>

        {activeTab === "modifiers" && (
          <div className="shrink-0 ml-4">
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm tùy chọn</label>
            <input
              type="text"
              placeholder="Tên hoặc nhóm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
            />
          </div>
        )}
      </StickyFilterBar>

      {activeTab === "modifiers" ? (
        <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-6 py-4 font-bold">Nhóm</th>
                <th className="px-6 py-4 font-bold">Tên Tùy Chọn</th>
                <th className="px-6 py-4 font-bold">Giá Thêm</th>
                <th className="px-6 py-4 font-bold">Định Mức (Recipe)</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredModifiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted italic">
                    Không tìm thấy tùy chọn nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredModifiers.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-secondary transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-surface-secondary text-text-secondary uppercase">
                        {m.group_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-text-primary">{m.name}</td>
                    <td className="px-6 py-4 text-warning font-bold">
                      {formatNumber(m.price)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {m.activeRecipe ? (
                          (() => {
                            const ings = parseModifierIngredients(m.activeRecipe.ingredients_json);
                            if (ings.length === 0) return <span className="text-text-muted italic text-[11px]">Chưa có định mức</span>;
                            
                            return ings.map((ing, idx) => {
                              const source = ing.ingredient_type === "BASE_INGREDIENT"
                                ? baseIngredients.find(bi => bi.id === ing.ingredient_id)
                                : semiProducts.find(sp => sp.id === ing.ingredient_id);
                              const unitName = units.find(u => u.id === source?.base_unit)?.name || "";
                              return (
                                <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary-soft text-primary-active border border-primary/20">
                                  {source?.name || ing.ingredient_id}: {ing.quantity}{unitName}
                                </span>
                              );
                            });
                          })()
                        ) : (
                          <span className="text-text-muted italic text-[11px]">Chưa có định mức</span>
                        )}
                        {m.hasMultipleActiveRecipes && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-warning/10 text-warning-active border border-warning/20">
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
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)} disabled={loading} className="text-danger hover:text-danger-active hover:bg-danger/10">{loading ? "..." : "Xóa"}</Button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa tùy chọn "${name}"? Định mức nguyên liệu liên quan cũng sẽ được đóng.`}
      />
    </>
  );
}
