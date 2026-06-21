"use client";

import { useState, useEffect } from "react";
import { saveProductionOrder } from "@/app/actions/production";
import { ModalPortal } from "@/components/ui/ModalPortal";

export default function ProductionForm({ semiProducts, recipes, baseIngredients, units }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [selectedSpId, setSelectedSpId] = useState("");
  const [targetYield, setTargetYield] = useState<number | "">("");

  const selectedSp = semiProducts.find((s:any) => s.id === selectedSpId);
  const recipe = selectedSp ? recipes.find((r:any) => r.target_type === "SEMI_PRODUCT" && r.target_id === selectedSpId) : null;
  
  const spUnitName = selectedSp ? (units.find((u:any) => u.id === selectedSp.base_unit)?.name || selectedSp.base_unit) : "";
  const yieldPerBatch = Number(selectedSp?.batch_yield) || 1;

  // Trạng thái các nguyên liệu tiêu hao (để cho phép sửa thủ công)
  const [consumedIngredients, setConsumedIngredients] = useState<any[]>([]);

  // Tự động tính toán lại lượng tiêu hao khi đổi BTP hoặc đổi Target Yield
  useEffect(() => {
    if (!selectedSp || !recipe?.ingredients_json) {
      setConsumedIngredients([]);
      return;
    }
    
    let baseIngredientsList: any[] = [];
    try { baseIngredientsList = JSON.parse(recipe.ingredients_json); } catch (e) {}

    const multiplier = (Number(targetYield) || 0) / yieldPerBatch;

    const newConsumed = baseIngredientsList.map(ing => {
      let ingName = "Unknown";
      let ingUnit = "";
      let isNonInventory = false;

      if (ing.ingredient_type === "BASE_INGREDIENT") {
        const found = baseIngredients.find((b:any) => b.id === ing.ingredient_id);
        if (found) {
          ingName = found.name;
          ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit;
          isNonInventory = found.is_non_inventory === "TRUE";
        }
      } else {
        const found = semiProducts.find((s:any) => s.id === ing.ingredient_id);
        if (found) {
          ingName = found.name;
          ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit;
        }
      }

      const defaultQty = Number(ing.quantity) * multiplier;
      // Round to 2 decimal places to avoid floating point weirdness
      const roundedQty = Math.round(defaultQty * 100) / 100;

      return {
        ...ing,
        name: ingName,
        unit: ingUnit,
        is_non_inventory: isNonInventory,
        qtyNeeded: roundedQty
      };
    });

    setConsumedIngredients(newConsumed);
  }, [selectedSpId, targetYield, recipe, baseIngredients, semiProducts, units, yieldPerBatch]);

  const handleQtyChange = (index: number, newQty: number) => {
    const newConsumed = [...consumedIngredients];
    newConsumed[index].qtyNeeded = newQty;
    setConsumedIngredients(newConsumed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpId) return alert("Vui lòng chọn Bán Thành Phẩm cần nấu.");
    if (!targetYield || targetYield <= 0) return alert("Sản lượng mong muốn phải lớn hơn 0.");

    if (consumedIngredients.length === 0) {
      return alert("Bán thành phẩm này chưa được khai báo công thức. Hãy cấu hình công thức trước khi nấu.");
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("semi_product_id", selectedSpId);
    formData.append("target_yield", targetYield.toString());
    formData.append("consumed_ingredients", JSON.stringify(consumedIngredients));

    const res = await saveProductionOrder(formData);
    setLoading(false);

    if (res.success) {
      alert("Đã tạo Lệnh nấu thành công và trừ kho tự động!");
      setIsOpen(false);
      setSelectedSpId("");
      setTargetYield("");
    } else {
      alert("Lỗi: " + res.error);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition shadow-sm flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
        </svg>
        Nấu Mẻ Mới
      </button>

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-orange-500">🔥</span> Lệnh Nấu Bếp
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="productionForm" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Chọn Bán Thành Phẩm *</label>
                  <select
                    required
                    value={selectedSpId}
                    onChange={(e) => {
                      setSelectedSpId(e.target.value);
                      const sp = semiProducts.find((s:any) => s.id === e.target.value);
                      if (sp) setTargetYield(Number(sp.batch_yield)); // Gợi ý luôn sản lượng 1 mẻ
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 bg-white"
                  >
                    <option value="">-- Chọn món cần nấu --</option>
                    {semiProducts.map((sp:any) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </select>
                </div>

                {selectedSpId && (
                  <>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                      <label className="block text-sm font-bold text-orange-900 mb-2 border-b border-orange-200 pb-2">
                        Sản lượng mong muốn thu được:
                      </label>
                      <div className="flex items-center gap-3 mt-3">
                        <input
                          type="number"
                          required
                          min="0.1"
                          step="any"
                          value={targetYield}
                          onChange={(e) => setTargetYield(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-32 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 text-center font-black text-xl text-orange-600"
                        />
                        <span className="text-gray-600 font-semibold text-lg">{spUnitName}</span>
                      </div>
                      <p className="text-xs text-orange-700 mt-2 italic">
                        Định mức 1 mẻ chuẩn của món này là {yieldPerBatch} {spUnitName}. Khi bạn thay đổi số trên, nguyên liệu tiêu hao sẽ tự động tính tỷ lệ chéo tương ứng.
                      </p>
                    </div>

                    <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-700">Nguyên Liệu Tiêu Hao</h3>
                        <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded">Có thể sửa thủ công</span>
                      </div>
                      <div className="p-4 bg-white space-y-4">
                        {consumedIngredients.length === 0 ? (
                          <div className="text-sm text-red-500 italic text-center py-2">
                            ⚠️ Bán thành phẩm này chưa có công thức nấu.
                          </div>
                        ) : (
                          consumedIngredients.map((ing, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-800">{ing.name}</span>
                                {ing.is_non_inventory && (
                                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-sm mt-1 w-fit">
                                    Không trừ kho
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={ing.qtyNeeded}
                                  onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                                  className="w-20 text-right border border-gray-300 rounded-md px-2 py-1 text-sm font-bold focus:ring-orange-500 focus:border-orange-500"
                                />
                                <span className="text-sm font-medium text-gray-600 w-10">{ing.unit}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </form>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 mt-auto">
              <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">Huỷ</button>
              <button 
                type="submit" 
                form="productionForm" 
                disabled={loading || consumedIngredients.length === 0} 
                className="px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50 transition shadow-sm flex items-center gap-2"
              >
                {loading ? "Đang xử lý..." : "Xác nhận Nấu"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
