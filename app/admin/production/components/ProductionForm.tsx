"use client";

import { useState, useEffect, useId } from "react";
import { saveProductionOrder } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit } from "@/types/db";

interface ProductionFormProps {
  semiProducts: DBSemiProduct[];
  recipes: DBRecipe[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}

export function ProductionForm({ semiProducts, recipes, baseIngredients, units }: ProductionFormProps) {
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSpId, setSelectedSpId] = useState("");
  const [targetYield, setTargetYield] = useState<number | "">("");
  const [consumedIngredients, setConsumedIngredients] = useState<any[]>([]);

  // Lấy Recipe đang áp dụng cho SP này
  const activeRecipe = recipes.find(r => 
    r.target_type === "SEMI_PRODUCT" && 
    r.target_id === selectedSpId && 
    (!r.end_date || r.end_date === "")
  );

  const selectedSp = semiProducts.find(s => s.id === selectedSpId);

  // Tính toán lượng nguyên liệu cần thiết khi chọn SP hoặc đổi mẻ
  useEffect(() => {
    if (!selectedSpId || !targetYield || !activeRecipe) {
      setConsumedIngredients([]);
      return;
    }

    try {
      const ings = JSON.parse(activeRecipe.ingredients_json);
      const yieldPerBatch = Number(selectedSp?.batch_yield || 1);
      
      const multiplier = (Number(targetYield) || 0) / yieldPerBatch;

      const calculated = ings.map((ing: any) => {
        let name = ing.ingredient_id;
        let isNonInv = false;
        let baseUnitId = "";

        if (ing.ingredient_type === "BASE_INGREDIENT") {
          const bi = baseIngredients.find(b => b.id === ing.ingredient_id);
          if (bi) {
            name = bi.name;
            isNonInv = bi.is_non_inventory === "TRUE";
            baseUnitId = bi.base_unit || "";
          }
        } else {
          const sp = semiProducts.find(s => s.id === ing.ingredient_id);
          if (sp) {
            name = sp.name;
            baseUnitId = sp.base_unit || "";
          }
        }

        const unitName = units.find(u => u.id === baseUnitId)?.name || "";

        const defaultQty = Number(ing.quantity) * multiplier;
        // Làm tròn 2 chữ số thập phân
        const roundedQty = Math.round(defaultQty * 100) / 100;

        return {
          ...ing,
          name,
          unitName,
          is_non_inventory: isNonInv,
          defaultQty: roundedQty, // Để tham khảo
          qtyNeeded: roundedQty // Giá trị có thể ghi đè
        };
      });

      setConsumedIngredients(calculated);
    } catch (e) {
      console.error("Lỗi parse công thức:", e);
      setConsumedIngredients([]);
    }
  }, [selectedSpId, targetYield, activeRecipe, baseIngredients, semiProducts, units, selectedSp?.batch_yield]);

  const handleQtyChange = (index: number, newQty: string) => {
    const newIngs = [...consumedIngredients];
    newIngs[index].qtyNeeded = newQty;
    setConsumedIngredients(newIngs);
  };

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (!selectedSpId || !targetYield || Number(targetYield) <= 0) {
      setError("Vui lòng chọn Bán thành phẩm và nhập số lượng tạo ra hợp lệ.");
      setLoading(false);
      return;
    }

    if (consumedIngredients.length === 0) {
      setError("Không có công thức cho Bán thành phẩm này hoặc lỗi tính toán.");
      setLoading(false);
      return;
    }

    formData.append("semi_product_id", selectedSpId);
    formData.append("target_yield", String(targetYield));
    formData.append("consumed_ingredients", JSON.stringify(consumedIngredients));
    formData.append("user", "Admin"); // TODO: auth

    const res = await saveProductionOrder(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      setSelectedSpId("");
      setTargetYield("");
      setConsumedIngredients([]);
    }
  }

  const spOptions = semiProducts.map(s => ({ id: s.id, label: s.name }));

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition"
      >
        + Ghi Nhận Lệnh Nấu
      </button>

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title="Ghi Nhận Lệnh Nấu (Production)"
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
              Hủy
            </button>
            <LoadingButton
              type="submit"
              form="production-form"
              loading={loading}
              loadingText="Đang xử lý..."
            >
              Lưu & Trừ Kho
            </LoadingButton>
          </>
        }
      >
        <form id="production-form" action={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${formId}-selectedSpId`} className="block text-sm font-semibold text-gray-700 mb-2">Chọn Bán Thành Phẩm</label>
              <SearchableSelect
                id={`${formId}-selectedSpId`}
                options={spOptions}
                value={selectedSpId}
                onChange={setSelectedSpId}
                placeholder="VD: Trà đen ủ..."
              />
              {selectedSp && (
                <p className="text-xs text-gray-500 mt-1">
                  Mẻ chuẩn: {selectedSp.batch_yield} {units.find(u => u.id === selectedSp.base_unit)?.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={`${formId}-targetYield`} className="block text-sm font-semibold text-gray-700 mb-2">Sản lượng thực tế thu được</label>
              <div className="flex gap-2">
                <input
                  id={`${formId}-targetYield`}
                  type="number"
                  step="any"
                  value={targetYield}
                  onChange={(e) => setTargetYield(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
                  placeholder="VD: 4800"
                />
                <span className="inline-flex items-center px-3 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 font-medium">
                  {selectedSp ? units.find(u => u.id === selectedSp.base_unit)?.name : "---"}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-bold text-gray-900 mb-3">Nguyên liệu tiêu hao (Dự kiến)</h4>
            
            {!selectedSpId ? (
              <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                Vui lòng chọn Bán thành phẩm
              </div>
            ) : !targetYield ? (
              <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                Vui lòng nhập sản lượng thu được để tính định mức
              </div>
            ) : !activeRecipe ? (
              <div className="text-center py-8 text-sm text-red-500 border-2 border-dashed border-red-200 bg-red-50 rounded-xl">
                Bán thành phẩm này chưa có công thức! Vui lòng cài đặt công thức trước.
              </div>
            ) : (
              <div className="space-y-3">
                {consumedIngredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{ing.name}</div>
                      <div className="text-xs text-gray-500">
                        {ing.is_non_inventory ? (
                          <span className="text-amber-600">Phi lưu kho (Không trừ tồn)</span>
                        ) : (
                          <span>Trừ tồn kho</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        value={ing.qtyNeeded}
                        onChange={(e) => handleQtyChange(idx, e.target.value)}
                        className={`w-24 text-right border rounded-md px-2 py-1 text-sm focus:ring-2 ${
                           Number(ing.qtyNeeded) !== ing.defaultQty 
                            ? "border-amber-400 bg-amber-50 focus:ring-amber-500" 
                            : "border-gray-300 focus:ring-emerald-500"
                        }`}
                      />
                      <span className="text-sm text-gray-600 font-medium w-8">{ing.unitName}</span>
                    </div>
                  </div>
                ))}

                <p className="text-xs text-gray-500 italic mt-2">
                  * Bạn có thể sửa số lượng nguyên liệu tiêu hao nếu thực tế sử dụng khác với công thức chuẩn.
                </p>
              </div>
            )}
          </div>
        </form>
      </FormModal>
    </>
  );
}
